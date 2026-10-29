import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db, require_roles
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.auth import Role
from app.core.config import get_settings
import os, shutil

router = APIRouter(prefix="/chat", tags=["Chat"])
active_connections: dict[int, list[WebSocket]] = {}  # user_id -> [WebSocket]

class SendMessageRequest(BaseModel):
    receiver_id: Optional[int] = None
    content: str
    message_type: str = "text"
    is_broadcast: bool = False

def _msg_out(msg: ChatMessage, sender_name: str = None) -> dict:
    return {
        "id": msg.id, "sender_id": msg.sender_id, "receiver_id": msg.receiver_id,
        "content": msg.content, "message_type": msg.message_type, "file_url": msg.file_url,
        "file_name": msg.file_name, "is_read": msg.is_read, "is_broadcast": msg.is_broadcast,
        "created_at": msg.created_at.isoformat(), "sender_name": sender_name,
    }

async def notify_user(user_id: int, data: dict):
    if user_id in active_connections:
        dead = []
        for ws in active_connections[user_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            active_connections[user_id].remove(ws)

@router.websocket("/ws/{user_id}")
async def chat_websocket(websocket: WebSocket, user_id: int):
    await websocket.accept()
    active_connections.setdefault(user_id, []).append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            event = json.loads(data)
            if event.get("type") == "typing":
                receiver_id = event.get("receiver_id")
                if receiver_id:
                    await notify_user(receiver_id, {"type": "typing", "user_id": user_id})
    except WebSocketDisconnect:
        if user_id in active_connections:
            active_connections[user_id] = [ws for ws in active_connections[user_id] if ws != websocket]

@router.get("/conversations")
async def get_conversations(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Returns unique conversation partners + broadcasts
    stmt = select(ChatMessage).where(
        or_(ChatMessage.sender_id == current_user.id, ChatMessage.receiver_id == current_user.id, ChatMessage.is_broadcast == True)
    ).order_by(ChatMessage.created_at.desc())
    result = await session.execute(stmt)
    messages = result.scalars().all()
    
    seen = set()
    conversations = []
    for msg in messages:
        if msg.is_broadcast:
            if "broadcast" not in seen:
                seen.add("broadcast")
                conversations.append({"type": "broadcast", "id": "broadcast", "name": "HR Broadcasts", "last_message": msg.content, "last_at": msg.created_at.isoformat(), "unread": 0})
        else:
            other_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
            if other_id and other_id not in seen:
                seen.add(other_id)
                other = await session.get(User, other_id)
                unread_stmt = select(ChatMessage).where(
                    and_(ChatMessage.sender_id == other_id, ChatMessage.receiver_id == current_user.id, ChatMessage.is_read == False)
                )
                unread_res = await session.execute(unread_stmt)
                unread_count = len(unread_res.scalars().all())
                conversations.append({"type": "direct", "id": other_id, "name": other.name if other else str(other_id), "last_message": msg.content, "last_at": msg.created_at.isoformat(), "unread": unread_count})
    return conversations

@router.get("/messages/{conversation_id}")
async def get_messages(
    conversation_id: str,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conversation_id == "broadcast":
        stmt = select(ChatMessage).where(ChatMessage.is_broadcast == True).order_by(ChatMessage.created_at.desc()).limit(limit)
    else:
        other_id = int(conversation_id)
        stmt = select(ChatMessage).where(
            or_(
                and_(ChatMessage.sender_id == current_user.id, ChatMessage.receiver_id == other_id),
                and_(ChatMessage.sender_id == other_id, ChatMessage.receiver_id == current_user.id),
            )
        ).order_by(ChatMessage.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    messages = result.scalars().all()
    
    # Mark as read
    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.is_read:
            msg.is_read = True
    await session.commit()
    
    # Get sender names
    out = []
    sender_cache = {}
    for msg in reversed(messages):
        if msg.sender_id not in sender_cache:
            sender = await session.get(User, msg.sender_id)
            sender_cache[msg.sender_id] = sender.name if sender else str(msg.sender_id)
        out.append(_msg_out(msg, sender_cache[msg.sender_id]))
    return out

@router.post("/messages")
async def send_message(
    payload: SendMessageRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.is_broadcast and current_user.role not in ("admin", "hr"):
        raise HTTPException(403, "Only admin/hr can broadcast")
    msg = ChatMessage(
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        content=payload.content,
        message_type=payload.message_type,
        is_broadcast=payload.is_broadcast,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    out = _msg_out(msg, current_user.name)
    # Push via WebSocket
    if payload.receiver_id:
        await notify_user(payload.receiver_id, {"type": "new_message", "message": out})
    return out

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    upload_dir = os.path.join("data", "uploads", "chat")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(upload_dir, unique_name)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    file_url = f"/uploads/chat/{unique_name}"
    return {"file_url": file_url, "file_name": file.filename}


# ── Employee-to-HR conversation helpers ──────────────────────────────────────

@router.post("/hr/start")
async def start_hr_conversation(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Employee calls this to start (or resume) their HR conversation.
    Finds the first available HR user, creates a welcome system message
    if this is the first contact, and returns the HR user's ID to use
    as conversation_id in subsequent /chat/messages calls.
    """
    # 1. Find any active HR user
    stmt = select(User).where(User.role == "hr", User.is_active == True).limit(1)
    result = await session.execute(stmt)
    hr_user = result.scalars().first()

    # Fallback to admin if no HR user exists
    if not hr_user:
        stmt2 = select(User).where(User.role == "admin", User.is_active == True).limit(1)
        result2 = await session.execute(stmt2)
        hr_user = result2.scalars().first()

    if not hr_user:
        raise HTTPException(status_code=503, detail="No HR team member is available right now.")

    # 2. Check whether a conversation already exists
    existing_stmt = select(ChatMessage).where(
        or_(
            and_(ChatMessage.sender_id == current_user.id, ChatMessage.receiver_id == hr_user.id),
            and_(ChatMessage.sender_id == hr_user.id, ChatMessage.receiver_id == current_user.id),
        )
    ).limit(1)
    existing_result = await session.execute(existing_stmt)
    is_new = existing_result.scalars().first() is None

    # 3. If brand-new, drop a friendly system greeting from the HR user
    if is_new:
        greeting = ChatMessage(
            sender_id=hr_user.id,
            receiver_id=current_user.id,
            content=(
                f"Hi {current_user.name}! Welcome to HR Support. "
                "Your message has been received and an HR representative will respond here shortly. "
                "Feel free to ask about leave policies, payroll, onboarding, or anything else."
            ),
            message_type="system",
            is_broadcast=False,
            is_read=False,
        )
        session.add(greeting)
        await session.commit()

    return {
        "hr_user_id": hr_user.id,
        "hr_name": hr_user.name,
        "is_new": is_new,
    }


@router.get("/hr/conversations")
async def get_hr_conversations(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.HR)),
):
    """
    HR/Admin: Returns all employee conversations sorted by most recent activity.
    Shows employee name, department, last message, unread count.
    """
    from sqlalchemy import func

    # All active employees
    emp_stmt = select(User).where(User.role == "employee", User.is_active == True)
    emp_result = await session.execute(emp_stmt)
    employees = emp_result.scalars().all()

    conversations = []
    for emp in employees:
        # Last message in this dyad (either direction)
        last_stmt = select(ChatMessage).where(
            or_(
                and_(ChatMessage.sender_id == emp.id, ChatMessage.receiver_id == current_user.id),
                and_(ChatMessage.sender_id == current_user.id, ChatMessage.receiver_id == emp.id),
            )
        ).order_by(ChatMessage.created_at.desc()).limit(1)
        last_result = await session.execute(last_stmt)
        last_msg = last_result.scalars().first()
        if not last_msg:
            continue  # No conversation with this employee yet

        # Unread messages sent by the employee to this HR user
        unread_stmt = select(func.count()).select_from(ChatMessage).where(
            ChatMessage.sender_id == emp.id,
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False,
        )
        unread_result = await session.execute(unread_stmt)
        unread_count = unread_result.scalar() or 0

        conversations.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "employee_role": emp.role,
            "last_message": last_msg.content,
            "last_at": last_msg.created_at.isoformat(),
            "unread": unread_count,
        })

    conversations.sort(key=lambda x: x["last_at"], reverse=True)
    return conversations
