from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, require_roles
from app.models.announcement import Announcement
from app.models.user import User
from app.schemas.auth import Role
from app.core.exceptions import NotFoundError

router = APIRouter(prefix="/announcements", tags=["Announcements"])

class AnnouncementCreate(BaseModel):
    title: str
    body: str
    is_pinned: bool = False

class AnnouncementUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    is_pinned: bool | None = None

def _out(a: Announcement, author_name: str = None) -> dict:
    return {"id": a.id, "author_id": a.author_id, "author_name": author_name, "title": a.title, "body": a.body, "is_pinned": a.is_pinned, "created_at": a.created_at.isoformat(), "updated_at": a.updated_at.isoformat()}

@router.get("")
async def list_announcements(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Announcement).order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).limit(50)
    result = await session.execute(stmt)
    announcements = result.scalars().all()
    out = []
    author_cache = {}
    for a in announcements:
        if a.author_id not in author_cache:
            author = await session.get(User, a.author_id)
            author_cache[a.author_id] = author.name if author else "Unknown"
        out.append(_out(a, author_cache[a.author_id]))
    return out

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    a = Announcement(author_id=current_user.id, title=payload.title, body=payload.body, is_pinned=payload.is_pinned)
    session.add(a)
    await session.commit()
    await session.refresh(a)
    return _out(a, current_user.name)

@router.put("/{ann_id}")
async def update_announcement(
    ann_id: int,
    payload: AnnouncementUpdate,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    a = await session.get(Announcement, ann_id)
    if not a:
        raise NotFoundError("Announcement not found")
    if payload.title is not None: a.title = payload.title
    if payload.body is not None: a.body = payload.body
    if payload.is_pinned is not None: a.is_pinned = payload.is_pinned
    await session.commit()
    await session.refresh(a)
    return _out(a)

@router.delete("/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    ann_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    a = await session.get(Announcement, ann_id)
    if not a:
        raise NotFoundError("Announcement not found")
    await session.delete(a)
    await session.commit()
