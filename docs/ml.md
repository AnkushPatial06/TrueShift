# Machine Learning

## Absenteeism prediction

**Methodology:** each employee's attendance history is split chronologically
into an earlier "features" half and a later "outcome" half. The outcome
half's real absence rate becomes the training label (>15% absent days =
high-risk). Logistic Regression and Random Forest are trained on the
features half, evaluated on a held-out split, and compared on accuracy,
precision, recall, F1, and confusion matrix — all computed from real data.
The better model (by F1) then scores every employee's most recent window,
bucketing the predicted probability into LOW/MEDIUM/HIGH.

**Minimum data requirement:** at least 6 employees with 14+ days of
attendance history each, with a genuine mix of outcomes (not everyone the
same risk level — a classifier needs contrast to learn from). If this isn't
met, the API returns a clear message rather than fabricated metrics.

**Honesty by design:** this is a deliberately simple, auditable methodology
appropriate for a live system with limited historical data — not a
production-grade forecasting model. It will not report suspiciously perfect
numbers with a tiny company, because the code refuses to run rather than
overfit-and-report.

## Anomaly detection

Isolation Forest run over check-in time, working hours, late minutes, and
overtime minutes across attendance records. Flags roughly the most unusual
10% of records as **potential** anomalies with a human-readable description
of what looked unusual — never labeled as confirmed misconduct. Requires at
least 10 attendance records with a check-in time to run.

## Reserved for later
A RAG-based HR policy assistant is planned but not part of this build.
