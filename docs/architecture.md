# Architecture

```
Browser (frontend/, static HTML/CSS/JS, Chart.js for visualizations)
   │  fetch() → JWT bearer tokens, getUserMedia() for camera pages
   ▼
FastAPI app (backend/app/main.py)
   │
   ├── api/v1/endpoints/
   │     auth, departments, shifts, employees, face, attendance,
   │     leaves, holidays, analytics, reports, ml
   │
   ├── services/          business logic per domain
   ├── repositories/       SQLAlchemy async queries, one per table
   ├── models/              SQLAlchemy ORM models
   ├── ai/face/             detector (OpenCV Haar Cascade), quality checks,
   │                        embedder (InsightFace ArcFace), recognizer
   │                        (Qdrant similarity search), liveness (MediaPipe
   │                        FaceMesh — blink + head-movement)
   ├── ai/ml/                feature engineering, absenteeism prediction
   │                        (Logistic Regression / Random Forest), anomaly
   │                        detection (Isolation Forest)
   ├── vector/qdrant_store.py  Qdrant repository for face embeddings
   └── core/                 config, database (SQLAlchemy engine), qdrant,
                              security, exceptions
   │                           ▼
   ▼                        Qdrant (face_embeddings collection)
MySQL
(users, departments, shifts, attendance, leave_requests, holidays,
 refresh_tokens, audit_logs, attendance_anomalies, absenteeism_predictions)
```

## The attendance pipeline, end to end

```
Camera frame(s) → Face Detection (OpenCV) → Quality Check (blur/brightness/size)
   → Face Embedding (InsightFace ArcFace) → Qdrant Similarity Search
   → Liveness Verification (MediaPipe: blink + head movement)
   → Attendance Rule Validation (shift + grace period, duplicate-day check)
   → Mark Attendance in MySQL
```

Nothing marks attendance on face-detection alone — identity match AND
liveness AND a valid rule outcome are all required.

## The absenteeism-prediction pipeline

```
Attendance history per employee
   → split chronologically into "features half" and "outcome half"
   → outcome half's real absence rate becomes the training label
   → Logistic Regression vs Random Forest trained + compared (accuracy,
     precision, recall, F1, confusion matrix — all computed, never fabricated)
   → best model scores every employee's most recent window
   → risk bucketed into LOW / MEDIUM / HIGH from the predicted probability
```

If there isn't enough historical data to train meaningfully, the pipeline
returns a clear message instead of inventing numbers.

## What's reserved for future phases
- `data/hr_policies/` and a dedicated Qdrant collection for HR-policy RAG —
  not built yet.
- Full test suite, rate limiting, multi-container Docker orchestration.
