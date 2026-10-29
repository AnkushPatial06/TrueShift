# Import all models so SQLAlchemy metadata is populated for create_all / Alembic
from .base import Base
from .user import User, RefreshToken, AuditLog
from .leave import LeaveRequest, Holiday, LeaveDelegation
from .attendance import Attendance
from .shift import Shift
from .department import Department
from .ml import AbsenteeismPrediction, AttendanceAnomaly
from .chat import ChatMessage
from .notification import Notification
from .announcement import Announcement
from .document import EmployeeDocument
from .session import UserSession
from .location import WorkLocation

__all__ = [
    "Base",
    "User", "RefreshToken", "AuditLog",
    "LeaveRequest", "Holiday", "LeaveDelegation",
    "Attendance",
    "Shift",
    "Department",
    "AbsenteeismPrediction", "AttendanceAnomaly",
    "ChatMessage",
    "Notification",
    "Announcement",
    "EmployeeDocument",
    "UserSession",
    "WorkLocation",
]
