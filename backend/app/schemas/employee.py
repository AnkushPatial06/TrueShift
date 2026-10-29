from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import Role


class EmployeeStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_LEAVE = "on_leave"


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = Role.EMPLOYEE
    employee_id: str = Field(min_length=2, max_length=30)
    department_id: int | None = None
    designation: str | None = None
    shift_id: int | None = None
    joining_date: date | None = None
    work_location: str | None = None
    is_remote: bool = False
    profile_photo_url: str | None = None


class EmployeeUpdate(BaseModel):
    name: str | None = None
    department_id: int | None = None
    designation: str | None = None
    shift_id: int | None = None
    status: EmployeeStatus | None = None
    role: Role | None = None
    work_location: str | None = None   # HR assigns the employee's work location
    is_remote: bool | None = None      # True = remote worker (no geofencing required)
    is_active: bool | None = None      # Deactivate / reactivate account
    profile_photo_url: str | None = None


class EmployeeOut(BaseModel):
    id: int
    employee_id: str | None = None
    name: str
    email: EmailStr
    role: Role
    department_id: int | None = None
    department_name: str | None = None
    designation: str | None = None
    shift_id: int | None = None
    shift_name: str | None = None
    joining_date: date | None = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    face_registered: bool = False
    is_active: bool = True
    work_location: str | None = None
    is_remote: bool = False
    profile_photo_url: str | None = None
    created_at: datetime
