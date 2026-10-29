"""
Unsupervised anomaly detection over attendance records using Isolation
Forest. Flags POTENTIAL anomalies for HR review — never labels anything as
confirmed misconduct, per the spec.

Features per attendance row:
  - check-in time, expressed as minutes-from-midnight (captures unusually
    early/late check-ins)
  - working_hours (captures unusually short/long days)
  - late_minutes
  - overtime_minutes
"""
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from sklearn.ensemble import IsolationForest

MIN_RECORDS_TO_RUN = 10
CONTAMINATION = 0.1  # assume up to ~10% of records could be flagged as unusual


@dataclass
class AnomalyFlag:
    employee_id: int
    record_date: object
    anomaly_score: float
    description: str


def _minutes_from_midnight(dt: datetime | None) -> float:
    if dt is None:
        return 0.0
    return dt.hour * 60 + dt.minute


def detect_anomalies(records: list) -> list[AnomalyFlag]:
    """
    records: list of Attendance ORM rows across ALL employees (or a scoped
    subset). Returns only the rows flagged as anomalous by the model.
    """
    usable = [r for r in records if r.check_in is not None]
    if len(usable) < MIN_RECORDS_TO_RUN:
        return []

    X = np.array([
        [
            _minutes_from_midnight(r.check_in),
            r.working_hours or 0.0,
            r.late_minutes or 0,
            r.overtime_minutes or 0,
        ]
        for r in usable
    ])

    model = IsolationForest(contamination=CONTAMINATION, random_state=42, n_estimators=200)
    predictions = model.fit_predict(X)  # -1 = anomaly, 1 = normal
    scores = model.decision_function(X)  # lower = more anomalous

    flags: list[AnomalyFlag] = []
    for record, pred, score in zip(usable, predictions, scores):
        if pred != -1:
            continue
        flags.append(AnomalyFlag(
            employee_id=record.employee_id,
            record_date=record.date,
            anomaly_score=round(float(score), 4),
            description=_describe(record),
        ))
    return flags


def _describe(record) -> str:
    reasons = []
    check_in_minutes = _minutes_from_midnight(record.check_in)
    if check_in_minutes < 6 * 60:
        reasons.append("unusually early check-in")
    elif check_in_minutes > 12 * 60:
        reasons.append("unusually late check-in")
    if record.working_hours is not None:
        if record.working_hours > 12:
            reasons.append("unusually long working hours")
        elif record.working_hours < 2:
            reasons.append("unusually short working hours")
    if record.overtime_minutes and record.overtime_minutes > 180:
        reasons.append("large overtime")
    if not reasons:
        reasons.append("attendance pattern flagged as statistically unusual")
    return "Potential anomaly: " + ", ".join(reasons)
