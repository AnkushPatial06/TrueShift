from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.exceptions import AppError
from app.models.user import User
from app.schemas.auth import Role
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/export")
async def export_report(
    report_type: str = Query(pattern="^(attendance|leave)$"),
    file_format: str = Query(pattern="^(csv|excel|pdf)$"),
    days: int = Query(default=30, le=365),
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    service = ReportService(session)
    try:
        content, filename, media_type = await service.generate(report_type, file_format, days)
    except ValueError as exc:
        raise AppError(str(exc)) from exc

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
