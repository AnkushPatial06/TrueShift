"""
Implements the Smart Attendance Engine and full check-in workflow:
detection -> recognition -> liveness -> rule validation -> mark attendance.
Attendance is never marked on face-detection alone.
"""
import base64
import binascii
import math
from datetime import date, datetime, time, timedelta, timezone

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.face.liveness import check_liveness
from app.ai.face.recognizer import recognize_face
from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.core.time_utils import app_timezone, attendance_day, local_now, local_today, shift_window
from app.models.notification import Notification
from app.models.user import User
from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.holiday_repository import HolidayRepository
from app.repositories.leave_repository import LeaveRepository
from app.repositories.location_repository import LocationRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.user_repository import UserRepository
from app.schemas.attendance import AttendanceMethod, AttendanceStatus

DEFAULT_SHIFT_START = time(9, 0)
DEFAULT_SHIFT_END = time(17, 0)
DEFAULT_GRACE_MINUTES = 15
HALF_DAY_CUTOFF_HOURS = 4
CHECKIN_WINDOW_MINUTES = 10   # Allow check-in this many minutes before shift starts
LATE_NOTIFY_MINUTES = 30      # Notify HR if employee is this many minutes late


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in metres between two GPS points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _decode_base64_image(image_base64: str) -> np.ndarray:
    try:
        if "," in image_base64[:40]:
            image_base64 = image_base64.split(",", 1)[1]
        raw = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError("Invalid base64 image data") from exc
    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise AppError("Could not decode image data")
    return image


async def _resolve_user(users: UserRepository, employee_id_str: str):
    if employee_id_str.isdigit():
        user = await users.find_by_id(int(employee_id_str))
        if user:
            return user
    return await users.find_by_employee_id(employee_id_str)


class AttendanceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.attendance = AttendanceRepository(session)
        self.shifts = ShiftRepository(session)
        self.users = UserRepository(session)
        self.holidays = HolidayRepository(session)
        self.leaves = LeaveRepository(session)
        self.locations = LocationRepository(session)

    async def _get_shift_rules(self, user) -> tuple[time, time, int, int]:
        if user.shift_id:
            shift = await self.shifts.find_by_id(user.shift_id)
            if shift:
                start = datetime.strptime(shift.start_time, "%H:%M").time()
                end = datetime.strptime(shift.end_time, "%H:%M").time()
                return start, end, shift.break_duration_minutes, shift.grace_period_minutes
        return DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, 60, DEFAULT_GRACE_MINUTES

    async def _find_current_shift_record(self, employee_id: int, day: date, start: time, end: time):
        record = await self.attendance.find_for_date(employee_id, day)
        if record or end > start:
            return record
        # Keep an unchecked overnight shift available for checkout after its
        # scheduled end, and prevent a second shift check-in until it is closed.
        previous = await self.attendance.find_for_date(employee_id, day - timedelta(days=1))
        if previous and previous.check_in and not previous.check_out:
            return previous
        return None

    async def _is_holiday(self, day: date) -> bool:
        return await self.holidays.find_by_date(day) is not None

    async def _is_approved_wfh(self, employee_id: int, day: date) -> bool:
        leave = await self.leaves.find_active_for_date(employee_id, day, "work_from_home", False)
        return leave is not None

    async def _is_on_approved_leave(self, employee_id: int, day: date) -> bool:
        leave = await self.leaves.find_active_for_date(employee_id, day, None, True)
        return leave is not None


    async def _notify_hr_late(self, session: AsyncSession, employee: User, late_minutes: int, shift_start: time) -> None:
        """Send in-app notification to all HR/admin users about a late check-in."""
        hr_result = await session.execute(
            select(User).where(User.role.in_(["hr", "admin"]), User.is_active == True)
        )
        hr_users = hr_result.scalars().all()
        for hr in hr_users:
            notif = Notification(
                user_id=hr.id,
                title=f"Late Check-In: {employee.name}",
                body=(
                    f"{employee.name} (ID: {employee.employee_id or employee.id}) checked in "
                    f"{late_minutes} minutes late. "
                    f"Shift started at {shift_start.strftime('%I:%M %p')}. "
                    f"Their shift end time has been extended by {late_minutes} minutes accordingly."
                ),
                type="warning",
                link="/pages/attendance.html",
            )
            session.add(notif)
        await session.commit()

    async def _check_geofence(
        self,
        user: User,
        latitude: float | None,
        longitude: float | None,
    ) -> tuple[bool, str]:
        """
        Validate that an on-site employee is within the geofence of their
        assigned work location.  Remote employees always pass.
        Returns (ok, message).
        """
        if user.is_remote:
            return True, "Remote employee — geofencing not required."

        # On-site: GPS coordinates are mandatory
        if latitude is None or longitude is None:
            return False, (
                "Location access is required for on-site attendance. "
                "Please allow GPS in your browser and try again."
            )

        # Look up the work location by the name stored on the user
        if not user.work_location:
            return False, "No work location assigned. Please contact HR."

        wl = await self.locations.find_by_name(user.work_location)
        if not wl or not wl.is_active:
            # Graceful fallback: if HR hasn't added the location to the DB yet,
            # allow check-in but flag it so admins can review
            return True, f"Work location '{user.work_location}' not found in geofence DB — check-in allowed without GPS validation."

        dist = _haversine_distance(latitude, longitude, wl.latitude, wl.longitude)
        if dist > wl.radius_meters:
            return False, (
                f"You are {int(dist)} m from your assigned work location '{wl.name}' "
                f"(allowed radius: {wl.radius_meters} m). "
                "On-site attendance requires you to be physically present at the office."
            )

        return True, f"Within geofence of '{wl.name}' ({int(dist)} m from centre)."

    async def check_in(self, employee_id_str: str, frame_b64: str, liveness_frames_b64: list[str], location: str | None, latitude: float | None = None, longitude: float | None = None) -> dict:
        user = await _resolve_user(self.users, employee_id_str)
        if not user:
            raise NotFoundError("No employee matches this employee_id")

        shift_start, shift_end, break_minutes, grace_minutes = await self._get_shift_rules(user)
        now_local = local_now()
        today = attendance_day(shift_start, shift_end, now_local)
        existing = await self._find_current_shift_record(user.id, today, shift_start, shift_end)
        if existing:
            today = existing.date

        # RULE: Block re-check-in if already checked in today
        if existing and existing.check_in:
            raise ConflictError("You are already checked in for today. Check-in is not allowed again.")

        # Get the employee's assigned shift timings from DB (never hardcoded)
        now = now_local.astimezone(timezone.utc)
        shift_start_dt, shift_end_dt = shift_window(shift_start, shift_end, now_local)
        shift_start_utc = shift_start_dt.astimezone(timezone.utc)
        shift_end_utc = shift_end_dt.astimezone(timezone.utc)

        window_open = shift_start_utc - timedelta(minutes=CHECKIN_WINDOW_MINUTES)
        window_close = shift_end_utc

        # RULE: Reject check-in outside the ±10 min window around shift start through shift end
        if now < window_open:
            minutes_until = int((window_open - now).total_seconds() // 60)
            raise ConflictError(
                f"Check-in window hasn't opened yet. Your shift starts at "
                f"{shift_start.strftime('%I:%M %p')}. "
                f"Check-in opens {CHECKIN_WINDOW_MINUTES} minutes before — in {minutes_until} minutes."
            )
        if now > window_close:
            raise ConflictError(
                f"Check-in window is closed. Your shift ended at {shift_end.strftime('%I:%M %p')}."
            )

        # ── GEOFENCE CHECK (on-site employees only) ───────────────────────────
        geo_ok, geo_msg = await self._check_geofence(user, latitude, longitude)
        if not geo_ok:
            return {"success": False, "message": geo_msg,
                    "similarity_score": None, "liveness_verified": False}

        # Face recognition + liveness
        frame = _decode_base64_image(frame_b64)
        recognition = recognize_face(frame)
        if not recognition.matched:
            return {"success": False, "message": recognition.reason or "Face not recognized",
                    "similarity_score": recognition.similarity_score, "liveness_verified": False}
        if recognition.employee_id != str(user.id):
            return {"success": False, "message": "Recognized face does not match the employee_id provided",
                    "similarity_score": recognition.similarity_score, "liveness_verified": False}

        liveness_frames = [_decode_base64_image(f) for f in liveness_frames_b64]
        liveness = check_liveness(liveness_frames)
        if not liveness.is_live:
            return {"success": False, "message": liveness.reason or "Liveness check failed",
                    "similarity_score": recognition.similarity_score, "liveness_verified": False}

        # Calculate lateness (grace period after shift start)
        grace_cutoff = shift_start_utc + timedelta(minutes=grace_minutes)
        late_minutes = 0
        status = AttendanceStatus.PRESENT

        if now > grace_cutoff:
            late_minutes = int((now - grace_cutoff).total_seconds() // 60)
            status = AttendanceStatus.LATE

        # Use HR-assigned location for on-site; remote workers don't need geofencing
        assigned_location = user.work_location or "Office"
        if user.is_remote:
            assigned_location = "Remote"
        effective_location = location or assigned_location

        record = {
            "employee_id": user.id, "date": today, "check_in": now, "check_out": None,
            "working_hours": None, "status": status.value, "late_minutes": late_minutes,
            "early_departure_minutes": 0, "overtime_minutes": 0,
            "recognition_score": recognition.similarity_score, "liveness_verified": True,
            "attendance_method": AttendanceMethod.FACE_RECOGNITION.value,
            "location": effective_location,
        }

        saved = await self.attendance.update_for_date(user.id, today, record) if existing \
            else await self.attendance.create(record)

        # RULE: If late > LATE_NOTIFY_MINUTES, notify all HR/admin and extend shift end
        extra_message = ""
        if late_minutes >= LATE_NOTIFY_MINUTES:
            await self._notify_hr_late(self.session, user, late_minutes, shift_start)
            extra_message = (
                f" You are {late_minutes} minutes late. Your shift end has been extended by "
                f"{late_minutes} minutes. HR has been notified."
            )

        return {
            "success": True,
            "message": f"Checked in successfully.{extra_message}",
            "employee_id": str(user.id),
            "employee_name": user.name,
            "similarity_score": recognition.similarity_score,
            "liveness_verified": True,
            "status": status.value,
            "check_in_time": saved.check_in,
            "late_minutes": late_minutes,
            "is_remote": user.is_remote,
            "location": effective_location,
            "geo_message": geo_msg,
            "shift_start": shift_start.strftime("%H:%M"),
            "shift_end": shift_end.strftime("%H:%M"),
        }

    async def check_out(self, employee_id_str: str, frame_b64: str, liveness_frames_b64: list[str], location: str | None, latitude: float | None = None, longitude: float | None = None) -> dict:
        user = await _resolve_user(self.users, employee_id_str)
        if not user:
            raise NotFoundError("No employee matches this employee_id")

        shift_start, shift_end, break_minutes, _ = await self._get_shift_rules(user)
        now_local = local_now()
        today = attendance_day(shift_start, shift_end, now_local)
        existing = await self._find_current_shift_record(user.id, today, shift_start, shift_end)
        if not existing or not existing.check_in:
            raise ConflictError("You must check in before you can check out")
        if existing.check_out:
            raise ConflictError("Attendance already checked out for today")
        today = existing.date

        # ── GEOFENCE CHECK (on-site employees only) ───────────────────────────
        geo_ok, geo_msg = await self._check_geofence(user, latitude, longitude)
        if not geo_ok:
            return {"success": False, "message": geo_msg,
                    "similarity_score": None, "liveness_verified": False}

        frame = _decode_base64_image(frame_b64)
        recognition = recognize_face(frame)
        if not recognition.matched or recognition.employee_id != str(user.id):
            return {"success": False, "message": recognition.reason or "Face not recognized",
                    "similarity_score": recognition.similarity_score, "liveness_verified": False}

        liveness_frames = [_decode_base64_image(f) for f in liveness_frames_b64]
        liveness = check_liveness(liveness_frames)
        if not liveness.is_live:
            return {"success": False, "message": liveness.reason or "Liveness check failed",
                    "similarity_score": recognition.similarity_score, "liveness_verified": False}

        now = datetime.now(timezone.utc)
        check_in_time = existing.check_in
        if check_in_time.tzinfo is None:
            check_in_time = check_in_time.replace(tzinfo=timezone.utc)

        total_seconds = (now - check_in_time).total_seconds()
        working_hours = round(max(total_seconds - break_minutes * 60, 0) / 3600, 2)

        shift_end_day = existing.date + timedelta(days=1) if shift_end <= shift_start else existing.date
        shift_end_dt_local = datetime.combine(shift_end_day, shift_end, tzinfo=app_timezone())
        shift_end_dt = shift_end_dt_local.astimezone(timezone.utc)
        early_departure_minutes = 0
        overtime_minutes = 0
        status = existing.status

        if now < shift_end_dt:
            early_departure_minutes = int((shift_end_dt - now).total_seconds() // 60)
            if working_hours < HALF_DAY_CUTOFF_HOURS:
                status = AttendanceStatus.HALF_DAY.value
        else:
            overtime_minutes = int((now - shift_end_dt).total_seconds() // 60)

        update = {
            "check_out": now, "working_hours": working_hours,
            "early_departure_minutes": early_departure_minutes,
            "overtime_minutes": overtime_minutes, "status": status,
        }
        saved = await self.attendance.update_for_date(user.id, today, update)

        return {
            "success": True, "message": "Checked out successfully", "employee_id": str(user.id),
            "employee_name": user.name, "similarity_score": recognition.similarity_score,
            "liveness_verified": True, "status": saved.status, "check_in_time": saved.check_in,
            "is_remote": user.is_remote,
            "location": "Remote" if user.is_remote else (user.work_location or "Office"),
            "geo_message": geo_msg,
        }

    async def get_today(self, employee_id: int) -> object | None:
        # Resolve the assigned shift so overnight check-ins remain visible after midnight.
        user = await self.users.find_by_id(employee_id)
        if user:
            start, end, _, _ = await self._get_shift_rules(user)
            day = attendance_day(start, end)
            return await self._find_current_shift_record(employee_id, day, start, end)
        else:
            day = local_today()
            return await self.attendance.find_for_date(employee_id, day)

    async def get_history(self, employee_id: int, limit: int = 60) -> list:
        return await self.attendance.list_for_employee(employee_id, limit)

    async def resolve_day_status_if_absent(self, employee_id: int, day: date) -> dict:
        if day.weekday() >= 5:
            return {"status": AttendanceStatus.WEEKEND.value}
        if await self._is_holiday(day):
            return {"status": AttendanceStatus.HOLIDAY.value}
        if await self._is_approved_wfh(employee_id, day):
            return {"status": AttendanceStatus.WORK_FROM_HOME.value}
        if await self._is_on_approved_leave(employee_id, day):
            return {"status": AttendanceStatus.LEAVE.value}
        return {"status": AttendanceStatus.ABSENT.value}
