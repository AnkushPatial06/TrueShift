from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class Role(str, Enum):
    ADMIN = "admin"
    HR = "hr"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = Role.EMPLOYEE
    employee_id: str | None = None
    department_id: int | None = None
    designation: str | None = None
    profile_photo_url: str | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Role
    employee_id: str | None = None
    department_id: int | None = None
    designation: str | None = None
    is_active: bool = True
    work_location: str | None = None
    is_remote: bool = False
    profile_photo_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)
