"""
API endpoints for managing office/work locations (geofence definitions).
Admin and HR only for CUD operations; all authenticated users can list active locations.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.user import User
from app.repositories.location_repository import LocationRepository
from app.schemas.auth import Role
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/locations", tags=["Work Locations"])


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    payload: LocationCreate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = LocationRepository(session)
    if await repo.find_by_name(payload.name):
        raise ConflictError(f"A location named '{payload.name}' already exists")
    return await repo.create(payload.model_dump())


@router.get("", response_model=list[LocationOut])
async def list_locations(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = LocationRepository(session)
    return await repo.list_all()


@router.get("/{location_id}", response_model=LocationOut)
async def get_location(
    location_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = LocationRepository(session)
    loc = await repo.find_by_id(location_id)
    if not loc:
        raise NotFoundError("Work location not found")
    return loc


@router.put("/{location_id}", response_model=LocationOut)
@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: int,
    payload: LocationUpdate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = LocationRepository(session)
    updated = await repo.update(location_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise NotFoundError("Work location not found")
    return updated


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = LocationRepository(session)
    deleted = await repo.delete(location_id)
    if not deleted:
        raise NotFoundError("Work location not found")
