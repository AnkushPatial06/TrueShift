"""
Data-access layer for the `users` table.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def find_by_id(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def find_by_employee_id(self, employee_id: str) -> User | None:
        result = await self.session.execute(select(User).where(User.employee_id == employee_id))
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> User:
        data["email"] = data["email"].lower()
        user = User(**data)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user_id: int, data: dict) -> User | None:
        user = await self.find_by_id(user_id)
        if not user:
            return None
        for key, value in data.items():
            setattr(user, key, value)
        user.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def set_active(self, user_id: int, is_active: bool) -> None:
        await self.update(user_id, {"is_active": is_active})

    async def set_face_registered(self, user_id: int, registered: bool) -> None:
        await self.update(user_id, {"face_registered": registered})

    async def count(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(User))
        return result.scalar_one()

    async def list_all(self) -> list[User]:
        result = await self.session.execute(select(User))
        return list(result.scalars().all())

    async def list_by_department(self, department_id: int) -> list[User]:
        result = await self.session.execute(select(User).where(User.department_id == department_id))
        return list(result.scalars().all())
