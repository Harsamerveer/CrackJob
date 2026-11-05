from core import db, iso, new_id


async def create_task(user_id: str, kind: str, steps: list[tuple[str, str]]) -> str:
    tid = new_id("task")
    await db.tasks.insert_one({
        "id": tid, "user_id": user_id, "kind": kind, "status": "running", "counts": {}, "error": "",
        "steps": [{"key": k, "label": label, "status": "pending", "detail": ""} for k, label in steps],
        "started_at": iso(), "finished_at": None})
    return tid


async def step(task_id: str | None, key: str, status: str, detail: str = "", counts: dict | None = None) -> None:
    if not task_id:
        return
    sets = {"steps.$[s].status": status, "steps.$[s].detail": detail}
    for k, v in (counts or {}).items():
        sets[f"counts.{k}"] = v
    await db.tasks.update_one({"id": task_id}, {"$set": sets}, array_filters=[{"s.key": key}])


async def finish_task(task_id: str, error: str = "") -> None:
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "failed" if error else "done", "error": error, "finished_at": iso()}})


async def running_task(user_id: str, kind: str) -> dict | None:
    return await db.tasks.find_one({"user_id": user_id, "kind": kind, "status": "running"}, {"_id": 0})
