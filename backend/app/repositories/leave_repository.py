from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leave import LeaveRequest


class LeaveRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> LeaveRequest:
        leave = LeaveRequest(**data)
        self.session.add(leave)
        await self.session.commit()
        await self.session.refresh(leave)
        return leave

    async def find_by_id(self, leave_id: int) -> LeaveRequest | None:
        return await self.session.get(LeaveRequest, leave_id)

    async def list_for_employee(self, employee_id: int) -> list[LeaveRequest]:
        result = await self.session.execute(
            select(LeaveRequest)
            .where(LeaveRequest.employee_id == employee_id)
            .order_by(LeaveRequest.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_pending_for_scope(self, employee_ids: list[int] | None = None) -> list[LeaveRequest]:
        query = select(LeaveRequest).where(LeaveRequest.status == "pending")
        if employee_ids is not None:
            query = query.where(LeaveRequest.employee_id.in_(employee_ids))
        query = query.order_by(LeaveRequest.created_at.asc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_all_for_scope(self, employee_ids: list[int] | None = None) -> list[LeaveRequest]:
        query = select(LeaveRequest)
        if employee_ids is not None:
            query = query.where(LeaveRequest.employee_id.in_(employee_ids))
        query = query.order_by(LeaveRequest.created_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, leave_id: int, data: dict) -> LeaveRequest | None:
        leave = await self.find_by_id(leave_id)
        if not leave:
            return None
        for key, value in data.items():
            setattr(leave, key, value)
        await self.session.commit()
        await self.session.refresh(leave)
        return leave

    async def approved_days_used(self, employee_id: int, leave_type: str, year: int) -> int:
        from datetime import date as date_cls

        result = await self.session.execute(
            select(LeaveRequest).where(
                and_(
                    LeaveRequest.employee_id == employee_id,
                    LeaveRequest.leave_type == leave_type,
                    LeaveRequest.status == "approved",
                    LeaveRequest.start_date >= date_cls(year, 1, 1),
                    LeaveRequest.start_date <= date_cls(year, 12, 31),
                )
            )
        )
        return sum(l.days_requested for l in result.scalars().all())

    async def find_active_for_date(self, employee_id: int, day, leave_type: str | None, exclude_wfh: bool) -> LeaveRequest | None:
        query = select(LeaveRequest).where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= day,
            LeaveRequest.end_date >= day,
        )
        if leave_type:
            query = query.where(LeaveRequest.leave_type == leave_type)
        if exclude_wfh:
            query = query.where(LeaveRequest.leave_type != "work_from_home")
        result = await self.session.execute(query)
        return result.scalars().first()
