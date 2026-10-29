from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class LeaveType(str, Enum):
    CASUAL = "casual"
    SICK = "sick"
    EARNED = "earned"
    EMERGENCY = "emergency"
    UNPAID = "unpaid"
    WORK_FROM_HOME = "work_from_home"
    CUSTOM = "custom"


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


DEFAULT_LEAVE_ALLOCATIONS: dict[str, int] = {
    LeaveType.CASUAL.value: 12,
    LeaveType.SICK.value: 10,
    LeaveType.EARNED.value: 15,
    LeaveType.EMERGENCY.value: 5,
}


class LeaveApplyRequest(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class LeaveDecisionRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=500)


class LeaveOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    profile_photo_url: str | None = None
    department: str | None = None
    employee_id_str: str | None = None
    leave_type: LeaveType
    start_date: date
    end_date: date
    days_requested: int
    reason: str
    status: LeaveStatus
    decision_comment: str | None = None
    decided_by: int | None = None
    created_at: datetime
    updated_at: datetime | None = None


class LeaveBalanceOut(BaseModel):
    employee_id: int
    balances: dict[str, dict[str, int]]


class HolidayCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    date: date
    recurring_yearly: bool = False


class HolidayOut(BaseModel):
    id: int
    name: str
    date: date
    recurring_yearly: bool
    created_at: datetime
