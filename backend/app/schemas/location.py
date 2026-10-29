"""Pydantic schemas for WorkLocation API."""
from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    address: str | None = None
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    radius_meters: int = Field(default=150, ge=10, le=5000)


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    address: str | None = None
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0)
    radius_meters: int | None = Field(default=None, ge=10, le=5000)
    is_active: bool | None = None


class LocationOut(BaseModel):
    id: int
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    radius_meters: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
