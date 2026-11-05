import asyncio
import datetime as dt
import sys

sys.path.insert(0, "/app/backend")
from core import db  # noqa: E402
from seed import DEFAULT_PROFILE, DEFAULT_SETTINGS  # noqa: E402


async def main():
    uid, tok = "user_test0001", "test_session_cc_0001"
    now = dt.datetime.now(dt.timezone.utc)
    await db.users.update_one({"user_id": uid}, {"$set": {"user_id": uid, "email": "test.user@example.com", "name": "Test User", "picture": "", "created_at": now.isoformat()}}, upsert=True)
    await db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "session_token": tok, "expires_at": now + dt.timedelta(days=30)}}, upsert=True)
    await db.profiles.update_one({"user_id": uid}, {"$setOnInsert": {**DEFAULT_PROFILE, "full_name": "Test User", "user_id": uid}}, upsert=True)
    await db.settings.update_one({"user_id": uid}, {"$setOnInsert": {**DEFAULT_SETTINGS, "user_id": uid, "setup_done": False, "app_url": ""}}, upsert=True)
    print("seeded", uid, tok)


asyncio.run(main())
