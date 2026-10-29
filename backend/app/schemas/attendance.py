from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    LEAVE = "leave"
    HOLIDAY = "holiday"
    WEEKEND = "weekend"
    WORK_FROM_HOME = "work_from_home"


class AttendanceMethod(str, Enum):
    FACE_RECOGNITION = "face_recognition"
    MANUAL = "manual"


class CheckInRequest(BaseModel):
    employee_id: str
    frame_base64: str
    liveness_frames_base64: list[str] = Field(min_length=3)
    location: str | None = None
    latitude: float | None = None   # GPS lat from browser
    longitude: float | None = None  # GPS lng from browser


class CheckOutRequest(BaseModel):
    employee_id: str
    frame_base64: str
    liveness_frames_base64: list[str] = Field(min_length=3)
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class AttendanceOut(BaseModel):
    employee_id: int
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    working_hours: float | None = None
    status: AttendanceStatus
    late_minutes: int = 0
    early_departure_minutes: int = 0
    overtime_minutes: int = 0
    recognition_score: float | None = None
    liveness_verified: bool = False
    attendance_method: AttendanceMethod
    location: str | None = None
    created_at: datetime
    updated_at: datetime


class CheckInResponse(BaseModel):
    success: bool
    message: str
    employee_id: str | None = None
    employee_name: str | None = None
    similarity_score: float | None = None
    liveness_verified: bool = False
    status: AttendanceStatus | None = None
    check_in_time: datetime | None = None
    # Extended location & shift context
    late_minutes: int | None = None
    is_remote: bool | None = None
    location: str | None = None
    geo_message: str | None = None
    shift_start: str | None = None
    shift_end: str | None = None
