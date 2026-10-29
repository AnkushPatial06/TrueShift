from datetime import datetime

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=2, max_length=20)
    description: str | None = None
    manager_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    manager_id: int | None = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    description: str | None = None
    manager_id: int | None = None
    employee_count: int = 0
    created_at: datetime


class ShiftCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    start_time: str = Field(description="HH:MM 24-hour, e.g. 09:00")
    end_time: str = Field(description="HH:MM 24-hour, e.g. 17:00")
    break_duration_minutes: int = Field(default=60, ge=0, le=480)
    grace_period_minutes: int = Field(default=15, ge=0, le=180)


class ShiftUpdate(BaseModel):
    name: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    break_duration_minutes: int | None = None
    grace_period_minutes: int | None = None


class ShiftOut(BaseModel):
    id: int
    name: str
    start_time: str
    end_time: str
    break_duration_minutes: int
    grace_period_minutes: int
    created_at: datetime
