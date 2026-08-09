from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    age: int
    gender: str
    phone: str

    @field_validator("phone")
    @classmethod
    def phone_must_be_10_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Phone number must be exactly 10 digits")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def phone_must_be_10_digits(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v.isdigit() or len(v) != 10):
            raise ValueError("Phone number must be exactly 10 digits")
        return v

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TimingSlot(BaseModel):
    anchor: str   # breakfast | lunch | dinner | sleep | extra
    relation: str # before | after | exact


class MedicineIn(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration_days: int
    timing_slots: List[TimingSlot]


class MedicineOut(MedicineIn):
    id: int
    class Config:
        from_attributes = True


class PrescriptionOut(BaseModel):
    id: int
    status: str
    uploaded_at: datetime
    file_url: Optional[str] = None
    class Config:
        from_attributes = True


class PrescriptionParseOut(BaseModel):
    id: int
    status: str
    parsed_data: List[dict]
    file_url: Optional[str] = None


class ConfirmRequest(BaseModel):
    medicines: List[MedicineIn]


class ScheduleTimesIn(BaseModel):
    breakfast_time: Optional[str] = None  # "HH:MM"
    lunch_time: Optional[str] = None
    dinner_time: Optional[str] = None
    sleep_time: Optional[str] = None
    extra_time: Optional[str] = None


class ScheduleTimesOut(ScheduleTimesIn):
    pass