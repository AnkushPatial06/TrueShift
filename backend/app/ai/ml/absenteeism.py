"""
Absenteeism risk prediction.

Methodology (chosen to avoid fabricating results on a system that may have
very little historical data):
  1. Each employee's attendance history is split chronologically into an
     earlier "features" half and a later "outcome" half.
  2. The label used for TRAINING is derived from the outcome half's actual
     absence rate (>15% absent days => high-risk=1, else 0) — this is a
     real historical outcome, not an invented number.
  3. Logistic Regression and Random Forest are both trained on the features
     half -> label, evaluated with a held-out test split, and compared on
     accuracy/precision/recall/F1/confusion matrix.
  4. The better model (by F1) is then used to score EVERY employee's most
     recent attendance window, producing a LOW/MEDIUM/HIGH risk bucket from
     the predicted probability.

If there isn't enough data to do this meaningfully, the function returns
None rather than inventing numbers — the caller surfaces a clear message
to the user instead of fake metrics.
"""
from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from app.ai.ml.features import EmployeeFeatures, features_to_vector

MIN_EMPLOYEES_TO_TRAIN = 6
MIN_SAMPLE_DAYS_PER_EMPLOYEE = 14
HIGH_RISK_ABSENCE_RATE_THRESHOLD = 0.15

RISK_LOW_MAX = 0.33
RISK_MEDIUM_MAX = 0.66


@dataclass
class TrainingExample:
    employee_id: int
    features: EmployeeFeatures
    label: int  # 1 = was high-absence in the outcome period, 0 = not


@dataclass
class ModelResult:
    name: str
    model: object
    accuracy: float
    precision: float
    recall: float
    f1: float
    confusion: list[list[int]]


def build_training_examples(
    per_employee_records: dict[int, list],
) -> tuple[list[TrainingExample], dict[int, EmployeeFeatures]]:
    """
    per_employee_records: {employee_id: [Attendance rows, any order]}
    Returns (training_examples_for_employees_with_enough_history,
             latest_features_for_ALL_employees_for_scoring).
    """
    training_examples: list[TrainingExample] = []
    latest_features: dict[int, EmployeeFeatures] = {}

    for employee_id, records in per_employee_records.items():
        records_sorted = sorted(records, key=lambda r: r.date)
        if len(records_sorted) < 4:
            continue

        # Always compute "latest window" features (full history) for scoring later
        latest_features[employee_id] = compute_features_local(records_sorted, len(records_sorted))

        if len(records_sorted) < MIN_SAMPLE_DAYS_PER_EMPLOYEE:
            continue

        midpoint = len(records_sorted) // 2
        features_half = records_sorted[:midpoint]
        outcome_half = records_sorted[midpoint:]

        feats = compute_features_local(features_half, len(features_half))
        outcome_absent_rate = sum(1 for r in outcome_half if r.status == "absent") / len(outcome_half)
        label = 1 if outcome_absent_rate > HIGH_RISK_ABSENCE_RATE_THRESHOLD else 0

        training_examples.append(TrainingExample(employee_id=employee_id, features=feats, label=label))

    return training_examples, latest_features


def compute_features_local(records: list, period_days: int) -> EmployeeFeatures:
    from app.ai.ml.features import compute_features
    return compute_features(records, period_days)


def train_and_compare(examples: list[TrainingExample]) -> list[ModelResult] | None:
    if len(examples) < MIN_EMPLOYEES_TO_TRAIN:
        return None

    X = np.array([features_to_vector(e.features) for e in examples])
    y = np.array([e.label for e in examples])

    if len(set(y.tolist())) < 2:
        # Every employee ended up the same label — a real classifier can't be
        # meaningfully evaluated (no contrast to learn from). Don't fabricate.
        return None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )

    results = []
    candidates = {
        "Logistic Regression": LogisticRegression(max_iter=1000),
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
    }
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        results.append(ModelResult(
            name=name,
            model=model,
            accuracy=round(float(accuracy_score(y_test, preds)), 3),
            precision=round(float(precision_score(y_test, preds, zero_division=0)), 3),
            recall=round(float(recall_score(y_test, preds, zero_division=0)), 3),
            f1=round(float(f1_score(y_test, preds, zero_division=0)), 3),
            confusion=confusion_matrix(y_test, preds).tolist(),
        ))
    return results


def risk_bucket(probability: float) -> str:
    if probability <= RISK_LOW_MAX:
        return "low"
    if probability <= RISK_MEDIUM_MAX:
        return "medium"
    return "high"


def score_employee(model, features: EmployeeFeatures) -> tuple[str, float]:
    vector = np.array([features_to_vector(features)])
    proba = model.predict_proba(vector)[0]
    # proba[1] = probability of the "high absence" class
    high_risk_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
    return risk_bucket(high_risk_prob), round(high_risk_prob, 3)
