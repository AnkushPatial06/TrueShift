from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ml import AbsenteeismPrediction, AttendanceAnomaly


class MLRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # --- Anomalies ---
    async def create_anomaly(self, data: dict) -> AttendanceAnomaly:
        anomaly = AttendanceAnomaly(**data)
        self.session.add(anomaly)
        await self.session.commit()
        await self.session.refresh(anomaly)
        return anomaly

    async def list_anomalies(self, reviewed: bool | None = None) -> list[AttendanceAnomaly]:
        query = select(AttendanceAnomaly)
        if reviewed is not None:
            query = query.where(AttendanceAnomaly.reviewed == reviewed)
        query = query.order_by(AttendanceAnomaly.detected_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def mark_reviewed(self, anomaly_id: int) -> None:
        anomaly = await self.session.get(AttendanceAnomaly, anomaly_id)
        if anomaly:
            anomaly.reviewed = True
            await self.session.commit()

    # --- Predictions ---
    async def upsert_prediction(self, employee_id: int, data: dict) -> AbsenteeismPrediction:
        result = await self.session.execute(
            select(AbsenteeismPrediction).where(AbsenteeismPrediction.employee_id == employee_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            for key, value in data.items():
                setattr(existing, key, value)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        else:
            prediction = AbsenteeismPrediction(employee_id=employee_id, **data)
            self.session.add(prediction)
            await self.session.commit()
            await self.session.refresh(prediction)
            return prediction

    async def list_predictions(self) -> list[AbsenteeismPrediction]:
        result = await self.session.execute(select(AbsenteeismPrediction))
        return list(result.scalars().all())
