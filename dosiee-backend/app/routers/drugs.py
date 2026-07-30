from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.drug_lookup import get_drug_info
from app.routers.auth import get_current_user
from app import models

router = APIRouter()


@router.get("/drugs/{generic_name}")
def lookup_drug(generic_name: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    drug = get_drug_info(db, generic_name)
    if not drug:
        raise HTTPException(status_code=404, detail=f"No data found for {generic_name}")
    return {
        "generic_name": drug.generic_name,
        "brand_names": drug.brand_names,
        "indications": drug.indications,
        "dosage_info": drug.dosage_info,
        "warnings": drug.warnings,
        "side_effects": drug.side_effects,
    }