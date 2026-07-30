import os
from arq.connections import RedisSettings
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
from app.ocr import extract_text_from_image, parse_medicines_raw
from app.services.drug_matcher import resolve_medicines
from app.services.drug_lookup import get_drug_info

REDIS_SETTINGS = RedisSettings(host="localhost", port=6379)


async def run_ocr_job(ctx, prescription_id: int):
    db: Session = SessionLocal()
    try:
        prescription = db.query(models.Prescription).filter(
            models.Prescription.id == prescription_id
        ).first()
        if not prescription:
            return

        raw_text = extract_text_from_image(prescription.file_path, is_handwritten=prescription.is_handwritten)
        draft_medicines = parse_medicines_raw(raw_text)
        resolved_medicines = resolve_medicines(db, draft_medicines)

        # For every confidently-matched medicine, fetch full drug info
        # (OpenFDA + RxNorm) and cache/embed it for the chatbot — this
        # is what makes the SAME confirmed name usable for scheduling
        # AND for the chatbot's retrieval later.
        for med in resolved_medicines:
            if med["confidence"] == "high":
                get_drug_info(db, med["name"])

        prescription.parsed_data = resolved_medicines
        prescription.status = "parsed"
        db.commit()
    except Exception as e:
        prescription = db.query(models.Prescription).filter(
            models.Prescription.id == prescription_id
        ).first()
        if prescription:
            prescription.status = "uploaded"
            db.commit()
        print(f"OCR job failed for prescription {prescription_id}: {e}")
    finally:
        db.close()


class WorkerSettings:
    functions = [run_ocr_job]
    redis_settings = REDIS_SETTINGS