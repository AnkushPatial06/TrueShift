"""CRUD repository for WorkLocation."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import WorkLocation


class LocationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> WorkLocation:
        obj = WorkLocation(**data)
        self.session.add(obj)
        await self.session.commit()
        await self.session.refresh(obj)
        return obj

    async def find_by_id(self, location_id: int) -> WorkLocation | None:
        result = await self.session.execute(
            select(WorkLocation).where(WorkLocation.id == location_id)
        )
        return result.scalar_one_or_none()

    async def find_by_name(self, name: str) -> WorkLocation | None:
        result = await self.session.execute(
            select(WorkLocation).where(func.lower(WorkLocation.name) == name.strip().lower())
        )
        return result.scalar_one_or_none()

    async def list_all(self, active_only: bool = False) -> list[WorkLocation]:
        q = select(WorkLocation)
        if active_only:
            q = q.where(WorkLocation.is_active == True)
        result = await self.session.execute(q.order_by(WorkLocation.name))
        return list(result.scalars().all())

    async def update(self, location_id: int, data: dict) -> WorkLocation | None:
        obj = await self.find_by_id(location_id)
        if not obj:
            return None
        for key, value in data.items():
            setattr(obj, key, value)
        await self.session.commit()
        await self.session.refresh(obj)
        return obj

    async def delete(self, location_id: int) -> bool:
        obj = await self.find_by_id(location_id)
        if not obj:
            return False
        await self.session.delete(obj)
        await self.session.commit()
        return True
