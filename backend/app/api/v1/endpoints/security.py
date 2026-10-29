import base64
import io
import secrets
from datetime import datetime

import pyotp
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.exceptions import AppError, NotFoundError
from app.models.session import UserSession
from app.models.user import User

router = APIRouter(prefix="/security", tags=["Security"])

class TOTPVerifyRequest(BaseModel):
    code: str

class TOTPSetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_uri: str  # data: URI for a QR code image (generated server-side)

@router.post("/2fa/setup", response_model=TOTPSetupResponse)
async def setup_2fa(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    secret = pyotp.random_base32()
    # Store the secret (but don't enable yet — user must verify first)
    await session.execute(update(User).where(User.id == current_user.id).values(totp_secret=secret))
    await session.commit()
    totp = pyotp.TOTP(secret)
    otpauth_url = totp.provisioning_uri(name=current_user.email, issuer_name="TrueShift")
    # Generate QR code as data URI
    try:
        import qrcode
        import qrcode.image.svg
        qr = qrcode.QRCode()
        qr.add_data(otpauth_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf)
        buf.seek(0)
        qr_b64 = base64.b64encode(buf.read()).decode()
        qr_uri = f"data:image/png;base64,{qr_b64}"
    except ImportError:
        qr_uri = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={otpauth_url}"
    return TOTPSetupResponse(secret=secret, otpauth_url=otpauth_url, qr_uri=qr_uri)

@router.post("/2fa/verify")
async def verify_and_enable_2fa(
    payload: TOTPVerifyRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.totp_secret:
        raise AppError("2FA setup not initiated. Call /security/2fa/setup first.")
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise AppError("Invalid TOTP code. Please check your authenticator app.")
    await session.execute(update(User).where(User.id == current_user.id).values(totp_enabled=True))
    await session.commit()
    return {"success": True, "message": "2FA enabled successfully"}

@router.post("/2fa/disable")
async def disable_2fa(
    payload: TOTPVerifyRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.totp_enabled:
        raise AppError("2FA is not enabled.")
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise AppError("Invalid TOTP code.")
    await session.execute(update(User).where(User.id == current_user.id).values(totp_enabled=False, totp_secret=None))
    await session.commit()
    return {"success": True}

@router.get("/sessions")
async def list_sessions(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(UserSession).where(UserSession.user_id == current_user.id, UserSession.is_active == True).order_by(UserSession.last_seen.desc())
    result = await session.execute(stmt)
    sessions = result.scalars().all()
    return [{"id": s.id, "device_info": s.device_info, "ip_address": s.ip_address, "last_seen": s.last_seen.isoformat(), "created_at": s.created_at.isoformat()} for s in sessions]

@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = await session.get(UserSession, session_id)
    if not s or s.user_id != current_user.id:
        raise NotFoundError("Session not found")
    s.is_active = False
    await session.commit()
    return {"success": True}
