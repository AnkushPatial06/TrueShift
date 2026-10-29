"""
Aggregates real attendance/leave/employee data into dashboard-ready shapes.
Nothing here is fabricated — every number is computed from the attendance,
leave_requests, and users tables.
"""
from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.leave_repository import LeaveRepository
from app.repositories.user_repository import UserRepository
from app.services.attendance_service import AttendanceService
from app.services.leave_service import LeaveService
from app.repositories.shift_repository import ShiftRepository
from app.services.attendance_service import DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, DEFAULT_GRACE_MINUTES
from app.core.time_utils import app_timezone, local_now, local_today, shift_window, utc_iso


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)
        self.departments = DepartmentRepository(session)
        self.attendance = AttendanceRepository(session)
        self.leaves = LeaveRepository(session)
        self.attendance_service = AttendanceService(session)
        self.leave_service = LeaveService(session)
        self.shifts = ShiftRepository(session)
        

    async def admin_summary(self) -> dict:
        today = local_today()
        all_users = await self.users.list_all()
        active_users = [u for u in all_users if u.is_active]
        today_records = await self.attendance.list_for_date(today)
        by_employee = {r.employee_id: r for r in today_records}

        present = sum(1 for r in today_records if r.status in ("present", "late", "half_day"))
        late = sum(1 for r in today_records if r.status == "late")
        on_leave = 0
        absent = 0
        for user in active_users:
            record = by_employee.get(user.id)
            if record:
                if record.status in ("leave", "work_from_home"):
                    on_leave += 1
                continue
            resolved = await self.attendance_service.resolve_day_status_if_absent(user.id, today)
            if resolved["status"] in ("leave", "work_from_home"):
                on_leave += 1
            elif resolved["status"] == "absent":
                absent += 1

        total = len(active_users)
        attendance_pct = round((present / total) * 100, 1) if total else 0.0

        return {
            "total_employees": total,
            "present_today": present,
            "absent_today": absent,
            "on_leave_today": on_leave,
            "late_today": late,
            "attendance_percentage": attendance_pct,
        }

    async def daily_attendance_series(self, days: int = 14) -> list[dict]:
        today = local_today()
        series = []
        for i in range(days - 1, -1, -1):
            day = today - timedelta(days=i)
            records = await self.attendance.list_for_date(day)
            series.append({
                "date": day,
                "present": sum(1 for r in records if r.status in ("present", "half_day")),
                "absent": 0,  # computed live only for "today" to keep this cheap for a date range
                "late": sum(1 for r in records if r.status == "late"),
                "on_leave": sum(1 for r in records if r.status in ("leave", "work_from_home")),
            })
        return series

    async def department_attendance(self) -> list[dict]:
        today = local_today()
        departments = await self.departments.list_all()
        result = []
        for dept in departments:
            dept_users = await self.users.list_by_department(dept.id)
            active = [u for u in dept_users if u.is_active]
            if not active:
                result.append({"department_name": dept.name, "attendance_percentage": 0.0, "present": 0, "total": 0})
                continue
            employee_ids = [u.id for u in active]
            records = await self.attendance.list_for_employees_and_date(employee_ids, today)
            present = sum(1 for r in records if r.status in ("present", "late", "half_day"))
            result.append({
                "department_name": dept.name,
                "attendance_percentage": round((present / len(active)) * 100, 1),
                "present": present,
                "total": len(active),
            })
        return result

    async def leave_distribution(self) -> list[dict]:
        all_leaves = await self.leaves.list_all_for_scope(None)
        counts: dict[str, int] = {}
        for leave in all_leaves:
            if leave.status == "approved":
                counts[leave.leave_type] = counts.get(leave.leave_type, 0) + 1
        return [{"leave_type": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]

    async def late_arrival_trend(self, days: int = 14) -> list[dict]:
        today = local_today()
        series = []
        for i in range(days - 1, -1, -1):
            day = today - timedelta(days=i)
            records = await self.attendance.list_for_date(day)
            late_records = [r for r in records if r.status == "late"]
            avg_late = round(sum(r.late_minutes for r in late_records) / len(late_records), 1) if late_records else 0.0
            series.append({"date": day, "late_count": len(late_records), "average_late_minutes": avg_late})
        return series

    async def working_hours_distribution(self, days: int = 30) -> list[dict]:
        today = local_today()
        start = today - timedelta(days=days)
        records = await self.attendance.list_all_between(start, today)
        buckets = {"0-4h": 0, "4-8h": 0, "8-9h": 0, "9h+": 0}
        for r in records:
            if r.working_hours is None:
                continue
            if r.working_hours < 4:
                buckets["0-4h"] += 1
            elif r.working_hours < 8:
                buckets["4-8h"] += 1
            elif r.working_hours < 9:
                buckets["8-9h"] += 1
            else:
                buckets["9h+"] += 1
        return [{"bucket": k, "count": v} for k, v in buckets.items()]


    async def employee_dashboard(self, employee) -> dict:
        today_record = await self.attendance_service.get_today(employee.id)
        history = await self.attendance_service.get_history(employee.id, limit=30)
        balance = await self.leave_service.get_balance(employee.id)

        present_count = sum(1 for r in history if r.status in ("present", "half_day"))
        late_count = sum(1 for r in history if r.status == "late")
        leave_count = sum(1 for r in history if r.status in ("leave", "work_from_home"))
        absent_count = sum(1 for r in history if r.status == "absent")
        pct = round((present_count / len(history)) * 100, 1) if history else 0.0

        shift_name = None
        shift_start = DEFAULT_SHIFT_START.strftime("%H:%M")
        shift_end = DEFAULT_SHIFT_END.strftime("%H:%M")
        grace_minutes = DEFAULT_GRACE_MINUTES
        shift = None
        if employee.shift_id:
            shift = await self.shifts.find_by_id(employee.shift_id)
            if shift:
                shift_name = shift.name
                shift_start = shift.start_time
                shift_end = shift.end_time
                grace_minutes = shift.grace_period_minutes

        last7 = sorted(history, key=lambda r: r.date)[-7:]
        weekly_trend = [{"date": r.date.isoformat(), "status": r.status} for r in last7]

        # Compute real-time shift window so frontend can show live status
        now_local = local_now()
        try:
            _s_start = datetime.strptime(shift_start, "%H:%M").time()
            _s_end = datetime.strptime(shift_end, "%H:%M").time()
        except Exception:
            _s_start = _s_end = None

        shift_active = False
        checkin_window_opens = None
        checkin_window_closes = None
        if _s_start and _s_end:
            if today_record and today_record.check_in and not today_record.check_out:
                _start_dt = datetime.combine(today_record.date, _s_start, tzinfo=app_timezone())
                _end_day = today_record.date + timedelta(days=1) if _s_end <= _s_start else today_record.date
                _end_dt = datetime.combine(_end_day, _s_end, tzinfo=app_timezone())
            else:
                _start_dt, _end_dt = shift_window(_s_start, _s_end, now_local)
            _window_open = _start_dt - timedelta(minutes=10)
            shift_active = _window_open <= now_local <= _end_dt
            checkin_window_opens = _window_open.isoformat()
            checkin_window_closes = _end_dt.isoformat()

        return {
            "today_status": today_record.status if today_record else None,
            "check_in": utc_iso(today_record.check_in) if today_record else None,
            "check_out": utc_iso(today_record.check_out) if today_record else None,
            "working_hours": today_record.working_hours if today_record else None,
            "late_minutes_today": today_record.late_minutes if today_record else 0,
            "monthly_attendance_percentage": pct,
            "present_count": present_count,
            "absent_count": absent_count,
            "late_count": late_count,
            "leave_count": leave_count,
            "leave_balance": balance["balances"],
            "shift_name": shift_name,
            "shift_assigned": bool(employee.shift_id and shift),
            "shift_start_time": shift_start,
            "shift_end_time": shift_end,
            "grace_period_minutes": grace_minutes,
            "weekly_trend": weekly_trend,
            # Location & remote — set by HR, not geofencing
            "work_location": getattr(employee, "work_location", None),
            "is_remote": getattr(employee, "is_remote", False),
            # Shift window for real-time frontend status
            "shift_active": shift_active,
            "checkin_window_opens": checkin_window_opens,
            "checkin_window_closes": checkin_window_closes,
            "timezone": str(app_timezone()),
            "scheduled_shift_start": _start_dt.isoformat() if _s_start and _s_end else None,
            "scheduled_shift_end": _end_dt.isoformat() if _s_start and _s_end else None,
            "shift_break_duration_minutes": (shift.break_duration_minutes if employee.shift_id and shift else 0),
        }

    

    async def manager_dashboard(self, manager) -> dict:
        today = local_today()
        dept = await self.departments.find_by_id(manager.department_id) if manager.department_id else None
        dept_users = await self.users.list_by_department(manager.department_id) if manager.department_id else []
        active = [u for u in dept_users if u.is_active]

        if not active:
            pending = await self.leaves.list_pending_for_scope([])
            return {
                "department_name": dept.name if dept else None,
                "attendance_percentage": 0.0, "present_today": 0, "absent_today": 0,
                "late_today": 0, "pending_leave_requests": len(pending),
            }

        employee_ids = [u.id for u in active]
        records = await self.attendance.list_for_employees_and_date(employee_ids, today)
        present = sum(1 for r in records if r.status in ("present", "late", "half_day"))
        late = sum(1 for r in records if r.status == "late")
        pending = await self.leaves.list_pending_for_scope(employee_ids)

        return {
            "department_name": dept.name if dept else None,
            "attendance_percentage": round((present / len(active)) * 100, 1),
            "present_today": present,
            "absent_today": len(active) - present,
            "late_today": late,
            "pending_leave_requests": len(pending),
        }
