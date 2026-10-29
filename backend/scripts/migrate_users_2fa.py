"""
Alter users table: add 2FA and profile photo columns (run once).
Reads credentials from .env via app config.
"""
import asyncio
import sys
import os

# Add backend to path so we can use app.core.config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import get_settings

import aiomysql


async def main():
    settings = get_settings()
    conn = await aiomysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        db=settings.MYSQL_DATABASE,
    )
    cur = await conn.cursor()

    await cur.execute("SHOW COLUMNS FROM users LIKE 'totp_secret'")
    exists = await cur.fetchone()
    if not exists:
        await cur.execute(
            "ALTER TABLE users "
            "ADD COLUMN totp_secret VARCHAR(64) NULL, "
            "ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0, "
            "ADD COLUMN profile_photo_url VARCHAR(500) NULL"
        )
        await conn.commit()
        print("✅ Users table altered: added totp_secret, totp_enabled, profile_photo_url")
    else:
        print("ℹ️  Columns already exist — nothing to do.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
