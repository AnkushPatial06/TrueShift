from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, ConflictError, NotFoundError, PermissionDeniedError
from app.core.time_utils import local_today
from app.repositories.leave_repository import LeaveRepository
from app.repositories.user_repository import UserRepository
from app.schemas.leave import DEFAULT_LEAVE_ALLOCATIONS, LeaveApplyRequest, LeaveStatus


class LeaveService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.leaves = LeaveRepository(session)
        self.users = UserRepository(session)

    async def apply(self, employee_id: int, payload: LeaveApplyRequest) -> dict:
        days_requested = (payload.end_date - payload.start_date).days + 1

        if payload.leave_type.value in DEFAULT_LEAVE_ALLOCATIONS:
            year = payload.start_date.year
            used = await self.leaves.approved_days_used(employee_id, payload.leave_type.value, year)
            allocation = DEFAULT_LEAVE_ALLOCATIONS[payload.leave_type.value]
            if used + days_requested > allocation:
                raise ConflictError(
                    f"This request would use {used + days_requested} of your {allocation} "
                    f"annual {payload.leave_type.value} leave days"
                )

        doc = {
            "employee_id": employee_id,
            "leave_type": payload.leave_type.value,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "days_requested": days_requested,
            "reason": payload.reason,
            "status": LeaveStatus.PENDING.value,
        }
        created = await self.leaves.create(doc)
        return await self._enrich(created)

    async def cancel(self, leave_id: int, requester) -> dict:
        leave = await self.leaves.find_by_id(leave_id)
        if not leave:
            raise NotFoundError("Leave request not found")
        if leave.employee_id != requester.id:
            raise PermissionDeniedError("You may only cancel your own leave requests")
        if leave.status != LeaveStatus.PENDING.value:
            raise AppError("Only pending leave requests can be cancelled")

        updated = await self.leaves.update(leave_id, {"status": LeaveStatus.CANCELLED.value})
        return await self._enrich(updated)

    async def decide(self, leave_id: int, approve: bool, decider, comment: str | None) -> dict:
        leave = await self.leaves.find_by_id(leave_id)
        if not leave:
            raise NotFoundError("Leave request not found")
        if leave.status != LeaveStatus.PENDING.value:
            raise AppError("This leave request has already been decided")

        if decider.role == "manager":
            employee = await self.users.find_by_id(leave.employee_id)
            if not employee or employee.department_id != decider.department_id:
                raise PermissionDeniedError("You can only approve/reject leave for your own department")

        new_status = LeaveStatus.APPROVED.value if approve else LeaveStatus.REJECTED.value
        updated = await self.leaves.update(leave_id, {
            "status": new_status, "decision_comment": comment, "decided_by": decider.id,
        })
        return await self._enrich(updated)

    async def list_mine(self, employee_id: int) -> list[dict]:
        leaves = await self.leaves.list_for_employee(employee_id)
        return [await self._enrich(l) for l in leaves]

    async def list_for_scope(self, requester, pending_only: bool) -> list[dict]:
        employee_ids = None
        if requester.role == "manager":
            dept_users = await self.users.list_by_department(requester.department_id)
            employee_ids = [u.id for u in dept_users]
        elif requester.role not in ("admin", "hr"):
            raise PermissionDeniedError("Only Admin/HR/Manager may view team leave requests")

        leaves = (
            await self.leaves.list_pending_for_scope(employee_ids)
            if pending_only
            else await self.leaves.list_all_for_scope(employee_ids)
        )
        return [await self._enrich(l) for l in leaves]

    async def get_balance(self, employee_id: int) -> dict:
        year = local_today().year
        balances = {}
        for leave_type, allocation in DEFAULT_LEAVE_ALLOCATIONS.items():
            used = await self.leaves.approved_days_used(employee_id, leave_type, year)
            balances[leave_type] = {
                "allocated": allocation, "used": used, "remaining": max(allocation - used, 0),
            }
        return {"employee_id": employee_id, "balances": balances}

    async def _enrich(self, leave) -> dict:
        employee = await self.users.find_by_id(leave.employee_id)
        return {
            "id": leave.id, "employee_id": leave.employee_id,
            "employee_name": employee.name if employee else None,
            "profile_photo_url": employee.profile_photo_url if employee else None,
            "department": None,  # department name not available without join; frontend falls back to employee_id
            "employee_id_str": employee.employee_id if employee else None,
            "leave_type": leave.leave_type, "start_date": leave.start_date, "end_date": leave.end_date,
            "days_requested": leave.days_requested, "reason": leave.reason, "status": leave.status,
            "decision_comment": leave.decision_comment, "decided_by": leave.decided_by,
            "created_at": leave.created_at, "updated_at": leave.updated_at,
        }
