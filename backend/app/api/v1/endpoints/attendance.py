from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import PermissionDeniedError
from app.core.time_utils import utc_iso
from app.models.user import User
from app.schemas.attendance import CheckInRequest, CheckInResponse, CheckOutRequest
from app.schemas.auth import Role
from app.services.attendance_service import AttendanceService
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/attendance", tags=["Attendance"])


def _assert_self_or_privileged(current_user: User, employee_id: str) -> None:
    is_privileged = current_user.role in ("admin", "hr")
    is_self = str(current_user.id) == employee_id or current_user.employee_id == employee_id
    if not (is_privileged or is_self):
        raise PermissionDeniedError("You may only mark your own attendance")


@router.post("/check-in", response_model=CheckInResponse)
async def check_in(
    payload: CheckInRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_self_or_privileged(current_user, payload.employee_id)
    service = AttendanceService(session)
    return await service.check_in(
        payload.employee_id, payload.frame_base64, payload.liveness_frames_base64,
        payload.location, payload.latitude, payload.longitude
    )


@router.post("/check-out", response_model=CheckInResponse)
async def check_out(
    payload: CheckOutRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_self_or_privileged(current_user, payload.employee_id)
    service = AttendanceService(session)
    return await service.check_out(
        payload.employee_id, payload.frame_base64, payload.liveness_frames_base64,
        payload.location, payload.latitude, payload.longitude
    )


@router.get("/today")
async def get_today(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(session)
    record = await service.get_today(current_user.id)
    if not record:
        return {"status": "not_marked", "message": "No attendance recorded yet today"}
    return {
        "status": record.status, "check_in": utc_iso(record.check_in), "check_out": utc_iso(record.check_out),
        "working_hours": record.working_hours, "late_minutes": record.late_minutes,
        "overtime_minutes": record.overtime_minutes,
        "liveness_verified": record.liveness_verified,
        "recognition_score": record.recognition_score,
        "location": record.location,
        "attendance_method": record.attendance_method,
    }


@router.get("/history")
async def get_history(
    limit: int = Query(default=60, le=365),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AttendanceService(session)
    records = await service.get_history(current_user.id, limit)
    return [
        {
            "date": r.date, "check_in": utc_iso(r.check_in), "check_out": utc_iso(r.check_out),
            "working_hours": r.working_hours, "status": r.status,
            "late_minutes": r.late_minutes, "overtime_minutes": r.overtime_minutes,
        }
        for r in records
    ]


@router.get("/employee/{employee_id}")
async def get_employee_history(
    employee_id: int,
    limit: int = Query(default=60, le=365),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_self_or_privileged(current_user, str(employee_id))
    if current_user.role == "manager" and current_user.id != employee_id:
        employee_service = EmployeeService(session)
        await employee_service.get_employee(employee_id, current_user)  # raises if out of scope

    service = AttendanceService(session)
    records = await service.get_history(employee_id, limit)
    return [
        {
            "date": r.date, "check_in": utc_iso(r.check_in), "check_out": utc_iso(r.check_out),
            "working_hours": r.working_hours, "status": r.status,
            "late_minutes": r.late_minutes, "overtime_minutes": r.overtime_minutes,
        }
        for r in records
    ]
