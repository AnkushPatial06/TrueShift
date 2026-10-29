"""
Phase 2 migration — run once:
    python -m scripts.migrate_phase2
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import get_settings
from app.models.base import Base
# Import all models so Base knows about them
from app.models import user, attendance, leave, shift, department, ml
from app.models.chat import ChatMessage
from app.models.notification import Notification
from app.models.announcement import Announcement
from app.models.document import EmployeeDocument
from app.models.session import UserSession

async def main():
    settings = get_settings()
    url = f"mysql+aiomysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}"
    engine = create_async_engine(url, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Phase 2 migration complete.")

if __name__ == "__main__":
    asyncio.run(main())
