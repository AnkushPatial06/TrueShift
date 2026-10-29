from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("")
async def list_notifications(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(50)
    result = await session.execute(stmt)
    notifications = result.scalars().all()
    return [{"id": n.id, "title": n.title, "body": n.body, "type": n.type, "is_read": n.is_read, "link": n.link, "created_at": n.created_at.isoformat()} for n in notifications]

@router.post("/{notif_id}/read")
async def mark_read(
    notif_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await session.execute(update(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id).values(is_read=True))
    await session.commit()
    return {"success": True}

@router.post("/read-all")
async def mark_all_read(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await session.execute(update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False).values(is_read=True))
    await session.commit()
    return {"success": True}
