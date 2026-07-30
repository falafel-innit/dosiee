import requests
from rapidfuzz import process, fuzz
from sqlalchemy.orm import Session
from app import models

MATCH_THRESHOLD = 75

RXNORM_APPROX_URL = "https://rxnav.nlm.nih.gov/REST/approximateTerm.json"


def _match_rxnorm_approximate(candidate_text: str):
    """
    Falls back to RxNorm's approximateTerm endpoint, which fuzzy-matches
    against RxNorm's entire drug database rather than just our small
    local seed list. Used when the local reference list doesn't produce
    a confident match. Returns (matched_name, confidence_score) or
    (None, 0) if nothing comes back or the request fails.
    """
    try:
        response = requests.get(
            RXNORM_APPROX_URL,
            params={"term": candidate_text, "maxEntries": 1},
            timeout=5,
        )
    except requests.RequestException:
        return None, 0

    if response.status_code != 200:
        return None, 0

    candidates = response.json().get("approximateGroup", {}).get("candidate", [])
    if not candidates:
        return None, 0

    best = candidates[0]
    name = best.get("name")
    if not name:
        return None, 0

    # RxNorm's own "score" field is a relevance rank, not 0-100 like
    # rapidfuzz's. Re-score the returned name against the candidate text
    # with the same scorer so it's comparable to MATCH_THRESHOLD.
    score = fuzz.ratio(candidate_text.lower(), name.lower())
    return name, score


def find_best_drug_match(db: Session, candidate_text: str):
    """
    Compares candidate_text against the known medicine reference list.
    Returns (matched_name, confidence_score) if a good match is found,
    or (None, best_score_found) if nothing clears the threshold —
    the caller decides what to do with a low-confidence result.

    Falls back to RxNorm's full database (via _match_rxnorm_approximate)
    if the local seed list doesn't have a confident match.
    """
    reference_names = [r.generic_name for r in db.query(models.MedicineReference).all()]

    local_match, local_score = None, 0
    if reference_names:
        result = process.extractOne(candidate_text.lower(), reference_names, scorer=fuzz.ratio)
        if result:
            local_match, local_score, _ = result

    if local_match and local_score >= MATCH_THRESHOLD:
        return local_match, local_score

    rxnorm_match, rxnorm_score = _match_rxnorm_approximate(candidate_text)
    if rxnorm_match and rxnorm_score >= MATCH_THRESHOLD:
        return rxnorm_match, rxnorm_score

    return None, max(local_score, rxnorm_score)


def resolve_medicines(db: Session, draft_medicines: list[dict]) -> list[dict]:
    """
    Takes the raw OCR-extracted draft medicines and verifies each name
    against the known reference list. Adds confidence info so the
    Review screen can flag low-confidence guesses for the user.
    """
    resolved = []
    for med in draft_medicines:
        matched_name, score = find_best_drug_match(db, med["raw_name"])
        resolved.append({
            "name": matched_name if matched_name else med["raw_name"],
            "dosage": med["dosage"],
            "frequency": med["frequency"],
            "duration_days": med["duration_days"],
            "confidence": "high" if matched_name else "low",
            "raw_ocr_text": med["raw_name"],
        })
    return resolved