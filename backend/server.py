import asyncio
import csv
import hmac
import io
import json
import logging
import os
from contextlib import suppress
from datetime import timedelta

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware
from emergentintegrations.llm.chat import StreamDone, TextDelta, UserMessage

from core import db, client, days_ago_iso, get_current_user, iso, new_id, norm, now, today_start_iso
from discovery import import_job_from_link, rescore_all, run_discovery
from emailer import reminder_html, send_email
from llm import MODEL_PROVIDERS, make_chat, model_for
from research import initial_research, rank_contacts, research_company
from seed import DEFAULT_PROFILE, DEFAULT_SETTINGS
from tasks import create_task, finish_task, running_task

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("server")

INDEXES = {
    "users": [IndexModel([("user_id", ASCENDING)], unique=True), IndexModel([("email", ASCENDING)])],
    "user_sessions": [IndexModel([("session_token", ASCENDING)])],
    "jobs": [IndexModel([("user_id", ASCENDING), ("dedupe_key", ASCENDING)]), IndexModel([("id", ASCENDING)]),
             IndexModel([("user_id", ASCENDING), ("score", DESCENDING)]), IndexModel([("company_id", ASCENDING)])],
    "companies": [IndexModel([("user_id", ASCENDING), ("name_key", ASCENDING)]), IndexModel([("id", ASCENDING)])],
    "contacts": [IndexModel([("user_id", ASCENDING), ("priority", DESCENDING)]), IndexModel([("id", ASCENDING)]),
                 IndexModel([("company_id", ASCENDING)])],
    "activities": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)]), IndexModel([("contact_id", ASCENDING)])],
    "tasks": [IndexModel([("id", ASCENDING)]), IndexModel([("user_id", ASCENDING), ("kind", ASCENDING), ("started_at", DESCENDING)])],
}


async def ensure_indexes():
    for col, models in INDEXES.items():
        for m in models:
            with suppress(Exception):
                await db[col].create_indexes([m])


app = FastAPI()
api = APIRouter(prefix="/api")
Auth = Depends(get_current_user)
BG: set[asyncio.Task] = set()


def spawn(coro):
    t = asyncio.create_task(coro)
    BG.add(t)
    t.add_done_callback(BG.discard)


# ---------- Auth ----------
class SessionIn(BaseModel):
    session_id: str


@api.post("/auth/session")
async def auth_session(body: SessionIn, request: Request, response: Response):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data["email"].lower()
    owner = await db.app_config.find_one({"key": "owner"}, {"_id": 0})
    if owner and owner["email"] != email:
        raise HTTPException(status_code=403, detail="This is a private workspace. Only its owner can sign in.")
    if not owner:
        await db.app_config.insert_one({"key": "owner", "email": email, "created_at": iso()})
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        await db.users.update_one({"email": email}, {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
        user_id = user["user_id"]
    else:
        user_id = new_id("user")
        await db.users.insert_one({"user_id": user_id, "email": email, "name": data.get("name"), "picture": data.get("picture"), "created_at": iso()})
    if not await db.profiles.find_one({"user_id": user_id}, {"_id": 1}):
        await db.profiles.insert_one({**DEFAULT_PROFILE, "full_name": data.get("name") or "", "user_id": user_id, "updated_at": iso()})
    origin = request.headers.get("origin") or ""
    await db.settings.update_one({"user_id": user_id}, {"$setOnInsert": {**DEFAULT_SETTINGS, "user_id": user_id, "setup_done": False},
                                                         "$set": {"app_url": origin}}, upsert=True)
    token = data["session_token"]
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": token, "expires_at": now() + timedelta(days=7), "created_at": iso()})
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 86400)
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


@api.get("/auth/me")
async def me(user=Auth):
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


# ---------- Profile & settings ----------
@api.get("/profile")
async def get_profile(user=Auth):
    return await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})


@api.put("/profile")
async def put_profile(body: dict, user=Auth):
    allowed = {k: body[k] for k in DEFAULT_PROFILE if k in body}
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": {**allowed, "updated_at": iso()}})
    n = await rescore_all(user["user_id"])
    return {"ok": True, "rescored": n}


@api.get("/settings")
async def get_settings(user=Auth):
    return await db.settings.find_one({"user_id": user["user_id"]}, {"_id": 0})


@api.put("/settings")
async def put_settings(body: dict, user=Auth):
    sets = {}
    if "targets" in body:
        sets["targets"] = {k: max(0, int(body["targets"].get(k, v))) for k, v in DEFAULT_SETTINGS["targets"].items()}
    if "models" in body:
        sets["models"] = {k: (body["models"].get(k) if body["models"].get(k) in MODEL_PROVIDERS else v) for k, v in DEFAULT_SETTINGS["models"].items()}
        if MODEL_PROVIDERS[sets["models"]["research"]] != "anthropic":
            raise HTTPException(400, "Research needs a Claude model (it uses web search)")
    if "email_reminders" in body:
        sets["email_reminders"] = bool(body["email_reminders"])
    await db.settings.update_one({"user_id": user["user_id"]}, {"$set": sets})
    return await db.settings.find_one({"user_id": user["user_id"]}, {"_id": 0})


@api.get("/integrations")
async def integrations(user=Auth):
    e = os.environ.get
    return {
        "adzuna": bool(e("ADZUNA_APP_ID") and e("ADZUNA_APP_KEY")),
        "jsearch": bool(e("RAPIDAPI_KEY")),
        "apollo": bool(e("APOLLO_API_KEY")),
        "ai": bool(e("EMERGENT_LLM_KEY")),
        "email": bool(e("EMERGENT_EMAIL_KEY")),
    }


# ---------- Jobs ----------
@api.get("/jobs")
async def list_jobs(user=Auth, q: str = "", work_mode: str = "", min_score: int = 0, source: str = "", city: str = "",
                    status: str = "", posted_days: int = 0, sort: str = "newest", limit: int = Query(300, le=1000)):
    f: dict = {"user_id": user["user_id"]}
    if q:
        f["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"company": {"$regex": q, "$options": "i"}}, {"description": {"$regex": q, "$options": "i"}}]
    if work_mode:
        f["work_mode"] = work_mode
    if min_score:
        f["score"] = {"$gte": min_score}
    if source:
        f["source"] = {"$regex": source, "$options": "i"}
    if city:
        f["location"] = {"$regex": city, "$options": "i"}
    f["status"] = status if status else {"$ne": "dismissed"}
    if posted_days:
        f["created_at"] = {"$gte": days_ago_iso(posted_days)}
    order = [("score", -1)] if sort == "score" else [("date_posted", -1), ("created_at", -1)]
    return await db.jobs.find(f, {"_id": 0, "description": 0}).sort(order).to_list(limit)


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user=Auth):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["user_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    job["contacts"] = await db.contacts.find({"user_id": user["user_id"], "$or": [{"job_ids": job_id}, {"company_id": job["company_id"]}]},
                                             {"_id": 0}).sort("priority", -1).to_list(30)
    return job


@api.patch("/jobs/{job_id}")
async def patch_job(job_id: str, body: dict, user=Auth):
    sets = {k: body[k] for k in ["status", "notes"] if k in body}
    if sets.get("status") not in (None, "new", "saved", "applied", "dismissed"):
        raise HTTPException(400, "Invalid status")
    if sets.get("status") == "applied":
        sets["applied_at"] = iso()
        job = await db.jobs.find_one({"id": job_id, "user_id": user["user_id"]}, {"_id": 0})
        if job and job.get("status") != "applied":
            await log_activity(user["user_id"], "applied", f"Applied: {job['title']} at {job['company']}", job_id=job_id)
    await db.jobs.update_one({"id": job_id, "user_id": user["user_id"]}, {"$set": sets})
    return await db.jobs.find_one({"id": job_id}, {"_id": 0, "description": 0})


class ImportIn(BaseModel):
    url: str
    text: str = ""


@api.post("/jobs/import")
async def import_job(body: ImportIn, user=Auth):
    if not body.url.startswith("http"):
        raise HTTPException(400, "Enter a full job link starting with http")
    try:
        return await import_job_from_link(user["user_id"], body.url, body.text)
    except httpx.HTTPError:
        raise HTTPException(422, "That site blocked automatic reading. Paste the job description text below the link and try again.")
    except ValueError as e:
        raise HTTPException(422, str(e))


async def _discovery_task(user_id: str, tid: str):
    try:
        await run_discovery(user_id, tid)
        await rank_contacts(user_id)
        await finish_task(tid)
    except Exception as e:
        log.exception("discovery failed")
        await finish_task(tid, str(e))


@api.post("/discovery/run")
async def discovery_run(user=Auth):
    existing = await running_task(user["user_id"], "discovery") or await running_task(user["user_id"], "initial")
    if existing:
        return existing
    tid = await create_task(user["user_id"], "discovery", [("sources", "Search job sources")])
    spawn(_discovery_task(user["user_id"], tid))
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


@api.get("/discovery/runs")
async def discovery_runs(user=Auth):
    return await db.discovery_runs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)


@api.get("/tasks/latest")
async def latest_task(kind: str, user=Auth):
    return await db.tasks.find_one({"user_id": user["user_id"], "kind": kind}, {"_id": 0}, sort=[("started_at", -1)]) or {}


@api.post("/research/initial")
async def research_initial(user=Auth):
    existing = await running_task(user["user_id"], "initial")
    if existing:
        return existing
    tid = await create_task(user["user_id"], "initial", [("companies", "Build BC employer list"), ("sources", "Find current IT vacancies"),
                                                         ("people", "Find public recruiters & IT leaders"), ("prioritize", "Prioritize companies, people & jobs")])
    spawn(initial_research(user["user_id"], tid))
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


# ---------- Companies ----------
@api.get("/companies")
async def list_companies(user=Auth, q: str = "", priority: bool = False):
    f: dict = {"user_id": user["user_id"]}
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    if priority:
        f["high_priority"] = True
    cos = await db.companies.find(f, {"_id": 0}).to_list(1000)
    jobs, people = {}, {}
    async for j in db.jobs.find({"user_id": user["user_id"], "status": {"$ne": "dismissed"}}, {"_id": 0, "company_id": 1}):
        jobs[j["company_id"]] = jobs.get(j["company_id"], 0) + 1
    async for c in db.contacts.find({"user_id": user["user_id"]}, {"_id": 0, "company_id": 1}):
        people[c["company_id"]] = people.get(c["company_id"], 0) + 1
    for c in cos:
        c["open_jobs"], c["contacts_count"] = jobs.get(c["id"], 0), people.get(c["id"], 0)
    cos.sort(key=lambda c: (-int(c.get("high_priority", False)), -c["open_jobs"], c["name"]))
    return cos


@api.get("/companies/{cid}")
async def get_company(cid: str, user=Auth):
    co = await db.companies.find_one({"id": cid, "user_id": user["user_id"]}, {"_id": 0})
    if not co:
        raise HTTPException(404, "Company not found")
    co["jobs"] = await db.jobs.find({"company_id": cid, "status": {"$ne": "dismissed"}}, {"_id": 0, "description": 0}).sort("score", -1).to_list(50)
    co["contacts"] = await db.contacts.find({"company_id": cid}, {"_id": 0}).sort("priority", -1).to_list(50)
    return co


async def _company_research_task(user_id: str, cid: str, tid: str):
    try:
        res = await research_company(user_id, cid)
        await rank_contacts(user_id)
        await db.tasks.update_one({"id": tid}, {"$set": {"counts.contacts": res["added"]}})
        await finish_task(tid)
    except Exception as e:
        log.exception("company research failed")
        await finish_task(tid, str(e))


@api.post("/companies/{cid}/research")
async def research_one(cid: str, user=Auth):
    if not await db.companies.find_one({"id": cid, "user_id": user["user_id"]}, {"_id": 1}):
        raise HTTPException(404, "Company not found")
    kind = f"company:{cid}"
    existing = await running_task(user["user_id"], kind)
    if existing:
        return existing
    tid = await create_task(user["user_id"], kind, [("people", "Research company & people")])
    spawn(_company_research_task(user["user_id"], cid, tid))
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


@api.post("/jobs/{job_id}/find-people")
async def find_people_for_job(job_id: str, user=Auth):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["user_id"]}, {"_id": 0, "company_id": 1})
    if not job:
        raise HTTPException(404, "Job not found")
    return await research_one(job["company_id"], user)


# ---------- Contacts / CRM ----------
CONTACT_FIELDS = ["name", "title", "company", "location", "email", "linkedin_url", "website", "contact_type", "relevance", "approach",
                  "job_ids", "stage", "next_follow_up", "outcome", "notes", "request_sent_at", "accepted_at"]
STAGE_FROM_ACTIVITY = {"request_sent": "request_sent", "accepted": "connected", "conversation": "conversation", "referral": "referral",
                       "interview": "interview"}


class ContactIn(BaseModel):
    name: str
    title: str = ""
    company: str = ""
    location: str = ""
    email: str = ""
    linkedin_url: str = ""
    website: str = ""
    contact_type: str = "employee"
    relevance: str = ""
    approach: str = ""
    notes: str = ""
    job_ids: list[str] = []
    next_follow_up: str | None = None


@api.get("/contacts")
async def list_contacts(user=Auth, q: str = "", contact_type: str = "", verification: str = "", stage: str = "", origin: str = "",
                        approach_first: bool = False, due: bool = False):
    f: dict = {"user_id": user["user_id"]}
    if q:
        f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"company": {"$regex": q, "$options": "i"}}, {"title": {"$regex": q, "$options": "i"}}]
    for k, v in [("contact_type", contact_type), ("verification", verification), ("stage", stage), ("origin", origin)]:
        if v:
            f[k] = v
    if approach_first:
        f["approach_first"] = True
    if due:
        f["next_follow_up"] = {"$ne": None, "$lte": iso()}
    return await db.contacts.find(f, {"_id": 0}).sort([("priority", -1), ("created_at", -1)]).to_list(1000)


@api.post("/contacts")
async def create_contact(body: ContactIn, user=Auth):
    from discovery import ensure_company
    cid = await ensure_company(user["user_id"], body.company) if body.company else None
    doc = {**body.model_dump(), "id": new_id("ct"), "user_id": user["user_id"], "name_key": norm(body.name), "company_id": cid,
           "verification": "verified", "source_url": body.linkedin_url or body.website, "evidence": "Added by you", "hiring_manager_evidence": "",
           "origin": "manual", "stage": "identified", "request_sent_at": None, "accepted_at": None, "outcome": "", "approach_first": False,
           "priority": 40, "verified_at": iso(), "created_at": iso(), "updated_at": iso()}
    await db.contacts.insert_one(doc)
    await log_activity(user["user_id"], "note", "Contact added", contact_id=doc["id"])
    return await db.contacts.find_one({"id": doc["id"]}, {"_id": 0})


@api.get("/contacts/{ct_id}")
async def get_contact(ct_id: str, user=Auth):
    c = await db.contacts.find_one({"id": ct_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Contact not found")
    c["activities"] = await db.activities.find({"contact_id": ct_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    c["jobs"] = await db.jobs.find({"id": {"$in": c.get("job_ids") or []}}, {"_id": 0, "description": 0}).to_list(20)
    return c


@api.patch("/contacts/{ct_id}")
async def patch_contact(ct_id: str, body: dict, user=Auth):
    sets = {k: body[k] for k in CONTACT_FIELDS if k in body}
    sets["updated_at"] = iso()
    if "name" in sets:
        sets["name_key"] = norm(sets["name"])
    await db.contacts.update_one({"id": ct_id, "user_id": user["user_id"]}, {"$set": sets})
    return await db.contacts.find_one({"id": ct_id}, {"_id": 0})


@api.delete("/contacts/{ct_id}")
async def delete_contact(ct_id: str, user=Auth):
    await db.contacts.delete_one({"id": ct_id, "user_id": user["user_id"]})
    await db.activities.delete_many({"contact_id": ct_id, "user_id": user["user_id"]})
    return {"ok": True}


async def log_activity(user_id: str, type_: str, text: str, contact_id: str | None = None, job_id: str | None = None, extra: dict | None = None) -> str:
    aid = new_id("act")
    await db.activities.insert_one({"id": aid, "user_id": user_id, "type": type_, "text": text, "contact_id": contact_id, "job_id": job_id,
                                    **(extra or {}), "created_at": iso()})
    return aid


class ActivityIn(BaseModel):
    type: str
    text: str = ""
    follow_up_days: int | None = None
    minutes: int | None = None


ACTIVITY_TYPES = {"note", "request_sent", "accepted", "conversation", "follow_up", "referral", "interview", "skill_practice", "message_sent"}


@api.post("/contacts/{ct_id}/activities")
async def add_activity(ct_id: str, body: ActivityIn, user=Auth):
    if body.type not in ACTIVITY_TYPES:
        raise HTTPException(400, "Unknown activity type")
    c = await db.contacts.find_one({"id": ct_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Contact not found")
    await log_activity(user["user_id"], body.type, body.text, contact_id=ct_id)
    sets: dict = {"updated_at": iso()}
    if body.type in STAGE_FROM_ACTIVITY:
        sets["stage"] = STAGE_FROM_ACTIVITY[body.type]
    if body.type == "request_sent":
        sets["request_sent_at"] = iso()
    if body.type == "accepted":
        sets["accepted_at"] = iso()
    if body.follow_up_days is not None:
        sets["next_follow_up"] = iso(now() + timedelta(days=body.follow_up_days)) if body.follow_up_days > 0 else None
    elif body.type in ("request_sent", "accepted", "conversation", "follow_up"):
        sets["next_follow_up"] = iso(now() + timedelta(days={"request_sent": 5, "accepted": 2, "conversation": 7, "follow_up": 7}[body.type]))
    await db.contacts.update_one({"id": ct_id}, {"$set": sets})
    return await get_contact(ct_id, user)


@api.post("/activities/skill")
async def log_skill(body: ActivityIn, user=Auth):
    await log_activity(user["user_id"], "skill_practice", body.text or "Skill practice", extra={"minutes": body.minutes or 30})
    return {"ok": True}


# ---------- Outreach ----------
MESSAGE_TYPES = {
    "connection_request": "a LinkedIn connection request note. HARD LIMIT: 200 characters including spaces (LinkedIn free-account limit). No greeting line breaks.",
    "follow_up": "a short LinkedIn follow-up message (60-110 words) after a previous message or connection with no reply yet, or to check in on a referral/application.",
    "thank_you": "a short thank-you message (60-110 words) after a conversation or informational chat, mentioning one specific thing discussed if notes are given.",
}
STYLE = (
    "Write like a real, thoughtful person in Canada, not a template. Plain words, short sentences, Canadian spelling. "
    "Be specific: reference one concrete detail about the person, their team or the role, and one concrete, relevant thing from the sender's experience. "
    "No flattery, no buzzwords, no em dashes, no exclamation marks, no 'I hope this message finds you well', no 'I came across your profile', "
    "no 'passionate', 'leverage', 'synergy', 'reach out'. Never claim things not in the sender profile. Never ask for a job outright in a connection note. "
    "Output only the message text, no subject line, no quotes, no commentary."
)


class OutreachIn(BaseModel):
    contact_id: str
    message_type: str
    job_id: str | None = None
    notes: str = ""


@api.post("/outreach/stream")
async def outreach_stream(body: OutreachIn, user=Auth):
    if body.message_type not in MESSAGE_TYPES:
        raise HTTPException(400, "This message type arrives in Phase 2")
    c = await db.contacts.find_one({"id": body.contact_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Contact not found")
    job = await db.jobs.find_one({"id": body.job_id, "user_id": user["user_id"]}, {"_id": 0, "title": 1, "company": 1, "location": 1, "matched_skills": 1}) if body.job_id else None
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    history = await db.activities.find({"contact_id": c["id"], "type": {"$ne": "message_draft"}}, {"_id": 0, "type": 1, "text": 1, "created_at": 1}).sort("created_at", -1).to_list(8)
    exp = profile.get("experience") or []
    prompt = (
        f"Write {MESSAGE_TYPES[body.message_type]}\n\n"
        f"SENDER: {profile.get('full_name') or user.get('name')}. {profile.get('headline', '')}\n"
        f"Education: {'; '.join(profile.get('education') or [])}\n"
        f"Experience: {json.dumps(exp)[:1500]}\nCertifications: {'; '.join(profile.get('certifications') or [])}\n"
        f"Target: IT support / systems admin / cloud support roles in BC or remote Canada.\n\n"
        f"RECIPIENT: {c['name']}, {c.get('title')} at {c.get('company')} ({c.get('location') or 'location unknown'}). Type: {c.get('contact_type')}.\n"
        f"Known public info: {c.get('evidence') or ''} {c.get('relevance') or ''}\n"
        f"Relationship stage: {c.get('stage')}. Recent history: {json.dumps(history)[:1200]}\n"
        + (f"RELATED OPENING: {job['title']} at {job['company']} ({job.get('location')}). Sender's matching skills: {', '.join(job.get('matched_skills') or [])}\n" if job else "")
        + (f"SENDER NOTES: {body.notes}\n" if body.notes else "")
    )
    provider, model = await model_for(user["user_id"], "writing")
    chat = make_chat(provider, model, STYLE)

    async def gen():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            log.exception("outreach stream failed")
            yield f"data: {json.dumps({'error': 'The writer is unavailable right now. Try again in a moment.'})}\n\n"
            return
        aid = await log_activity(user["user_id"], "message_draft", full.strip(), contact_id=c["id"], job_id=body.job_id,
                                 extra={"message_type": body.message_type, "model": model})
        yield f"data: {json.dumps({'done': True, 'activity_id': aid, 'chars': len(full.strip())})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- Dashboard ----------
async def count_acts(user_id: str, type_: str, since: str | None = None) -> int:
    f = {"user_id": user_id, "type": type_}
    if since:
        f["created_at"] = {"$gte": since}
    return await db.activities.count_documents(f)


@api.get("/dashboard")
async def dashboard(user=Auth):
    uid, t0 = user["user_id"], today_start_iso()
    s = await db.settings.find_one({"user_id": uid}, {"_id": 0}) or {}
    skill_min = 0
    async for a in db.activities.find({"user_id": uid, "type": "skill_practice", "created_at": {"$gte": t0}}, {"_id": 0, "minutes": 1}):
        skill_min += a.get("minutes") or 0
    today = {
        "jobs_discovered": await db.jobs.count_documents({"user_id": uid, "created_at": {"$gte": t0}}),
        "contacts_identified": await db.contacts.count_documents({"user_id": uid, "created_at": {"$gte": t0}}),
        "requests_sent": await count_acts(uid, "request_sent", t0),
        "applications": await count_acts(uid, "applied", t0),
        "follow_ups": await count_acts(uid, "follow_up", t0),
        "skill_minutes": skill_min,
    }
    due = await db.contacts.find({"user_id": uid, "next_follow_up": {"$ne": None, "$lte": iso()}}, {"_id": 0}).sort("next_follow_up", 1).to_list(20)
    totals = {
        "applications": await db.jobs.count_documents({"user_id": uid, "status": "applied"}),
        "requests_sent": await count_acts(uid, "request_sent"),
        "accepted": await count_acts(uid, "accepted"),
        "conversations": await count_acts(uid, "conversation"),
        "referrals": await count_acts(uid, "referral"),
        "interviews": await count_acts(uid, "interview"),
        "follow_ups_due": len(due),
        "awaiting_application": await db.jobs.count_documents({"user_id": uid, "status": {"$in": ["new", "saved"]}, "score": {"$gte": 60}}),
        "jobs": await db.jobs.count_documents({"user_id": uid, "status": {"$ne": "dismissed"}}),
        "contacts": await db.contacts.count_documents({"user_id": uid}),
        "companies": await db.companies.count_documents({"user_id": uid}),
    }
    top_jobs = await db.jobs.find({"user_id": uid, "status": {"$in": ["new", "saved"]}}, {"_id": 0, "description": 0}).sort("score", -1).to_list(10)
    approach = await db.contacts.find({"user_id": uid, "stage": "identified"}, {"_id": 0}).sort("priority", -1).to_list(5)
    last_run = await db.discovery_runs.find_one({"user_id": uid}, {"_id": 0}, sort=[("created_at", -1)])
    moves = []
    if not last_run or last_run["created_at"] < t0:
        moves.append({"kind": "discover", "title": "Run today's job discovery", "detail": "No discovery run yet today.", "link": "/jobs"})
    for c in due[:5]:
        moves.append({"kind": "follow_up", "title": f"Follow up with {c['name']}", "detail": f"{c.get('title')} at {c.get('company')}", "link": f"/crm?contact={c['id']}"})
    for c in approach[: max(0, s.get("targets", {}).get("requests_sent", 5) - today["requests_sent"])]:
        moves.append({"kind": "connect", "title": f"Send a connection request to {c['name']}", "detail": f"{c.get('title')} at {c.get('company')}", "link": f"/outreach?contact={c['id']}"})
    for j in top_jobs[: max(0, s.get("targets", {}).get("applications", 3) - today["applications"])]:
        if j.get("score", 0) >= 60:
            moves.append({"kind": "apply", "title": f"Apply: {j['title']}", "detail": f"{j['company']} - fit {j.get('score')}", "link": f"/jobs?job={j['id']}"})
    if today["skill_minutes"] < s.get("targets", {}).get("skill_minutes", 45):
        moves.append({"kind": "skill", "title": "Practise one technical skill", "detail": f"{today['skill_minutes']} of {s.get('targets', {}).get('skill_minutes', 45)} minutes logged today", "link": "/"})
    return {"targets": s.get("targets", DEFAULT_SETTINGS["targets"]), "today": today, "totals": totals, "moves": moves, "top_jobs": top_jobs,
            "due_contacts": due, "last_run": last_run, "setup_done": s.get("setup_done", False)}


# ---------- Export ----------
EXPORTS = {
    "jobs": ("jobs", ["title", "company", "location", "work_mode", "salary", "employment_type", "date_posted", "deadline", "score", "recommendation",
                      "matched_skills", "missing_skills", "status", "source", "source_url", "apply_url", "last_verified"]),
    "contacts": ("contacts", ["name", "title", "company", "location", "contact_type", "verification", "stage", "linkedin_url", "website", "source_url",
                              "evidence", "relevance", "approach", "request_sent_at", "accepted_at", "next_follow_up", "outcome", "verified_at"]),
    "companies": ("companies", ["name", "industry", "location", "website", "careers_url", "linkedin_url", "high_priority", "it_notes", "researched_at"]),
}


@api.get("/export/{kind}")
async def export_csv(kind: str, user=Auth):
    if kind not in EXPORTS:
        raise HTTPException(404, "Unknown export")
    col, fields = EXPORTS[kind]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(fields)
    async for d in db[col].find({"user_id": user["user_id"]}, {"_id": 0}):
        w.writerow(["; ".join(map(str, d.get(f))) if isinstance(d.get(f), list) else d.get(f, "") for f in fields])
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={kind}.csv"})


# ---------- Reminders & cron ----------
async def send_reminder(user: dict) -> str | None:
    uid = user["user_id"]
    due = await db.contacts.find({"user_id": uid, "next_follow_up": {"$ne": None, "$lte": iso()}}, {"_id": 0}).to_list(20)
    top = await db.jobs.find({"user_id": uid, "status": {"$in": ["new", "saved"]}}, {"_id": 0, "title": 1, "company": 1, "score": 1}).sort("score", -1).to_list(5)
    s = await db.settings.find_one({"user_id": uid}, {"_id": 0}) or {}
    html = reminder_html(user.get("name"), due, top, s.get("app_url") or "")
    return await send_email(to=user["email"], subject=f"Today: {len(due)} follow-ups due and {len(top)} jobs to act on", html=html)


@api.post("/reminders/send-now")
async def reminders_send_now(user=Auth):
    return {"ok": True, "email_id": await send_reminder(user)}


async def daily_job():
    owner = await db.app_config.find_one({"key": "owner"}, {"_id": 0})
    owner_user = await db.users.find_one({"email": owner["email"]}, {"_id": 0}) if owner else None
    if not owner_user:
        return
    async for s in db.settings.find({"user_id": owner_user["user_id"]}, {"_id": 0}):
        user = await db.users.find_one({"user_id": s["user_id"]}, {"_id": 0})
        if not user:
            continue
        tid = await create_task(user["user_id"], "discovery", [("sources", "Scheduled daily discovery")])
        await _discovery_task(user["user_id"], tid)
        if s.get("email_reminders", True):
            with suppress(Exception):
                await send_reminder(user)


@api.post("/cron/daily")
async def cron_daily(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    secret = os.environ["WEBHOOK_CRON_SECRET"]
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(401, "Unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        raise HTTPException(400, "Invalid body")
    run_id = request.headers.get("X-Webhook-Id") or body.get("run_id") or new_id("cron")
    if await db.cron_runs.find_one({"run_id": run_id}, {"_id": 1}):
        return {"ok": True, "duplicate": True}
    await db.cron_runs.insert_one({"run_id": run_id, "created_at": iso()})
    spawn(daily_job())
    return {"ok": True, "run_id": run_id}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await db.tasks.update_many({"status": "running"}, {"$set": {"status": "failed", "error": "Interrupted by a server restart. Run it again."}})


@app.on_event("shutdown")
async def shutdown():
    app.state.index_task.cancel()
    client.close()
