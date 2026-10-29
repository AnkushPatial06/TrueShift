# API Reference

Base URL: `http://localhost:8000/api/v1` · Docs: `http://localhost:8000/docs`

All authenticated routes expect `Authorization: Bearer <access_token>`.

## Auth
`POST /auth/register` (bootstrap Admin only) · `POST /auth/register/by-admin` ·
`POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

## Departments & Shifts
`POST|GET /departments` · `PUT|DELETE /departments/{id}` ·
`POST|GET /shifts` · `PUT|DELETE /shifts/{id}` (admin/hr write, any role read)

## Employees
`POST /employees` (admin/hr) · `GET /employees` (scoped by role) ·
`GET|PUT /employees/{id}` · `DELETE /employees/{id}` (soft-delete)

## Face ID
`POST /face/register` · `GET /face/status/{employee_id}` ·
`DELETE /face/register/{employee_id}` (admin/hr)

## Attendance
`POST /attendance/check-in` · `POST /attendance/check-out` ·
`GET /attendance/today` · `GET /attendance/history` ·
`GET /attendance/employee/{id}` (scoped)

## Leave
`POST /leaves` · `GET /leaves/mine` · `GET /leaves/balance` ·
`GET /leaves/team?pending_only=` (admin/hr/manager) ·
`POST /leaves/{id}/cancel` · `POST /leaves/{id}/approve` · `POST /leaves/{id}/reject`

## Holidays
`POST /holidays` (admin/hr) · `GET /holidays` · `DELETE /holidays/{id}` (admin/hr)

## Analytics (admin/hr, except my-dashboard)
`GET /analytics/summary` · `GET /analytics/daily-attendance?days=` ·
`GET /analytics/department-attendance` · `GET /analytics/leave-distribution` ·
`GET /analytics/late-arrival-trend?days=` ·
`GET /analytics/working-hours-distribution?days=` ·
`GET /analytics/my-dashboard` (any role — content varies by role)

## Reports (admin/hr)
`GET /reports/export?report_type=attendance|leave&file_format=csv|excel|pdf&days=`

## Insights / ML (admin/hr)
`POST /ml/absenteeism/run` · `GET /ml/absenteeism/predictions` ·
`POST /ml/anomaly/run?lookback_days=` · `GET /ml/anomaly/list?reviewed=` ·
`POST /ml/anomaly/{id}/review`

## Health
`GET /health` (no auth)
