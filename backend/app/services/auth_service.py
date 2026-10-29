"""
Business logic for authentication: login, registration, token refresh, audit logging.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, CredentialsError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import AuditLog, RefreshToken
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserCreate

settings = get_settings()


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)

    async def register_user(self, payload: UserCreate) -> object:
        existing = await self.users.find_by_email(payload.email)
        if existing:
            raise ConflictError("A user with this email already exists")

        user_doc = {
            "name": payload.name,
            "email": payload.email,
            "hashed_password": hash_password(payload.password),
            "role": payload.role.value,
            "employee_id": payload.employee_id,
            "department_id": payload.department_id,
            "designation": payload.designation,
            "face_registered": False,
        }
        created = await self.users.create(user_doc)
        await self._audit_log(created.id, "user_registered", {"email": payload.email})
        return created

    async def authenticate(self, email: str, password: str) -> dict:
        user = await self.users.find_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise CredentialsError("Incorrect email or password")
        if not user.is_active:
            raise CredentialsError("This account has been deactivated")

        access_token = create_access_token(str(user.id), user.role)
        refresh_token = create_refresh_token(str(user.id), user.role)

        self.session.add(RefreshToken(
            token=refresh_token,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ))
        await self.session.commit()
        await self._audit_log(user.id, "login_success", {})
        return {"access_token": access_token, "refresh_token": refresh_token, "user": user}

    async def refresh_access_token(self, refresh_token: str) -> str:
        result = await self.session.execute(select(RefreshToken).where(RefreshToken.token == refresh_token))
        stored = result.scalar_one_or_none()
        if not stored:
            raise CredentialsError("Refresh token is invalid or has been revoked")

        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise CredentialsError("Invalid token type")

        user = await self.users.find_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise CredentialsError("User no longer active")

        return create_access_token(str(user.id), user.role)

    async def logout(self, refresh_token: str) -> None:
        await self.session.execute(delete(RefreshToken).where(RefreshToken.token == refresh_token))
        await self.session.commit()

    async def _audit_log(self, user_id: int, action: str, details: dict) -> None:
        self.session.add(AuditLog(user_id=user_id, action=action, details=details))
        await self.session.commit()
