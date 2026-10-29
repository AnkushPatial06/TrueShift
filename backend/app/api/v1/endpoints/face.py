from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import PermissionDeniedError
from app.models.user import User
from app.schemas.auth import Role
from app.schemas.face import FaceRegistrationRequest, FaceRegistrationResponse, FaceStatusResponse
from app.services.face_service import FaceRegistrationService

router = APIRouter(prefix="/face", tags=["Face Registration"])


def _assert_self_or_privileged(current_user: User, employee_id: str) -> None:
    is_privileged = current_user.role in ("admin", "hr")
    is_self = str(current_user.id) == employee_id or current_user.employee_id == employee_id
    if not (is_privileged or is_self):
        raise PermissionDeniedError("You may only manage your own face registration")


@router.post("/register", response_model=FaceRegistrationResponse)
async def register_face(
    payload: FaceRegistrationRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_self_or_privileged(current_user, payload.employee_id)
    service = FaceRegistrationService(session)
    return await service.register(payload)


@router.get("/status/{employee_id}", response_model=FaceStatusResponse)
async def face_status(
    employee_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_self_or_privileged(current_user, employee_id)
    service = FaceRegistrationService(session)
    return await service.status(employee_id)


@router.delete("/register/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_face_registration(
    employee_id: str,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = FaceRegistrationService(session)
    await service.remove(employee_id)
