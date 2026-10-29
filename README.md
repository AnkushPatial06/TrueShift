# TrueShift — Workforce Intelligence Platform

An AI-powered employee attendance, leave, and analytics platform. Face-verified
check-in, automated leave and holiday management, live dashboards, and
absenteeism/anomaly detection — all backed by a real FastAPI + MySQL backend.

**This build covers Phases 1–7.** Every button in the frontend calls a real
backend endpoint against a real database — nothing here is mocked.

| Area | What's included |
|---|---|
| Auth & RBAC | JWT login, 4 roles (Admin/HR/Manager/Employee) |
| Personnel | Employees, departments, shifts — full CRUD |
| Face ID | Camera-based multi-angle registration, ArcFace embeddings in Qdrant |
| Attendance | Face recognition + liveness (blink/head-movement) + shift rule engine |
| Leave | Apply/approve/reject/cancel, real balance tracking, holidays, WFH |
| Analytics | Live dashboards and Chart.js visualizations, department/leave/late-arrival trends |
| Reports | CSV / Excel / PDF export of real attendance and leave data |
| Insights | Absenteeism risk (Logistic Regression vs Random Forest) + anomaly detection (Isolation Forest) |

---

## 1. Requirements

- Python 3.11+
- **MySQL 8.0+ or MariaDB 10.6+** (local install or a hosted instance)
- A Qdrant instance for Face ID (Phase 3/4):
  - Free tier at [cloud.qdrant.io](https://cloud.qdrant.io/), or self-hosted: `docker run -p 6333:6333 qdrant/qdrant`
- A webcam-equipped browser (Chrome/Edge recommended) for Face ID and Attendance pages
- **Internet access at least once** — the face embedder downloads ~300MB of model weights on first use (see note below)

### InsightFace model download (one-time)
The first time you hit a face-registration or attendance endpoint, InsightFace
downloads its `buffalo_l` model pack automatically. This needs internet once;
weights are then cached locally (`~/.insightface/models`) and never
re-downloaded. Everything else in TrueShift works independently of this.

---

## 2. Set up MySQL

**Option A — install locally (Windows):**
1. Download MySQL Community Server: https://dev.mysql.com/downloads/mysql/
2. During setup, set a root password you'll remember
3. Once installed, open MySQL Command Line Client (or MySQL Workbench) and run:
   ```sql
   CREATE DATABASE trueshift;
   CREATE USER 'trueshift_user'@'localhost' IDENTIFIED BY 'your-password-here';
   GRANT ALL PRIVILEGES ON trueshift.* TO 'trueshift_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

**Option B — hosted MySQL** (PlanetScale, Railway, AWS RDS, etc.) — just get the
host, port, username, password, and database name from your provider.

You do **not** need to create any tables — TrueShift creates them automatically
on first startup.

---

## 3. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

| Variable | Required? | Notes |
|---|---|---|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | **Yes** | From step 2 above |
| `JWT_SECRET_KEY` | **Yes** | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `CORS_ORIGINS` | Yes if frontend port differs | Comma-separated origins |
| `APP_TIMEZONE` | No | IANA timezone for shift windows and attendance dates; defaults to `Asia/Kolkata` (for example, `Asia/Kolkata` or `America/New_York`). |
| `QDRANT_URL` | **Yes for Face ID** | Qdrant Cloud URL or `http://localhost:6333` |
| `QDRANT_API_KEY` | Yes if using Qdrant Cloud | From your cluster settings |

Run the server:
```bash
uvicorn app.main:app --reload --port 8000
```

- Health check: `http://localhost:8000/health`
- Interactive API docs: `http://localhost:8000/docs`
- All tables and Qdrant collections are created automatically on startup.

---

## 4. Frontend setup

```bash
cd frontend
python3 -m http.server 5500
```
Open `http://localhost:5500`.

---

## 5. First-time walkthrough

### 5.1 Create the first Admin account
Via Swagger UI (`http://localhost:8000/docs` → `POST /api/v1/auth/register` → Try it out):
```json
{ "name": "Alex Rivers", "email": "alex@yourcompany.com", "password": "StrongPass123" }
```
This first account always becomes Admin.

### 5.2 Set up departments and shifts
Log into the frontend, go to **Personnel** to add a department, and **Shifts** to
configure working hours and grace periods.

### 5.3 Create employees, register faces, mark attendance
Same flow as before — **Personnel** to create employees, **Face ID** to capture
their 3 angles, **Attendance** to check in/out.

### 5.4 Apply and approve leave
**Leave** page — employees apply, Managers/HR/Admin see a scoped pending-approvals table.

### 5.5 Explore Analytics, Reports, and Insights (Admin/HR only)
- **Analytics** — live charts: daily attendance, department comparison, leave
  distribution, late-arrival trend, working-hours histogram
- **Reports** — download real CSV/Excel/PDF exports
- **Insights** — click "Run absenteeism prediction" and "Run anomaly scan."
  With a fresh database, these will honestly tell you there isn't enough
  historical data yet — that's by design, not a bug. Once you have several
  employees with a few weeks of attendance history, real predictions appear.

---

## 6. How to test each area

- **Auth/RBAC**: register the bootstrap Admin, confirm a second `/auth/register` call is rejected (403), confirm `/auth/register/by-admin` works with a valid Admin token.
- **Personnel**: create a department, a shift, an employee assigned to both — confirm the employee list shows enriched department/shift names.
- **Face ID**: capture all 3 angles for an employee, confirm `face_registered` flips to true after ≥2 accepted angles.
- **Attendance**: check in — confirm similarity score, liveness, and late/present status are all populated realistically; try checking in twice the same day (expect 409).
- **Leave**: apply for leave, approve it as a Manager/HR, confirm the balance updates only after approval; try exceeding the annual allocation (expect 409).
- **Analytics**: after a few days of check-ins/leaves, confirm the charts show real, moving numbers.
- **Reports**: download all three formats, open each to confirm the data matches what's in the app.
- **Insights**: with only 1-2 employees, confirm it honestly reports insufficient data; add more employees with attendance history and re-run to see it train and score for real.

---

## 7. Known limitations (by design)

- No RAG-based HR assistant yet (reserved for a future phase) — `data/hr_policies/` is unused for now.
- No rate limiting or a full automated test suite yet.
- No production Docker Compose orchestration yet — `Dockerfile` is a working single-service build; full multi-container orchestration is a later improvement.
- Absenteeism prediction needs a minimum of ~6 employees with 14+ days of attendance history each (with a genuine mix of good/poor attendance) to train — this is a real methodological requirement, not an arbitrary limit, and the app tells you plainly when it isn't met.

---

## 8. Project structure

```
trueshift/
├── backend/
│   └── app/
│       ├── main.py                 MySQL + Qdrant lifespan, CORS, router
│       ├── core/                   config, database (SQLAlchemy), qdrant, security, exceptions
│       ├── models/                 SQLAlchemy ORM models (users, departments, shifts,
│       │                           attendance, leave_requests, holidays, ml outputs)
│       ├── api/v1/endpoints/       auth, departments, shifts, employees, face,
│       │                           attendance, leaves, holidays, analytics, reports, ml
│       ├── services/                business logic per domain
│       ├── repositories/            SQLAlchemy queries per table
│       ├── ai/face/                 detector, quality, embedder, recognizer, liveness
│       ├── ai/ml/                   feature engineering, absenteeism model, anomaly detection
│       └── vector/qdrant_store.py   Qdrant repository for face embeddings
├── frontend/
│   ├── pages/                      login, dashboard, employees, shifts, face-registration,
│   │                               attendance, leave, analytics, reports, insights
│   ├── js/                          one file per page + shared api.js/utils.js
│   └── css/                         design system
└── docs/                            architecture.md, database.md, api.md, ml.md
```
