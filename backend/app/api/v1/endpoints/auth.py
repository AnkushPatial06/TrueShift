import os
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import AppError, PermissionDeniedError
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    Role,
    TokenResponse,
    UserCreate,
    UserOut,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

AVATAR_UPLOAD_DIR = os.path.join("data", "uploads", "avatars")
os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, name=user.name, email=user.email, role=user.role,
        employee_id=user.employee_id, department_id=user.department_id,
        designation=user.designation, is_active=user.is_active,
        work_location=user.work_location, is_remote=user.is_remote,
        profile_photo_url=getattr(user, "profile_photo_url", None),
        created_at=user.created_at,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, session: AsyncSession = Depends(get_db)):
    users = UserRepository(session)
    is_first_user = await users.count() == 0

    if not is_first_user:
        raise PermissionDeniedError(
            "Self-registration is closed. Ask an Admin or HR user to create your account."
        )

    payload.role = Role.ADMIN
    service = AuthService(session)
    created = await service.register_user(payload)
    return _to_user_out(created)


@router.post("/register/by-admin", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_by_admin(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AuthService(session)
    created = await service.register_user(payload)
    return _to_user_out(created)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)):
    service = AuthService(session)
    result = await service.authenticate(payload.email, payload.password)
    return TokenResponse(access_token=result["access_token"], refresh_token=result["refresh_token"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_db)):
    service = AuthService(session)
    new_access_token = await service.refresh_access_token(payload.refresh_token)
    return TokenResponse(access_token=new_access_token, refresh_token=payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, session: AsyncSession = Depends(get_db)):
    service = AuthService(session)
    await service.logout(payload.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return _to_user_out(current_user)


@router.post("/photo", response_model=UserOut)
async def upload_current_user_photo(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise AppError("Only JPEG, PNG, or WEBP image formats are supported.")
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise AppError("Image too large. Maximum file size is 5MB.")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext:
        ext = ".jpg"
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:10]}{ext}"
    path = os.path.join(AVATAR_UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(content)

    photo_url = f"/uploads/avatars/{filename}"
    users = UserRepository(session)
    updated_user = await users.update(current_user.id, {"profile_photo_url": photo_url})
    return _to_user_out(updated_user)
