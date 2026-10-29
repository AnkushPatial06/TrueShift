from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.schemas.auth import Role
from app.schemas.org import DepartmentCreate, DepartmentOut, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["Departments"])


async def _to_out(repo: DepartmentRepository, dept) -> DepartmentOut:
    count = await repo.employee_count(dept.id)
    return DepartmentOut(
        id=dept.id, name=dept.name, code=dept.code, description=dept.description,
        manager_id=dept.manager_id, employee_count=count, created_at=dept.created_at,
    )


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = DepartmentRepository(session)
    if await repo.find_by_code(payload.code):
        raise ConflictError("A department with this code already exists")
    doc = payload.model_dump()
    doc["code"] = doc["code"].upper()
    created = await repo.create(doc)
    return await _to_out(repo, created)


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)),
):
    repo = DepartmentRepository(session)
    depts = await repo.list_all()
    return [await _to_out(repo, d) for d in depts]


@router.put("/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = DepartmentRepository(session)
    existing = await repo.find_by_id(department_id)
    if not existing:
        raise NotFoundError("Department not found")
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if update_data:
        await repo.update(department_id, update_data)
    updated = await repo.find_by_id(department_id)
    return await _to_out(repo, updated)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = DepartmentRepository(session)
    if not await repo.find_by_id(department_id):
        raise NotFoundError("Department not found")
    if await repo.employee_count(department_id) > 0:
        raise ConflictError("Cannot delete a department that still has employees assigned")
    await repo.delete(department_id)
