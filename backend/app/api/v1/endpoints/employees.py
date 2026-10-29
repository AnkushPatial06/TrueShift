import os
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import AppError, PermissionDeniedError
from app.models.user import User
from app.schemas.auth import Role
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = EmployeeService(session)
    return await service.create_employee(payload)


@router.get("", response_model=list[EmployeeOut])
async def list_employees(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmployeeService(session)
    return await service.list_employees(current_user)


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmployeeService(session)
    return await service.get_employee(employee_id, current_user)


@router.put("/{employee_id}", response_model=EmployeeOut)
@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = EmployeeService(session)
    return await service.update_employee(employee_id, payload)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_employee(
    employee_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = EmployeeService(session)
    await service.deactivate_employee(employee_id)


@router.post("/{employee_id}/photo", response_model=EmployeeOut)
async def upload_employee_photo(
    employee_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_privileged = current_user.role in ("admin", "hr")
    if not (is_privileged or current_user.id == employee_id):
        raise PermissionDeniedError("You do not have permission to change this employee's photo")

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed_types:
        raise AppError("Only JPEG, PNG, or WEBP image formats are supported.")
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise AppError("Image too large. Maximum file size is 5MB.")

    upload_dir = os.path.join("data", "uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    filename = f"emp_{employee_id}_{uuid.uuid4().hex[:10]}{ext}"
    path = os.path.join(upload_dir, filename)

    with open(path, "wb") as f:
        f.write(content)

    photo_url = f"/uploads/avatars/{filename}"
    service = EmployeeService(session)
    return await service.update_employee(employee_id, EmployeeUpdate(profile_photo_url=photo_url))
