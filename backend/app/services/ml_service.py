from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.ml.absenteeism import build_training_examples, score_employee, train_and_compare
from app.ai.ml.anomaly import detect_anomalies
from app.core.exceptions import AppError
from app.core.time_utils import local_today
from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.ml_repository import MLRepository
from app.repositories.user_repository import UserRepository


class MLService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)
        self.attendance = AttendanceRepository(session)
        self.ml = MLRepository(session)

    async def run_absenteeism_prediction(self) -> dict:
        users = await self.users.list_all()
        active_users = [u for u in users if u.is_active]

        per_employee_records = {}
        for user in active_users:
            records = await self.attendance.list_for_employee(user.id, limit=365)
            if records:
                per_employee_records[user.id] = records

        if not per_employee_records:
            raise AppError(
                "No attendance history exists yet. Have employees check in/out "
                "a few times before absenteeism prediction can run."
            )

        examples, latest_features = build_training_examples(per_employee_records)
        model_results = train_and_compare(examples)

        if model_results is None:
            raise AppError(
                f"Not enough historical data to train a reliable model yet. "
                f"Need at least {6} employees with {14}+ days of attendance "
                f"history each, with a mix of good and poor attendance. "
                f"Currently have {len(examples)} eligible employee(s)."
            )

        best = max(model_results, key=lambda r: r.f1)

        predictions = []
        for employee_id, features in latest_features.items():
            risk_level, probability = score_employee(best.model, features)
            user = await self.users.find_by_id(employee_id)

            saved = await self.ml.upsert_prediction(employee_id, {
                "risk_level": risk_level,
                "risk_probability": probability,
                "model_name": best.name,
                "features": {
                    "attendance_rate": features.attendance_rate,
                    "absence_count": features.absence_count,
                    "leave_count": features.leave_count,
                    "late_count": features.late_count,
                    "average_working_hours": features.average_working_hours,
                    "overtime_minutes_total": features.overtime_minutes_total,
                    "consecutive_absences": features.consecutive_absences,
                },
            })
            predictions.append({
                "employee_id": employee_id,
                "employee_name": user.name if user else None,
                "risk_level": saved.risk_level,
                "risk_probability": saved.risk_probability,
                "model_name": saved.model_name,
                "features": saved.features,
                "computed_at": saved.computed_at,
            })

        return {
            "predictions": predictions,
            "best_model": best.name,
            "model_comparison": [
                {
                    "model_name": r.name, "accuracy": r.accuracy, "precision": r.precision,
                    "recall": r.recall, "f1_score": r.f1, "confusion_matrix": r.confusion,
                    "trained_on_samples": len(examples),
                    "note": None,
                }
                for r in model_results
            ],
            "trained_on_samples": len(examples),
        }

    async def get_cached_predictions(self) -> list[dict]:
        predictions = await self.ml.list_predictions()
        results = []
        for p in predictions:
            user = await self.users.find_by_id(p.employee_id)
            results.append({
                "employee_id": p.employee_id,
                "employee_name": user.name if user else None,
                "risk_level": p.risk_level,
                "risk_probability": p.risk_probability,
                "model_name": p.model_name,
                "features": p.features,
                "computed_at": p.computed_at,
            })
        return results

    async def run_anomaly_detection(self, lookback_days: int = 90) -> dict:
        today = local_today()
        start = today - timedelta(days=lookback_days)
        records = await self.attendance.list_all_between(start, today)

        if len(records) < 10:
            raise AppError(
                f"Not enough attendance records in the last {lookback_days} days "
                "to run anomaly detection yet."
            )

        flags = detect_anomalies(records)

        saved_anomalies = []
        for flag in flags:
            user = await self.users.find_by_id(flag.employee_id)
            saved = await self.ml.create_anomaly({
                "employee_id": flag.employee_id,
                "date": flag.record_date,
                "anomaly_score": flag.anomaly_score,
                "description": flag.description,
                "reviewed": False,
            })
            saved_anomalies.append({
                "id": saved.id, "employee_id": saved.employee_id,
                "employee_name": user.name if user else None,
                "date": saved.date, "anomaly_score": saved.anomaly_score,
                "description": saved.description, "reviewed": saved.reviewed,
                "detected_at": saved.detected_at,
            })

        return {"anomalies_found": len(saved_anomalies), "anomalies": saved_anomalies}

    async def list_anomalies(self, reviewed: bool | None = None) -> list[dict]:
        anomalies = await self.ml.list_anomalies(reviewed)
        results = []
        for a in anomalies:
            user = await self.users.find_by_id(a.employee_id)
            results.append({
                "id": a.id, "employee_id": a.employee_id,
                "employee_name": user.name if user else None,
                "date": a.date, "anomaly_score": a.anomaly_score,
                "description": a.description, "reviewed": a.reviewed,
                "detected_at": a.detected_at,
            })
        return results

    async def mark_anomaly_reviewed(self, anomaly_id: int) -> None:
        await self.ml.mark_reviewed(anomaly_id)
