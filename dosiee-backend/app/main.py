from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine
from app.routers import auth, prescriptions, doses, schedule,drugs
from app.routers import auth, prescriptions, doses, schedule, drugs, chatbot



Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dosiee API")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(prescriptions.router)
app.include_router(doses.router)
app.include_router(schedule.router)
app.include_router(drugs.router)
app.include_router(chatbot.router)

@app.get("/")
def root():
    return {"message": "Dosiee API is running"}