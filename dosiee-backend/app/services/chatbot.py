import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app import models
from app.services.embeddings import retrieve_relevant_chunks
from app.services.drug_lookup import get_drug_info
import datetime
from google import genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def tool_get_user_medicines(db: Session, user_id: int):
    prescriptions = db.query(models.Prescription).filter(
        models.Prescription.user_id == user_id, models.Prescription.status == "confirmed"
    ).all()
    medicines = []
    for p in prescriptions:
        medicines.extend([m.name for m in p.medicines])
    return medicines


def tool_get_today_doses(db: Session, user_id: int):
    today = datetime.date.today()
    start = datetime.datetime.combine(today, datetime.time.min)
    end = datetime.datetime.combine(today, datetime.time.max)
    doses = (
        db.query(models.Dose).join(models.Medicine).join(models.Prescription)
        .filter(models.Prescription.user_id == user_id, models.Dose.scheduled_time.between(start, end))
        .all()
    )
    return [{"name": d.medicine.name, "time": d.scheduled_time.strftime("%I:%M %p"), "taken": d.taken} for d in doses]


def _live_lookup_user_medicines(db: Session, user_medicines: list) -> list:
    """
    Calls the OpenFDA/RxNorm-backed get_drug_info() in real time for each
    of the user's own confirmed medicines. get_drug_info() checks the local
    Postgres cache first, so this only hits the live APIs on a genuine cache
    miss (first question about that drug) — every question after is instant.
    """
    lines = []
    seen = set()
    for name in user_medicines:
        key = name.lower().strip()
        if key in seen:
            continue
        seen.add(key)

        try:
            drug = get_drug_info(db, name)
        except Exception as e:
            print(f"Live drug lookup failed for '{name}': {e}")
            drug = None

        if not drug:
            continue

        if drug.indications:
            lines.append(f"{drug.generic_name} is used for: {drug.indications}")
        if drug.dosage_info:
            lines.append(f"{drug.generic_name} dosage information: {drug.dosage_info}")
        if drug.warnings:
            lines.append(f"{drug.generic_name} warnings: {drug.warnings}")
        if drug.side_effects:
            lines.append(f"{drug.generic_name} side effects: {drug.side_effects}")

    return lines


def build_context(db: Session, user_id: int, question: str) -> str:
    """
    Assembles everything the LLM needs to answer:
      1. Real-time OpenFDA/RxNorm lookup for the user's own medicines
         (guarantees coverage, cached after the first call per drug)
      2. Vector-retrieved chunks from anything already embedded (covers
         other drugs previously cached, e.g. by another user)
      3. The user's own schedule data (direct DB queries)
    """
    user_medicines = tool_get_user_medicines(db, user_id)
    today_doses = tool_get_today_doses(db, user_id)

    live_info = _live_lookup_user_medicines(db, user_medicines)
    retrieved = retrieve_relevant_chunks(db, question, k=4)

    context_parts = []

    if live_info:
        context_parts.append("Information about the user's own medicines:")
        for line in live_info:
            context_parts.append(f"- {line}")

    if retrieved:
        context_parts.append("\nOther relevant drug information:")
        for chunk in retrieved:
            context_parts.append(f"- {chunk['content']}")

    if user_medicines:
        context_parts.append(f"\nThe user is currently prescribed: {', '.join(user_medicines)}")

    if today_doses:
        dose_lines = [f"{d['name']} at {d['time']} ({'taken' if d['taken'] else 'not taken yet'})" for d in today_doses]
        context_parts.append(f"\nToday's schedule: {'; '.join(dose_lines)}")

    return "\n".join(context_parts)


SYSTEM_PROMPT = """You are a helpful assistant inside a medicine reminder app called Dosiee.
Answer the user's question using ONLY the information provided in the context below.
If the context doesn't contain enough information to answer confidently, say so honestly
rather than guessing. Never advise the user to stop, start, or change a dose — always
direct medical decisions to their doctor or pharmacist. Keep answers concise and clear."""


def generate_answer(question: str, context: str) -> str:
    """
    This is the ONLY function that talks to an LLM.
    """
    full_prompt = f"{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"

    if not GEMINI_API_KEY:
        return "The assistant isn't configured yet — missing GEMINI_API_KEY."

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini chatbot call failed: {e}")
        return "Sorry, I couldn't process that right now. Please try again in a moment."
        return "Sorry, I couldn't process that right now. Please try again in a moment."


def answer_question(db: Session, user_id: int, question: str) -> str:
    context = build_context(db, user_id, question)
    return generate_answer(question, context)