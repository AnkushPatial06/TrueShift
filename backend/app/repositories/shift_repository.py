from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shift import Shift


class ShiftRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> Shift:
        shift = Shift(**data)
        self.session.add(shift)
        await self.session.commit()
        await self.session.refresh(shift)
        return shift

    async def find_by_id(self, shift_id: int) -> Shift | None:
        return await self.session.get(Shift, shift_id)

    async def list_all(self) -> list[Shift]:
        result = await self.session.execute(select(Shift))
        return list(result.scalars().all())

    async def update(self, shift_id: int, data: dict) -> None:
        shift = await self.find_by_id(shift_id)
        if shift:
            for key, value in data.items():
                setattr(shift, key, value)
            await self.session.commit()

    async def delete(self, shift_id: int) -> None:
        shift = await self.find_by_id(shift_id)
        if shift:
            await self.session.delete(shift)
            await self.session.commit()
