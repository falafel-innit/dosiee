from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app import models
from app.routers.auth import get_current_user
from app.services.chatbot import answer_question

router = APIRouter()


class ChatRequest(BaseModel):
    question: str


@router.post("/chatbot/ask")
def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    answer = answer_question(db, current_user.id, payload.question)
    return {"answer": answer}