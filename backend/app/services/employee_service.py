"""
Business logic for employee management. Employees ARE users (the `users`
table) with additional HR fields; this service composes UserRepository
with Department/Shift repositories to enrich and scope results.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import hash_password
from app.repositories.department_repository import DepartmentRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.user_repository import UserRepository
from app.schemas.employee import EmployeeCreate, EmployeeStatus, EmployeeUpdate


class EmployeeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)
        self.departments = DepartmentRepository(session)
        self.shifts = ShiftRepository(session)

    async def create_employee(self, payload: EmployeeCreate) -> dict:
        if await self.users.find_by_email(payload.email):
            raise ConflictError("A user with this email already exists")
        if await self.users.find_by_employee_id(payload.employee_id):
            raise ConflictError("An employee with this employee_id already exists")

        if payload.department_id and not await self.departments.find_by_id(payload.department_id):
            raise NotFoundError("department_id does not match any department")
        if payload.shift_id and not await self.shifts.find_by_id(payload.shift_id):
            raise NotFoundError("shift_id does not match any shift")

        user_doc = {
            "name": payload.name,
            "email": payload.email,
            "hashed_password": hash_password(payload.password),
            "role": payload.role.value,
            "employee_id": payload.employee_id,
            "department_id": payload.department_id,
            "designation": payload.designation,
            "shift_id": payload.shift_id,
            "joining_date": payload.joining_date,
            "work_location": payload.work_location or ("Remote" if payload.is_remote else "HQ Floor 4"),
            "is_remote": payload.is_remote,
            "profile_photo_url": payload.profile_photo_url,
            "status": EmployeeStatus.ACTIVE.value,
            "face_registered": False,
        }
        created = await self.users.create(user_doc)
        return await self.enrich(created)

    async def update_employee(self, employee_id: int, payload: EmployeeUpdate) -> dict:
        user = await self.users.find_by_id(employee_id)
        if not user:
            raise NotFoundError("Employee not found")

        update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
        if "role" in update_data and update_data["role"] is not None:
            update_data["role"] = update_data["role"].value
        if "status" in update_data and update_data["status"] is not None:
            update_data["status"] = update_data["status"].value

        if update_data.get("department_id") and not await self.departments.find_by_id(update_data["department_id"]):
            raise NotFoundError("department_id does not match any department")
        if update_data.get("shift_id") and not await self.shifts.find_by_id(update_data["shift_id"]):
            raise NotFoundError("shift_id does not match any shift")

        updated = await self.users.update(employee_id, update_data)
        return await self.enrich(updated)

    async def deactivate_employee(self, employee_id: int) -> None:
        user = await self.users.find_by_id(employee_id)
        if not user:
            raise NotFoundError("Employee not found")
        await self.users.set_active(employee_id, False)
        await self.users.update(employee_id, {"status": EmployeeStatus.INACTIVE.value})

    async def get_employee(self, employee_id: int, requester) -> dict:
        user = await self.users.find_by_id(employee_id)
        if not user:
            raise NotFoundError("Employee not found")
        self._assert_can_view(requester, user)
        return await self.enrich(user)

    async def list_employees(self, requester) -> list[dict]:
        role = requester.role
        if role in ("admin", "hr"):
            users = await self.users.list_all()
        elif role == "manager":
            users = await self.users.list_by_department(requester.department_id) if requester.department_id else []
        else:
            raise PermissionDeniedError("Employees should use GET /auth/me for their own profile")

        return [await self.enrich(u) for u in users]

    def _assert_can_view(self, requester, target) -> None:
        role = requester.role
        if role in ("admin", "hr"):
            return
        if role == "manager" and requester.department_id == target.department_id:
            return
        if requester.id == target.id:
            return
        raise PermissionDeniedError("You cannot view this employee's profile")

    async def enrich(self, user) -> dict:
        dept_name = None
        shift_name = None
        if user.department_id:
            dept = await self.departments.find_by_id(user.department_id)
            dept_name = dept.name if dept else None
        if user.shift_id:
            shift = await self.shifts.find_by_id(user.shift_id)
            shift_name = shift.name if shift else None

        return {
            "id": user.id,
            "employee_id": user.employee_id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "department_id": user.department_id,
            "department_name": dept_name,
            "designation": user.designation,
            "shift_id": user.shift_id,
            "shift_name": shift_name,
            "joining_date": user.joining_date,
            "status": user.status,
            "face_registered": user.face_registered,
            "is_active": user.is_active,
            "work_location": getattr(user, "work_location", None),
            "is_remote": getattr(user, "is_remote", False),
            "profile_photo_url": getattr(user, "profile_photo_url", None),
            "created_at": user.created_at,
        }
