"""
One-time backfill: fetches + embeds drug info for every name in the
starter reference list, so the chatbot has data to answer with even
before any real prescription has been uploaded and parsed.

Run from dosiee-backend/ with the venv active:
    python scripts/backfill_drug_data.py
"""
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.services.drug_lookup import get_drug_info
from scripts.seed_medicine_reference import STARTER_DRUG_NAMES


def main():
    db = SessionLocal()
    ok, failed = 0, []
    try:
        for name in STARTER_DRUG_NAMES:
            print(f"Fetching + embedding: {name} ...")
            drug = get_drug_info(db, name)
            if drug:
                ok += 1
            else:
                failed.append(name)
    finally:
        db.close()

    print(f"\nDone. Indexed {ok}/{len(STARTER_DRUG_NAMES)} drugs.")
    if failed:
        print(f"No data found for: {', '.join(failed)}")


if __name__ == "__main__":
    main()
