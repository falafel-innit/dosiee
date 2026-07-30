import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user

router = APIRouter()


def _time_to_str(t):
    return t.strftime("%H:%M") if t else None


def _str_to_time(s):
    return datetime.datetime.strptime(s, "%H:%M").time()


@router.get("/schedule-times", response_model=schemas.ScheduleTimesOut)
def get_schedule_times(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sched = db.query(models.UserSchedule).filter(models.UserSchedule.user_id == current_user.id).first()
    if not sched:
        return schemas.ScheduleTimesOut()
    return schemas.ScheduleTimesOut(
        breakfast_time=_time_to_str(sched.breakfast_time),
        lunch_time=_time_to_str(sched.lunch_time),
        dinner_time=_time_to_str(sched.dinner_time),
        sleep_time=_time_to_str(sched.sleep_time),
        extra_time=_time_to_str(sched.extra_time),
    )


@router.patch("/schedule-times", response_model=schemas.ScheduleTimesOut)
def update_schedule_times(payload: schemas.ScheduleTimesIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sched = db.query(models.UserSchedule).filter(models.UserSchedule.user_id == current_user.id).first()
    if not sched:
        sched = models.UserSchedule(user_id=current_user.id)
        db.add(sched)

    for field in ["breakfast_time", "lunch_time", "dinner_time", "sleep_time", "extra_time"]:
        value = getattr(payload, field)
        if value:
            setattr(sched, field, _str_to_time(value))

    db.commit()
    db.refresh(sched)
    return schemas.ScheduleTimesOut(
        breakfast_time=_time_to_str(sched.breakfast_time),
        lunch_time=_time_to_str(sched.lunch_time),
        dinner_time=_time_to_str(sched.dinner_time),
        sleep_time=_time_to_str(sched.sleep_time),
        extra_time=_time_to_str(sched.extra_time),
    )