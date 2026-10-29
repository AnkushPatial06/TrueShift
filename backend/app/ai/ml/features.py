"""
Turns an employee's raw attendance rows into the feature vector described
in the spec: attendance_rate, absence_count, leave_count, late_count,
average_working_hours, overtime, consecutive_absences, shift, department.

Two feature sets are computed per employee — one from the earlier half of
their history (used as training/prediction INPUT) and one from the more
recent half (used only during training, as the outcome to predict). This
avoids the circularity of predicting a label computed from the same data
used as input.
"""
from dataclasses import dataclass
from datetime import date


@dataclass
class EmployeeFeatures:
    attendance_rate: float
    absence_count: int
    leave_count: int
    late_count: int
    average_working_hours: float
    overtime_minutes_total: int
    consecutive_absences: int
    sample_days: int


def _max_consecutive(statuses: list[str], target: str) -> int:
    best = current = 0
    for s in statuses:
        if s == target:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def compute_features(attendance_records: list, period_days: int) -> EmployeeFeatures:
    """
    attendance_records: list of Attendance ORM rows for one employee, any order.
    period_days: the number of calendar days the period actually spans (used
    as the denominator for attendance_rate so employees with different
    tenure/history lengths are comparable).
    """
    records = sorted(attendance_records, key=lambda r: r.date)
    statuses = [r.status for r in records]

    absence_count = sum(1 for s in statuses if s == "absent")
    leave_count = sum(1 for s in statuses if s in ("leave", "work_from_home"))
    late_count = sum(1 for s in statuses if s == "late")
    present_like = sum(1 for s in statuses if s in ("present", "late", "half_day"))

    working_hours = [r.working_hours for r in records if r.working_hours is not None]
    avg_hours = round(sum(working_hours) / len(working_hours), 2) if working_hours else 0.0

    overtime_total = sum(r.overtime_minutes or 0 for r in records)
    consecutive_absences = _max_consecutive(statuses, "absent")

    attendance_rate = round(present_like / period_days, 3) if period_days > 0 else 0.0

    return EmployeeFeatures(
        attendance_rate=attendance_rate,
        absence_count=absence_count,
        leave_count=leave_count,
        late_count=late_count,
        average_working_hours=avg_hours,
        overtime_minutes_total=overtime_total,
        consecutive_absences=consecutive_absences,
        sample_days=len(records),
    )


def features_to_vector(f: EmployeeFeatures) -> list[float]:
    return [
        f.attendance_rate,
        float(f.absence_count),
        float(f.leave_count),
        float(f.late_count),
        f.average_working_hours,
        float(f.overtime_minutes_total),
        float(f.consecutive_absences),
    ]
