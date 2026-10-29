from datetime import date

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_employees: int
    present_today: int
    absent_today: int
    on_leave_today: int
    late_today: int
    attendance_percentage: float


class DailyAttendancePoint(BaseModel):
    date: date
    present: int
    absent: int
    late: int
    on_leave: int


class DepartmentAttendancePoint(BaseModel):
    department_name: str
    attendance_percentage: float
    present: int
    total: int


class LeaveDistributionPoint(BaseModel):
    leave_type: str
    count: int


class LateArrivalTrendPoint(BaseModel):
    date: date
    late_count: int
    average_late_minutes: float


class WorkingHoursDistributionPoint(BaseModel):
    bucket: str  # e.g. "0-4h", "4-8h", "8-9h", "9h+"
    count: int


class EmployeeDashboard(BaseModel):
    today_status: str | None
    check_in: str | None
    check_out: str | None
    working_hours: float | None
    monthly_attendance_percentage: float
    present_count: int
    absent_count: int
    late_count: int
    leave_count: int
    leave_balance: dict[str, dict[str, int]]


class ManagerDashboard(BaseModel):
    department_name: str | None
    attendance_percentage: float
    present_today: int
    absent_today: int
    late_today: int
    pending_leave_requests: int
