# Database (MySQL)

All tables are created automatically on backend startup via SQLAlchemy's
`create_all` — no manual migration needed for this build.

## `users`
Auth + employee profile combined. `id` (PK, auto-increment), `name`, `email`
(unique), `hashed_password`, `role`, `employee_id` (unique, nullable),
`department_id`/`shift_id` (FKs), `designation`, `joining_date`, `status`,
`face_registered`, `is_active`, `created_at`, `updated_at`.

## `departments`
`id`, `name`, `code` (unique), `description`, `manager_id`, `created_at`.

## `shifts`
`id`, `name`, `start_time`/`end_time` (HH:MM strings), `break_duration_minutes`,
`grace_period_minutes`, `created_at`.

## `refresh_tokens` / `audit_logs`
Standard auth bookkeeping tables.

## `attendance`
`id`, `employee_id` (FK), `date`, `check_in`/`check_out`, `working_hours`,
`status`, `late_minutes`, `early_departure_minutes`, `overtime_minutes`,
`recognition_score`, `liveness_verified`, `attendance_method`, `location`,
`created_at`, `updated_at`. Unique constraint on `(employee_id, date)`.

## `leave_requests`
`id`, `employee_id` (FK), `leave_type`, `start_date`, `end_date`,
`days_requested`, `reason`, `status`, `decision_comment`, `decided_by` (FK),
`created_at`, `updated_at`. Balances are computed on the fly from approved
requests, not stored as a mutable counter.

## `holidays`
`id`, `name`, `date` (unique), `recurring_yearly`, `created_at`.

## `attendance_anomalies` (Insights)
`id`, `employee_id` (FK), `date`, `anomaly_score`, `description`, `reviewed`,
`detected_at`. Always "potential" — never confirmed misconduct.

## `absenteeism_predictions` (Insights)
`id`, `employee_id` (FK, unique — latest prediction only), `risk_level`,
`risk_probability`, `model_name`, `features` (JSON), `computed_at`.

## Qdrant (vector data, kept separate from MySQL)

### `face_embeddings`
512-dimensional ArcFace vectors, cosine distance. Payload: `{employee_id, angle}`.
