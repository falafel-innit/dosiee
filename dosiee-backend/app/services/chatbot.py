import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app import models
from app.services.embeddings import retrieve_relevant_chunks
import datetime

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


def build_context(db: Session, user_id: int, question: str) -> str:
    """
    Assembles everything the LLM needs to answer: retrieved drug
    knowledge (RAG) + the user's own data (direct DB queries) —
    the hybrid architecture discussed earlier.
    """
    retrieved = retrieve_relevant_chunks(db, question, k=4)
    user_medicines = tool_get_user_medicines(db, user_id)
    today_doses = tool_get_today_doses(db, user_id)

    context_parts = []

    if retrieved:
        context_parts.append("Relevant drug information:")
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
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(full_prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Gemini chatbot call failed: {e}")
        return "Sorry, I couldn't process that right now. Please try again in a moment."
#def generate_answer(question: str, context: str) -> str:
#    """
 #   This is the ONLY function that talks to an LLM. Swap the model/provider
  #  here (OpenAI, Anthropic, Google, or a local model via Ollama) without
   # touching any other part of the chatbot pipeline.
    #"""
    #full_prompt = f"{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"

    # Placeholder — plug in whichever provider you choose. Example shapes:
    #
    # OpenAI:
    #   from openai import OpenAI
    #   client = OpenAI()
    #   response = client.chat.completions.create(model="gpt-4o-mini",
    #       messages=[{"role": "user", "content": full_prompt}])
    #   return response.choices[0].message.content
    #
    # Anthropic:
    #   from anthropic import Anthropic
    #   client = Anthropic()
    #   response = client.messages.create(model="claude-...", max_tokens=500,
    #       messages=[{"role": "user", "content": full_prompt}])
    #   return response.content[0].text
    #
    # Local (Ollama, fully free/offline):
    #   import requests
    #   r = requests.post("http://localhost:11434/api/generate",
    #       json={"model": "llama3", "prompt": full_prompt, "stream": False})
    #   return r.json()["response"]

    #raise NotImplementedError("Choose and wire in an LLM provider here.")



def answer_question(db: Session, user_id: int, question: str) -> str:
    context = build_context(db, user_id, question)
    return generate_answer(question, context)