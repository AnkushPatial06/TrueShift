from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import PermissionDeniedError
from app.models.user import User
from app.schemas.auth import Role
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary")
async def summary(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AnalyticsService(session)
    return await service.admin_summary()


@router.get("/daily-attendance")
async def daily_attendance(
    days: int = Query(default=14, le=90),
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AnalyticsService(session)
    return await service.daily_attendance_series(days)


@router.get("/department-attendance")
async def department_attendance(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AnalyticsService(session)
    return await service.department_attendance()


@router.get("/leave-distribution")
async def leave_distribution(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AnalyticsService(session)
    return await service.leave_distribution()


@router.get("/late-arrival-trend")
async def late_arrival_trend(
    days: int = Query(default=14, le=90),
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AnalyticsService(session)
    return await service.late_arrival_trend(days)


@router.get("/working-hours-distribution")
async def working_hours_distribution(
    days: int = Query(default=30, le=180),
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = AnalyticsService(session)
    return await service.working_hours_distribution(days)


@router.get("/my-dashboard")
async def my_dashboard(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AnalyticsService(session)
    if current_user.role == "manager":
        return await service.manager_dashboard(current_user)
    if current_user.role in ("admin", "hr"):
        return await service.admin_summary()
    return await service.employee_dashboard(current_user)
