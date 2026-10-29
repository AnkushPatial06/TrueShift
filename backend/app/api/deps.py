"""
Shared FastAPI dependencies: DB session, current-user resolution, RBAC guards.
"""
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import CredentialsError, PermissionDeniedError
from app.core.security import decode_token
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import Role
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_db() -> AsyncSession:
    async for session in get_session():
        yield session


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise CredentialsError("Not authenticated")

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise CredentialsError(str(exc)) from exc

    if payload.get("type") != "access":
        raise CredentialsError("Invalid token type")

    users = UserRepository(session)
    user = await users.find_by_id(int(payload["sub"]))
    if not user or not user.is_active:
        raise CredentialsError("User no longer active")

    return user


def require_roles(*allowed_roles: Role):
    async def _guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in [r.value for r in allowed_roles]:
            raise PermissionDeniedError(
                f"This action requires one of the following roles: {[r.value for r in allowed_roles]}"
            )
        return current_user

    return _guard
