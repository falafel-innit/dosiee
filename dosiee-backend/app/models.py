from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON, Time
from sqlalchemy.orm import relationship
from app.database import Base
from pgvector.sqlalchemy import Vector
import datetime


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    prescriptions = relationship("Prescription", back_populates="owner")
    schedule = relationship("UserSchedule", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSchedule(Base):
    __tablename__ = "user_schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    breakfast_time = Column(Time, nullable=True)
    lunch_time = Column(Time, nullable=True)
    dinner_time = Column(Time, nullable=True)
    sleep_time = Column(Time, nullable=True)
    extra_time = Column(Time, nullable=True)
    user = relationship("User", back_populates="schedule")


class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_path = Column(String, nullable=False)
    status = Column(String, default="uploaded")
    parsed_data = Column(JSON, nullable=True)
    is_handwritten = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner = relationship("User", back_populates="prescriptions")
    medicines = relationship("Medicine", back_populates="prescription", cascade="all, delete-orphan")


class Medicine(Base):
    __tablename__ = "medicines"
    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    name = Column(String, nullable=False)
    dosage = Column(String)
    frequency = Column(String)
    duration_days = Column(Integer)
    timing_slots = Column(JSON, nullable=True)  # [{"anchor": "breakfast", "relation": "after"}, ...]
    prescription = relationship("Prescription", back_populates="medicines")
    doses = relationship("Dose", back_populates="medicine", cascade="all, delete-orphan")


class Dose(Base):
    __tablename__ = "doses"
    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    scheduled_time = Column(DateTime, nullable=False)
    taken = Column(Boolean, default=False)
    medicine = relationship("Medicine", back_populates="doses")

class Drug(Base):
    __tablename__ = "drugs"
    id = Column(Integer, primary_key=True, index=True)
    generic_name = Column(String, unique=True, index=True, nullable=False)
    brand_names = Column(JSON, nullable=True)
    indications = Column(String, nullable=True)
    dosage_info = Column(String, nullable=True)
    warnings = Column(String, nullable=True)
    side_effects = Column(String, nullable=True)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)

class MedicineReference(Base):
    __tablename__ = "medicine_reference"
    id = Column(Integer, primary_key=True, index=True)
    generic_name = Column(String, unique=True, index=True, nullable=False)


class DrugEmbedding(Base):
    __tablename__ = "drug_embeddings"
    id = Column(Integer, primary_key=True, index=True)
    drug_name = Column(String, index=True)
    content = Column(String)  # the actual text chunk (e.g. "side effects: ...")
    embedding = Column(Vector(384))  # 384 = output size of the embedding model used below