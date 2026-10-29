from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.department import Department
from app.models.user import User


class DepartmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> Department:
        dept = Department(**data)
        self.session.add(dept)
        await self.session.commit()
        await self.session.refresh(dept)
        return dept

    async def find_by_id(self, dept_id: int) -> Department | None:
        return await self.session.get(Department, dept_id)

    async def find_by_code(self, code: str) -> Department | None:
        result = await self.session.execute(select(Department).where(Department.code == code.upper()))
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Department]:
        result = await self.session.execute(select(Department))
        return list(result.scalars().all())

    async def update(self, dept_id: int, data: dict) -> None:
        dept = await self.find_by_id(dept_id)
        if dept:
            for key, value in data.items():
                setattr(dept, key, value)
            await self.session.commit()

    async def delete(self, dept_id: int) -> None:
        dept = await self.find_by_id(dept_id)
        if dept:
            await self.session.delete(dept)
            await self.session.commit()

    async def employee_count(self, dept_id: int) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(User).where(User.department_id == dept_id)
        )
        return result.scalar_one()
