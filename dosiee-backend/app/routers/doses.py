import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/doses/today")
def get_today_doses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = datetime.date.today()
    start = datetime.datetime.combine(today, datetime.time.min)
    end = datetime.datetime.combine(today, datetime.time.max)

    doses = (
        db.query(models.Dose).join(models.Medicine).join(models.Prescription)
        .filter(models.Prescription.user_id == current_user.id, models.Dose.scheduled_time.between(start, end))
        .order_by(models.Dose.scheduled_time).all()
    )
    return [{"id": d.id, "medicine_name": d.medicine.name, "dosage": d.medicine.dosage,
             "scheduled_time": d.scheduled_time, "taken": d.taken} for d in doses]


@router.patch("/doses/{dose_id}/toggle")
def toggle_dose(dose_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    dose = (
        db.query(models.Dose).join(models.Medicine).join(models.Prescription)
        .filter(models.Dose.id == dose_id, models.Prescription.user_id == current_user.id).first()
    )
    if not dose:
        raise HTTPException(status_code=404, detail="Dose not found")
    dose.taken = not dose.taken
    db.commit()
    return {"id": dose.id, "taken": dose.taken}