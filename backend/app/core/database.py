"""
MySQL connection manager using SQLAlchemy's async engine (asyncmy driver).
Provides a single reusable engine + session factory across the app lifecycle.
"""
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.models.base import Base

logger = logging.getLogger("app.database")
settings = get_settings()


class Database:
    engine = None
    session_factory: async_sessionmaker[AsyncSession] | None = None


db = Database()


async def connect_to_mysql() -> None:
    db.engine = create_async_engine(
        settings.sqlalchemy_database_uri,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    db.session_factory = async_sessionmaker(db.engine, expire_on_commit=False, class_=AsyncSession)

    # Fail fast if the connection is wrong, and create tables if they don't exist yet.
    async with db.engine.begin() as conn:
        # Import all models so they register on Base.metadata before create_all
        from app.models import (  # noqa: F401
            attendance,
            department,
            leave,
            ml,
            shift,
            user,
        )

        await conn.run_sync(Base.metadata.create_all)

    logger.info("Connected to MySQL database '%s' and ensured tables exist", settings.MYSQL_DATABASE)


async def close_mysql_connection() -> None:
    if db.engine:
        await db.engine.dispose()
        logger.info("MySQL connection closed")


async def get_session() -> AsyncSession:
    async with db.session_factory() as session:
        yield session
