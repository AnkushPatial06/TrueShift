from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.user import User
from app.repositories.holiday_repository import HolidayRepository
from app.schemas.auth import Role
from app.schemas.leave import HolidayCreate, HolidayOut

router = APIRouter(prefix="/holidays", tags=["Holidays"])


def _to_out(h) -> HolidayOut:
    return HolidayOut(id=h.id, name=h.name, date=h.date, recurring_yearly=h.recurring_yearly, created_at=h.created_at)


@router.post("", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
async def create_holiday(
    payload: HolidayCreate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = HolidayRepository(session)
    if await repo.find_by_date(payload.date):
        raise ConflictError("A holiday is already configured for this date")
    created = await repo.create(payload.model_dump())
    return _to_out(created)


@router.get("", response_model=list[HolidayOut])
async def list_holidays(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = HolidayRepository(session)
    holidays = await repo.list_all()
    return [_to_out(h) for h in holidays]


@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holiday(
    holiday_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = HolidayRepository(session)
    if not await repo.find_by_id(holiday_id):
        raise NotFoundError("Holiday not found")
    await repo.delete(holiday_id)
