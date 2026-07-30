from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from app.database import get_db
from app import models, schemas, auth

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


@router.post("/signup", response_model=schemas.Token)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        email=user.email,
        hashed_password=auth.hash_password(user.password),
        full_name=user.full_name,
        age=user.age,
        gender=user.gender,
        phone=user.phone,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = auth.create_access_token(data={"sub": new_user.email})
    return {"access_token": token}


@router.post("/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_access_token(data={"sub": db_user.email})
    return {"access_token": token}


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = auth.decode_access_token(token)
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/me", response_model=schemas.UserOut)
def read_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.age is not None:
        current_user.age = payload.age
    if payload.gender is not None:
        current_user.gender = payload.gender
    db.commit()
    db.refresh(current_user)
    return current_user