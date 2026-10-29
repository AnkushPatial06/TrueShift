from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.exceptions import NotFoundError
from app.models.user import User
from app.repositories.ml_repository import MLRepository
from app.schemas.auth import Role
from app.services.ml_service import MLService

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.post("/absenteeism/run")
async def run_absenteeism_prediction(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = MLService(session)
    return await service.run_absenteeism_prediction()


@router.get("/absenteeism/predictions")
async def get_predictions(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = MLService(session)
    return await service.get_cached_predictions()


@router.post("/anomaly/run")
async def run_anomaly_detection(
    lookback_days: int = 90,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = MLService(session)
    return await service.run_anomaly_detection(lookback_days)


@router.get("/anomaly/list")
async def list_anomalies(
    reviewed: bool | None = None,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = MLService(session)
    return await service.list_anomalies(reviewed)


@router.post("/anomaly/{anomaly_id}/review")
async def mark_anomaly_reviewed(
    anomaly_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    repo = MLRepository(session)
    anomalies = await repo.list_anomalies()
    if not any(a.id == anomaly_id for a in anomalies):
        raise NotFoundError("Anomaly not found")
    await repo.mark_reviewed(anomaly_id)
    return {"success": True}

from sqlalchemy import select, func
from app.models.attendance import Attendance
from app.models.leave import LeaveRequest
from app.models.user import User as UserModel
from datetime import datetime, timedelta

@router.get("/shift-swap/recommendations")
async def shift_swap_recommendations(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    """Return employees with high absence counts as swap candidates."""
    stmt = (
        select(Attendance.employee_id, func.count(Attendance.id).label("cnt"))
        .where(Attendance.status == "absent")
        .group_by(Attendance.employee_id)
        .having(func.count(Attendance.id) > 2)
    )
    result = await session.execute(stmt)
    rows = result.all()
    recommendations = []
    for employee_id, count in rows:
        user = await session.get(UserModel, employee_id)
        recommendations.append({
            "employee_id": employee_id,
            "employee_name": user.name if user else str(employee_id),
            "absence_count": count,
            "recommendation": "Consider moving to a later shift to reduce morning absences.",
            "confidence": min(0.95, 0.5 + count * 0.08),
        })
    return recommendations


@router.get("/headcount/forecast")
async def headcount_forecast(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    """7-day ahead forecast using 30-day moving average."""
    thirty_days_ago = datetime.now().date() - timedelta(days=30)
    stmt = (
        select(Attendance.date, func.count(Attendance.id).label("cnt"))
        .where(Attendance.date >= thirty_days_ago, Attendance.status.in_(["present", "late", "half_day"]))
        .group_by(Attendance.date)
    )
    result = await session.execute(stmt)
    rows = result.all()
    daily_counts = [r.cnt for r in rows]
    avg_present = sum(daily_counts) / len(daily_counts) if daily_counts else 0

    forecast = []
    for i in range(1, 8):
        day = datetime.now().date() + timedelta(days=i)
        # Apply slight weekend dip
        weekday = day.weekday()
        factor = 0.65 if weekday >= 5 else 1.0
        forecast.append({
            "date": day.isoformat(),
            "day": day.strftime("%A"),
            "forecasted_headcount": round(avg_present * factor),
        })
    return forecast


@router.get("/face/confidence-tracking")
async def face_confidence_tracking(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    """Per-employee average face recognition confidence score."""
    stmt = (
        select(Attendance.employee_id, func.avg(Attendance.recognition_score).label("avg_score"), func.count(Attendance.id).label("checks"))
        .where(Attendance.recognition_score.isnot(None))
        .group_by(Attendance.employee_id)
    )
    result = await session.execute(stmt)
    rows = result.all()
    out = []
    for row in rows:
        user = await session.get(UserModel, row.employee_id)
        out.append({
            "employee_id": row.employee_id,
            "employee_name": user.name if user else str(row.employee_id),
            "average_confidence": round(float(row.avg_score), 3),
            "check_count": row.checks,
            "face_registered": user.face_registered if user else False,
        })
    return out


@router.get("/leave/clusters")
async def leave_clusters(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    """NLP keyword clustering of leave reasons."""
    stmt = select(LeaveRequest.reason)
    result = await session.execute(stmt)
    reasons = result.scalars().all()

    clusters: dict[str, list[str]] = {
        "Medical / Health": [],
        "Personal / Family": [],
        "Travel / Vacation": [],
        "Emergency": [],
        "Other": [],
    }
    for reason in reasons:
        r = reason.lower()
        if any(w in r for w in ["sick", "doctor", "fever", "hospital", "medical", "health", "surgery"]):
            clusters["Medical / Health"].append(reason)
        elif any(w in r for w in ["family", "personal", "wedding", "marriage", "baby", "child"]):
            clusters["Personal / Family"].append(reason)
        elif any(w in r for w in ["trip", "vacation", "holiday", "travel", "tour"]):
            clusters["Travel / Vacation"].append(reason)
        elif any(w in r for w in ["emergency", "urgent", "accident"]):
            clusters["Emergency"].append(reason)
        else:
            clusters["Other"].append(reason)

    return [{"cluster": k, "count": len(v), "examples": v[:3]} for k, v in clusters.items() if len(v) > 0]


@router.get("/anomaly/{anomaly_id}/explanation")
async def anomaly_explanation(
    anomaly_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    """AI-generated rule-based explanation for an attendance anomaly."""
    repo = MLRepository(session)
    anomalies = await repo.list_anomalies()
    anomaly = next((a for a in anomalies if a.id == anomaly_id), None)
    if not anomaly:
        raise NotFoundError("Anomaly not found")

    atype = getattr(anomaly, "anomaly_type", "Unknown")
    score = getattr(anomaly, "anomaly_score", 0)
    date = getattr(anomaly, "date", "unknown date")

    explanation_map = {
        "Late Arrival": f"This employee arrived significantly later than their scheduled shift start on {date}. The anomaly score of {score:.2f} indicates this is statistically unusual compared to their historical pattern. Recommended action: verify with the employee if there were transport or personal reasons.",
        "Early Departure": f"The employee left significantly earlier than the scheduled shift end on {date}. Score: {score:.2f}. Check if prior approval was obtained or if there was an emergency.",
        "Long Working Hours": f"An unusually long working session was recorded on {date} (score: {score:.2f}). This may indicate unpaid overtime or incorrect check-out. Review with the employee and their manager.",
        "Short Working Hours": f"The recorded working hours on {date} are below the minimum threshold (score: {score:.2f}). This could indicate an early departure, system error, or unapproved half-day.",
    }
    explanation = explanation_map.get(atype, f"An unusual attendance pattern was detected on {date} (score: {score:.2f}). Manual review recommended.")

    return {
        "anomaly_id": anomaly.id,
        "anomaly_type": atype,
        "date": str(date),
        "score": score,
        "explanation": explanation,
    }
