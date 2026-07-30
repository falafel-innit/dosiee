import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app import models

STARTER_DRUG_NAMES = [
    "metformin", "amlodipine", "atorvastatin", "lisinopril", "metoprolol",
    "omeprazole", "losartan", "gabapentin", "hydrochlorothiazide", "sertraline",
    "ibuprofen", "acetaminophen", "aspirin", "simvastatin", "amoxicillin",
    "paracetamol", "ciprofloxacin", "azithromycin", "cetirizine", "pantoprazole",
    "levothyroxine", "montelukast", "clopidogrel", "warfarin", "insulin",
]

def main():
    db = SessionLocal()
    added = 0
    for name in STARTER_DRUG_NAMES:
        exists = db.query(models.MedicineReference).filter(
            models.MedicineReference.generic_name == name
        ).first()
        if not exists:
            db.add(models.MedicineReference(generic_name=name))
            added += 1
    db.commit()
    db.close()
    print(f"Seeded {added} new medicine names.")

if __name__ == "__main__":
    main()