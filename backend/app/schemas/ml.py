from datetime import date, datetime

from pydantic import BaseModel


class AbsenteeismFeatures(BaseModel):
    attendance_rate: float
    absence_count: int
    leave_count: int
    late_count: int
    average_working_hours: float
    overtime_minutes_total: int
    consecutive_absences: int


class AbsenteeismPredictionOut(BaseModel):
    employee_id: int
    employee_name: str | None = None
    risk_level: str
    risk_probability: float
    model_name: str
    features: AbsenteeismFeatures
    computed_at: datetime


class ModelMetrics(BaseModel):
    model_name: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: list[list[int]]
    trained_on_samples: int
    note: str | None = None


class AbsenteeismRunResponse(BaseModel):
    predictions: list[AbsenteeismPredictionOut]
    best_model: str
    model_comparison: list[ModelMetrics]
    trained_on_samples: int


class AnomalyOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    date: date
    anomaly_score: float
    description: str
    reviewed: bool
    detected_at: datetime


class AnomalyRunResponse(BaseModel):
    anomalies_found: int
    anomalies: list[AnomalyOut]
