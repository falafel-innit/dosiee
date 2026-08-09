import os
import shutil
import uuid
import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException ,Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user
from arq import create_pool
from app.worker import REDIS_SETTINGS

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ANCHOR_RELATION_RULES = {
    "breakfast": ["before", "after"],
    "lunch": ["before", "after"],
    "dinner": ["before", "after"],
    "sleep": ["before"],
    "extra": ["before", "after", "exact"],
}

DEFAULT_ANCHOR_TIMES = {
    "breakfast": datetime.time(8, 0),
    "lunch": datetime.time(13, 0),
    "dinner": datetime.time(20, 0),
    "sleep": datetime.time(22, 0),
    "extra": datetime.time(16, 0),
}

OFFSET_MINUTES = 30


@router.post("/prescriptions/upload")
def upload_prescription(
    file: UploadFile = File(...),
    is_handwritten: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    _, ext = os.path.splitext(file.filename)
    unique_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    new_prescription = models.Prescription(
        user_id=current_user.id, file_path=file_path, status="uploaded", is_handwritten=is_handwritten
    )
    db.add(new_prescription)
    db.commit()
    db.refresh(new_prescription)
    return {"id": new_prescription.id, "status": new_prescription.status}


@router.get("/prescriptions", response_model=list[schemas.PrescriptionOut])
def list_prescriptions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prescriptions = db.query(models.Prescription).filter(
        models.Prescription.user_id == current_user.id
    ).order_by(models.Prescription.uploaded_at.desc()).all()
    return [
        {"id": p.id, "status": p.status, "uploaded_at": p.uploaded_at,
         "file_url": f"/uploads/{os.path.basename(p.file_path)}"}
        for p in prescriptions
    ]


@router.post("/prescriptions/{prescription_id}/parse")
async def parse_prescription(prescription_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prescription = db.query(models.Prescription).filter(
        models.Prescription.id == prescription_id, models.Prescription.user_id == current_user.id
    ).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    prescription.status = "processing"
    db.commit()

    redis = await create_pool(REDIS_SETTINGS)
    await redis.enqueue_job("run_ocr_job", prescription_id)

    return {"id": prescription.id, "status": "processing"}


@router.get("/prescriptions/{prescription_id}", response_model=schemas.PrescriptionParseOut)
def get_prescription(prescription_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prescription = db.query(models.Prescription).filter(
        models.Prescription.id == prescription_id, models.Prescription.user_id == current_user.id
    ).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return {"id": prescription.id, "status": prescription.status, "parsed_data": prescription.parsed_data or [],
            "file_url": f"/uploads/{os.path.basename(prescription.file_path)}"}


def _resolve_anchor_time(anchor: str, user_schedule):
    if user_schedule:
        val = getattr(user_schedule, f"{anchor}_time", None)
        if val:
            return val
    return DEFAULT_ANCHOR_TIMES[anchor]


def _compute_slot_time(anchor_time, relation: str):
    if relation == "exact":
        return anchor_time
    base = datetime.datetime.combine(datetime.date.today(), anchor_time)
    delta = datetime.timedelta(minutes=OFFSET_MINUTES)
    result = base - delta if relation == "before" else base + delta
    return result.time()


@router.post("/prescriptions/{prescription_id}/confirm")
def confirm_prescription(prescription_id: int, payload: schemas.ConfirmRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prescription = db.query(models.Prescription).filter(
        models.Prescription.id == prescription_id, models.Prescription.user_id == current_user.id
    ).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    user_schedule = db.query(models.UserSchedule).filter(models.UserSchedule.user_id == current_user.id).first()

    created_doses = []  # NEW: collect dose info to return to the app
    today = datetime.date.today()
    for med in payload.medicines:
        db_medicine = models.Medicine(
            prescription_id=prescription.id, name=med.name, dosage=med.dosage,
            frequency=med.frequency, duration_days=med.duration_days,
            timing_slots=[s.dict() for s in med.timing_slots],
        )
        db.add(db_medicine)
        db.flush()

        for day_offset in range(med.duration_days):
            dose_date = today + datetime.timedelta(days=day_offset)
            for slot in med.timing_slots:
                anchor_time = _resolve_anchor_time(slot.anchor, user_schedule)
                dose_time = _compute_slot_time(anchor_time, slot.relation)
                dose_datetime = datetime.datetime.combine(dose_date, dose_time)
                new_dose = models.Dose(medicine_id=db_medicine.id, scheduled_time=dose_datetime)
                db.add(new_dose)
                db.flush()
                created_doses.append({
                    "medicine_name": med.name,
                    "dosage": med.dosage,
                    "scheduled_time": dose_datetime.isoformat(),
                })

    prescription.status = "confirmed"
    db.commit()
    return {
        "prescription_id": prescription.id,
        "status": "confirmed",
        "medicines_created": len(payload.medicines),
        "doses": created_doses,  # NEW
    }


@router.delete("/prescriptions/{prescription_id}")
def delete_prescription(prescription_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    prescription = db.query(models.Prescription).filter(
        models.Prescription.id == prescription_id, models.Prescription.user_id == current_user.id
    ).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if os.path.exists(prescription.file_path):
        os.remove(prescription.file_path)
    db.delete(prescription)
    db.commit()
    return {"deleted": prescription_id}


@router.delete("/medicines/{medicine_id}")
def delete_medicine(medicine_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    medicine = db.query(models.Medicine).join(models.Prescription).filter(
        models.Medicine.id == medicine_id, models.Prescription.user_id == current_user.id
    ).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    db.delete(medicine)
    db.commit()
    return {"deleted": medicine_id}