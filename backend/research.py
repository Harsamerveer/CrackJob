import asyncio
import logging

from core import db, iso, new_id, norm
from discovery import ai_error_text, ensure_company, run_discovery
from llm import ask_json
from seed import SEED_COMPANIES
from tasks import finish_task, step

log = logging.getLogger("research")
TYPE_WEIGHT = {"recruiter": 30, "hiring_manager": 35, "potential_hiring_manager": 28, "employee": 15, "referral": 20}

PEOPLE_SYSTEM = (
    "You research publicly available professional information to help a job seeker network ethically. Use web search. "
    "Only report real people you found named on a public web page (company team/leadership pages, press releases, conference or "
    "event speaker pages, news articles, university/government staff directories, public profile pages shown in search results). "
    "Never invent names, titles, emails or URLs. Never guess LinkedIn URLs: include one only if that exact URL appeared in results. "
    "Never claim someone is the hiring manager for a specific vacancy unless the posting or a public source names them. "
    "Do not include personal emails or phone numbers. Respond with JSON only."
)


async def research_company(user_id: str, company_id: str) -> dict:
    co = await db.companies.find_one({"id": company_id, "user_id": user_id}, {"_id": 0})
    if not co:
        return {"added": 0}
    jobs = await db.jobs.find({"user_id": user_id, "company_id": company_id, "status": {"$ne": "dismissed"}},
                              {"_id": 0, "id": 1, "title": 1, "location": 1}).to_list(10)
    job_lines = "\n".join(f"- {j['title']} ({j['location']})" for j in jobs) or "- none found yet"
    prompt = (
        f"Employer: {co['name']} (British Columbia / Canada).\nCurrent relevant openings we know of:\n{job_lines}\n\n"
        "1) Find the company's official website, careers page and LinkedIn company page URL, industry, main BC location, and any public "
        "info about its IT department (size, tools, structure).\n"
        "2) Find up to 6 real people relevant to an IT support / systems administration job search there: IT or technical recruiters, "
        "talent acquisition staff, IT managers/directors, infrastructure or service desk managers, and IT team members.\n"
        "Return JSON: {\"company\": {\"industry\", \"location\", \"website\", \"careers_url\", \"linkedin_url\", \"it_notes\" (max 3 short sentences), \"source_urls\": [..]}, "
        "\"people\": [{\"name\", \"title\", \"location\", \"contact_type\" (recruiter|hiring_manager|potential_hiring_manager|employee|referral), "
        "\"linkedin_url\" (\"\" unless seen), \"website\", \"source_url\" (page where they are named), \"evidence\" (short quote or fact from that page), "
        "\"hiring_manager_evidence\" (\"\" unless a source ties them to a specific opening), \"related_jobs\" [titles from the list above, only if plausible], "
        "\"relevance\" (1-2 sentences why they matter), \"approach\" (1-2 sentences suggested networking approach)}]}"
    )
    data = await ask_json(user_id, "research", PEOPLE_SYSTEM, prompt, web_uses=5)
    c = data.get("company") or {}
    sets = {k: c.get(k) or co.get(k, "") for k in ["industry", "location", "website", "careers_url", "linkedin_url", "it_notes"]}
    sets["source_urls"] = [u for u in (c.get("source_urls") or []) if isinstance(u, str) and u.startswith("http")]
    sets["researched_at"] = iso()
    await db.companies.update_one({"id": company_id}, {"$set": sets})
    added = 0
    for p in data.get("people") or []:
        name = (p.get("name") or "").strip()
        src = p.get("source_url") or ""
        if not name or len(name.split()) < 2 or not src.startswith("http"):
            continue
        if await db.contacts.find_one({"user_id": user_id, "name_key": norm(name), "company_id": company_id}, {"_id": 1}):
            continue
        ctype = p.get("contact_type") or "employee"
        if ctype == "hiring_manager" and not p.get("hiring_manager_evidence"):
            ctype = "potential_hiring_manager"
        if ctype not in TYPE_WEIGHT:
            ctype = "employee"
        related = set(p.get("related_jobs") or [])
        job_ids = [j["id"] for j in jobs if j["title"] in related]
        verified = bool(p.get("evidence"))
        await db.contacts.insert_one({
            "id": new_id("ct"), "user_id": user_id, "name": name, "name_key": norm(name), "title": p.get("title") or "",
            "company": co["name"], "company_id": company_id, "location": p.get("location") or "", "email": "",
            "linkedin_url": p.get("linkedin_url") if (p.get("linkedin_url") or "").startswith("https://") and "linkedin.com/in/" in p.get("linkedin_url", "") else "",
            "website": p.get("website") or "", "contact_type": ctype, "verification": "verified" if verified else "inferred",
            "source_url": src, "evidence": p.get("evidence") or "", "hiring_manager_evidence": p.get("hiring_manager_evidence") or "",
            "relevance": p.get("relevance") or "", "approach": p.get("approach") or "", "job_ids": job_ids, "origin": "ai_research",
            "stage": "identified", "request_sent_at": None, "accepted_at": None, "next_follow_up": None, "outcome": "", "notes": "",
            "approach_first": False, "priority": 0, "verified_at": iso(), "created_at": iso(), "updated_at": iso()})
        added += 1
    return {"added": added}


async def rank_contacts(user_id: str) -> int:
    open_counts: dict[str, int] = {}
    async for j in db.jobs.find({"user_id": user_id, "status": {"$ne": "dismissed"}}, {"_id": 0, "company_id": 1, "score": 1}):
        if j.get("score", 0) >= 55:
            open_counts[j["company_id"]] = open_counts.get(j["company_id"], 0) + 1
    contacts = await db.contacts.find({"user_id": user_id}, {"_id": 0, "id": 1, "company_id": 1, "contact_type": 1, "verification": 1, "job_ids": 1}).to_list(2000)
    for c in contacts:
        p = TYPE_WEIGHT.get(c["contact_type"], 10) + min(open_counts.get(c["company_id"], 0), 5) * 8 + (15 if c["verification"] == "verified" else 0) + len(c.get("job_ids") or []) * 6
        c["priority"] = p
    contacts.sort(key=lambda c: -c["priority"])
    for i, c in enumerate(contacts):
        await db.contacts.update_one({"id": c["id"]}, {"$set": {"priority": c["priority"], "approach_first": i < 20}})
    return min(20, len(contacts))


async def prioritize_companies(user_id: str) -> int:
    counts: dict[str, list[int]] = {}
    async for j in db.jobs.find({"user_id": user_id, "status": {"$ne": "dismissed"}}, {"_id": 0, "company_id": 1, "score": 1}):
        counts.setdefault(j["company_id"], []).append(j.get("score", 0))
    cos = await db.companies.find({"user_id": user_id}, {"_id": 0, "id": 1}).to_list(1000)
    ranked = sorted(cos, key=lambda c: -(len(counts.get(c["id"], [])) * 10 + max(counts.get(c["id"], [0]))))
    for i, c in enumerate(ranked):
        await db.companies.update_one({"id": c["id"]}, {"$set": {"high_priority": i < 30}})
    return min(30, len(ranked))


async def initial_research(user_id: str, task_id: str) -> None:
    try:
        await step(task_id, "companies", "running", "Adding BC employers")
        for name, industry in SEED_COMPANIES:
            await ensure_company(user_id, name, industry)
        await step(task_id, "companies", "done", f"{len(SEED_COMPANIES)} seed employers added")
        await run_discovery(user_id, task_id)
        await step(task_id, "people", "running", "Researching public recruiters and IT leaders")
        cos = await db.companies.find({"user_id": user_id}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
        job_counts = {}
        async for j in db.jobs.find({"user_id": user_id}, {"_id": 0, "company_id": 1}):
            job_counts[j["company_id"]] = job_counts.get(j["company_id"], 0) + 1
        cos.sort(key=lambda c: -job_counts.get(c["id"], 0))
        targets = cos[:14]
        sem = asyncio.Semaphore(4)
        done = 0
        errors: list[str] = []

        async def one(c):
            nonlocal done
            async with sem:
                try:
                    await research_company(user_id, c["id"])
                except Exception as e:
                    log.warning("research %s failed: %s", c["name"], e)
                    errors.append(ai_error_text(e))
                done += 1
                total = await db.contacts.count_documents({"user_id": user_id})
                await step(task_id, "people", "running", f"{done}/{len(targets)} employers researched, {total} contacts found", {"contacts": total})

        await asyncio.gather(*[one(c) for c in targets])
        total = await db.contacts.count_documents({"user_id": user_id})
        note = f" · research failed for {len(errors)} employers: {errors[0]}" if errors else ""
        await step(task_id, "people", "failed" if errors and not total else "done", f"{total} public contacts found (target 50){note}", {"contacts": total})
        await step(task_id, "prioritize", "running", "Ranking companies, people and jobs")
        n_people = await rank_contacts(user_id)
        n_cos = await prioritize_companies(user_id)
        n_jobs = await db.jobs.count_documents({"user_id": user_id})
        companies = await db.companies.count_documents({"user_id": user_id})
        await step(task_id, "prioritize", "done", f"Top {n_cos} companies, first {n_people} people, top {min(10, n_jobs)} jobs",
                   {"companies": companies, "jobs": n_jobs, "approach_first": n_people})
        if errors and len(errors) == len(targets):
            await finish_task(task_id, errors[0])
            return
        await db.settings.update_one({"user_id": user_id}, {"$set": {"setup_done": True}})
        await finish_task(task_id)
    except Exception as e:
        log.exception("initial research failed")
        await finish_task(task_id, str(e))
