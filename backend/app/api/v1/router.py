from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    announcements,
    attendance,
    auth,
    chat,
    departments,
    documents,
    employees,
    face,
    holidays,
    leaves,
    locations,
    ml,
    notifications,
    org,
    reports,
    security,
    shifts,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(security.router)
api_router.include_router(departments.router)
api_router.include_router(shifts.router)
api_router.include_router(employees.router)
api_router.include_router(face.router)
api_router.include_router(attendance.router)
api_router.include_router(leaves.router)
api_router.include_router(holidays.router)
api_router.include_router(analytics.router)
api_router.include_router(reports.router)
api_router.include_router(ml.router)
api_router.include_router(chat.router)
api_router.include_router(notifications.router)
api_router.include_router(announcements.router)
api_router.include_router(documents.router)
api_router.include_router(org.router)
api_router.include_router(locations.router)
