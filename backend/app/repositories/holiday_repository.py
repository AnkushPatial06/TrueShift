from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leave import Holiday


class HolidayRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> Holiday:
        holiday = Holiday(**data)
        self.session.add(holiday)
        await self.session.commit()
        await self.session.refresh(holiday)
        return holiday

    async def find_by_id(self, holiday_id: int) -> Holiday | None:
        return await self.session.get(Holiday, holiday_id)

    async def find_by_date(self, day: date) -> Holiday | None:
        result = await self.session.execute(select(Holiday).where(Holiday.date == day))
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Holiday]:
        result = await self.session.execute(select(Holiday).order_by(Holiday.date.asc()))
        return list(result.scalars().all())

    async def delete(self, holiday_id: int) -> None:
        holiday = await self.find_by_id(holiday_id)
        if holiday:
            await self.session.delete(holiday)
            await self.session.commit()
