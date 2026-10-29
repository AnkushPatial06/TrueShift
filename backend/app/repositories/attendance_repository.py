from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance


class AttendanceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_for_date(self, employee_id: int, day: date) -> Attendance | None:
        result = await self.session.execute(
            select(Attendance).where(Attendance.employee_id == employee_id, Attendance.date == day)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> Attendance:
        record = Attendance(**data)
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def update_for_date(self, employee_id: int, day: date, data: dict) -> Attendance | None:
        record = await self.find_for_date(employee_id, day)
        if not record:
            return None
        for key, value in data.items():
            setattr(record, key, value)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def list_for_employee(self, employee_id: int, limit: int = 60) -> list[Attendance]:
        result = await self.session.execute(
            select(Attendance)
            .where(Attendance.employee_id == employee_id)
            .order_by(Attendance.date.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_for_date(self, day: date) -> list[Attendance]:
        result = await self.session.execute(select(Attendance).where(Attendance.date == day))
        return list(result.scalars().all())

    async def list_for_employees_and_date(self, employee_ids: list[int], day: date) -> list[Attendance]:
        if not employee_ids:
            return []
        result = await self.session.execute(
            select(Attendance).where(Attendance.employee_id.in_(employee_ids), Attendance.date == day)
        )
        return list(result.scalars().all())

    async def list_between(self, employee_id: int, start: date, end: date) -> list[Attendance]:
        result = await self.session.execute(
            select(Attendance).where(
                Attendance.employee_id == employee_id,
                Attendance.date >= start,
                Attendance.date <= end,
            )
        )
        return list(result.scalars().all())

    async def list_all_between(self, start: date, end: date) -> list[Attendance]:
        result = await self.session.execute(
            select(Attendance).where(Attendance.date >= start, Attendance.date <= end)
        )
        return list(result.scalars().all())
