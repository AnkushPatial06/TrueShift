from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.exceptions import AppError, NotFoundError
from app.models.user import User
from app.repositories.shift_repository import ShiftRepository
from app.schemas.auth import Role
from app.schemas.org import ShiftCreate, ShiftOut, ShiftUpdate

router = APIRouter(prefix="/shifts", tags=["Shifts"])


def _validate_time_range(start_time: str, end_time: str) -> None:
    try:
        datetime.strptime(start_time, "%H:%M")
        datetime.strptime(end_time, "%H:%M")
    except ValueError as exc:
        raise AppError("start_time/end_time must be in HH:MM 24-hour format") from exc


def _to_out(shift) -> ShiftOut:
    return ShiftOut(
        id=shift.id, name=shift.name, start_time=shift.start_time, end_time=shift.end_time,
        break_duration_minutes=shift.break_duration_minutes,
        grace_period_minutes=shift.grace_period_minutes, created_at=shift.created_at,
    )


@router.post("", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
async def create_shift(
    payload: ShiftCreate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    _validate_time_range(payload.start_time, payload.end_time)
    repo = ShiftRepository(session)
    created = await repo.create(payload.model_dump())
    return _to_out(created)


@router.get("", response_model=list[ShiftOut])
async def list_shifts(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)),
):
    repo = ShiftRepository(session)
    shifts = await repo.list_all()
    return [_to_out(s) for s in shifts]


@router.put("/{shift_id}", response_model=ShiftOut)
async def update_shift(
    shift_id: int,
    payload: ShiftUpdate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = ShiftRepository(session)
    existing = await repo.find_by_id(shift_id)
    if not existing:
        raise NotFoundError("Shift not found")

    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    start = update_data.get("start_time", existing.start_time)
    end = update_data.get("end_time", existing.end_time)
    _validate_time_range(start, end)

    if update_data:
        await repo.update(shift_id, update_data)
    updated = await repo.find_by_id(shift_id)
    return _to_out(updated)


@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(
    shift_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = ShiftRepository(session)
    if not await repo.find_by_id(shift_id):
        raise NotFoundError("Shift not found")
    await repo.delete(shift_id)
