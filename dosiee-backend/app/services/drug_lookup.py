import os
import requests
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app import models
from app.services.embeddings import index_drug

load_dotenv()

OPENFDA_API_KEY = os.getenv("OPENFDA_API_KEY")

OPENFDA_URL = "https://api.fda.gov/drug/label.json"
RXNORM_RXCUI_URL = "https://rxnav.nlm.nih.gov/REST/rxcui.json"
RXNORM_RELATED_URL = "https://rxnav.nlm.nih.gov/REST/rxcui/{}/allrelated.json"


def _fetch_from_openfda(generic_name: str):
    params = {
        "search": f'openfda.generic_name:"{generic_name}"',
        "limit": 1,
    }
    if OPENFDA_API_KEY:
        params["api_key"] = OPENFDA_API_KEY

    try:
        response = requests.get(OPENFDA_URL, params=params, timeout=5)
    except requests.RequestException:
        return None

    if response.status_code != 200:
        return None

    results = response.json().get("results")
    return results[0] if results else None


def _fetch_brand_names_from_rxnorm(generic_name: str):
    try:
        response = requests.get(RXNORM_RXCUI_URL, params={"name": generic_name}, timeout=5)
    except requests.RequestException:
        return []

    if response.status_code != 200:
        return []

    ids = response.json().get("idGroup", {}).get("rxnormId")
    if not ids:
        return []

    rxcui = ids[0]

    try:
        response = requests.get(RXNORM_RELATED_URL.format(rxcui), timeout=5)
    except requests.RequestException:
        return []

    if response.status_code != 200:
        return []

    groups = response.json().get("allRelatedGroup", {}).get("conceptGroup", [])
    names = []
    for group in groups:
        if group.get("tty") == "BN":
            names.extend(c.get("name") for c in group.get("conceptProperties", []))
    return names


def get_drug_info(db: Session, generic_name: str):
    """
    Checks the local Postgres cache first. If not found, fetches live
    from OpenFDA (label info) + RxNorm (brand names), caches the result,
    embeds it for the chatbot's RAG retrieval, and returns it.
    Returns None if the drug isn't found anywhere.
    """
    generic_name = generic_name.lower().strip()

    cached = db.query(models.Drug).filter(models.Drug.generic_name == generic_name).first()
    if cached:
        return cached

    openfda_data = _fetch_from_openfda(generic_name)
    brand_names = _fetch_brand_names_from_rxnorm(generic_name)

    if not openfda_data and not brand_names:
        return None

    new_drug = models.Drug(
        generic_name=generic_name,
        brand_names=brand_names,
        indications=" ".join(openfda_data.get("indications_and_usage", [])) if openfda_data else None,
        dosage_info=" ".join(openfda_data.get("dosage_and_administration", [])) if openfda_data else None,
        warnings=" ".join(openfda_data.get("warnings", [])) if openfda_data else None,
        side_effects=" ".join(openfda_data.get("adverse_reactions", [])) if openfda_data else None,
    )
    db.add(new_drug)
    db.commit()
    db.refresh(new_drug)

    index_drug(db, new_drug)

    return new_drug