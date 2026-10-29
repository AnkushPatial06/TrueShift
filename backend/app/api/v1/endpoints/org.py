from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, require_roles
from app.models.department import Department
from app.models.user import User
from app.schemas.auth import Role

router = APIRouter(prefix="/org", tags=["Organization"])

@router.get("/chart")
async def org_chart(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR, Role.MANAGER)),
):
    # Get all departments
    dept_result = await session.execute(select(Department))
    departments = dept_result.scalars().all()
    
    # Get all active users
    user_result = await session.execute(select(User).where(User.is_active == True))
    users = user_result.scalars().all()
    
    user_by_dept: dict[int | None, list] = {}
    for u in users:
        key = u.department_id
        user_by_dept.setdefault(key, []).append({
            "id": u.id, "name": u.name, "designation": u.designation, "role": u.role,
            "employee_id": u.employee_id, "face_registered": u.face_registered,
        })
    
    result = []
    for dept in departments:
        members = user_by_dept.get(dept.id, [])
        managers = [m for m in members if m["role"] == "manager"]
        employees = [m for m in members if m["role"] == "employee"]
        result.append({
            "id": dept.id, "name": dept.name, "code": dept.code,
            "managers": managers, "employees": employees, "total": len(members),
        })
    
    # Unassigned
    unassigned = user_by_dept.get(None, [])
    if unassigned:
        result.append({"id": None, "name": "Unassigned", "code": "-", "managers": [], "employees": unassigned, "total": len(unassigned)})
    
    return result
