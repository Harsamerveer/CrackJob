import asyncio
import html as htmlmod
import logging
import os
import re

import httpx
from bs4 import BeautifulSoup

from core import db, iso, new_id, norm, now
from llm import ask_json
from scoring import BC, CANADA, detect_skills, is_relevant_title, score_job, work_mode
from seed import ATS_FEEDS

log = logging.getLogger("discovery")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}
ADZUNA_QUERIES = ["it support", "systems administrator", "service desk analyst", "desktop support", "microsoft 365 administrator",
                  "intune", "cloud support", "it infrastructure analyst"]
JSEARCH_QUERIES = ["IT support analyst in British Columbia, Canada", "systems administrator in British Columbia, Canada",
                   "service desk analyst in Vancouver, BC", "IT support remote Canada", "Microsoft 365 Intune administrator Canada"]
RESEARCH_GROUPS = [
    "Government of Canada Job Bank postings located in British Columbia. Fetch https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=IT+support&locationstring=British+Columbia and https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=system+administrator&locationstring=British+Columbia and keep only BC or remote postings",
    "BC Public Service and BC health authorities. Fetch https://bcpublicservice.hua.hrsmart.com/hr/ats/JobSearch/viewAll and https://jobs.phsa.ca/careers/corporate/provincial-digital-health-and-information-services, and search Fraser Health, Vancouver Coastal Health, Island Health and Interior Health IT / digital health postings",
    "BC universities, colleges and municipalities: UBC (Vancouver and Okanagan), SFU, UVic, BCIT, Okanagan College, TRU, City of Kelowna, City of Vancouver, City of Surrey, City of Burnaby, City of Victoria, City of Kamloops IT support, systems or infrastructure postings",
    "Private-sector IT support, desktop support, help desk, Microsoft 365 / Intune administrator, junior systems administrator or MSP technician jobs in Metro Vancouver, the Fraser Valley, Victoria, Kelowna and the Okanagan",
    "Fully remote Canada IT support, service desk, systems administrator, endpoint/Intune administrator or cloud support associate jobs open to candidates living in British Columbia",
]


def ai_error_text(e: Exception) -> str:
    msg = str(e)
    if "Budget has been exceeded" in msg or "budget" in msg.lower():
        return "AI balance ran out. Top up your Universal Key (Profile → Universal Key → Add Balance), then run again."
    return "AI research service error. Try again shortly."


def clean_html(raw: str) -> str:
    return re.sub(r"\s+", " ", BeautifulSoup(htmlmod.unescape(raw or ""), "html.parser").get_text(" ")).strip()


def in_scope_location(loc: str, text: str = "") -> bool:
    blob = f"{loc} {text[:600]}"
    return bool(BC.search(blob) or (CANADA.search(blob)) or ("remote" in loc.lower() and "canada" in blob.lower()))


def make_job(**kw) -> dict:
    desc = kw.get("description") or ""
    loc = kw.get("location") or ""
    skills = kw.get("skills") or detect_skills(f"{kw.get('title', '')} {desc}")
    return {
        "title": (kw.get("title") or "").strip(),
        "company": (kw.get("company") or "").strip(),
        "location": loc,
        "work_mode": kw.get("work_mode") or work_mode(f"{kw.get('title', '')} {desc[:1500]}", loc),
        "salary": kw.get("salary") or "",
        "employment_type": kw.get("employment_type") or "",
        "date_posted": (kw.get("date_posted") or "")[:10],
        "deadline": (kw.get("deadline") or "")[:10],
        "experience": kw.get("experience") or "",
        "certifications": kw.get("certifications") or [],
        "skills": skills,
        "description": desc[:8000],
        "apply_url": kw.get("apply_url") or kw.get("source_url") or "",
        "source": kw["source"],
        "source_url": kw.get("source_url") or kw.get("apply_url") or "",
    }


async def fetch_ats(client: httpx.AsyncClient) -> list[dict]:
    out = []
    for kind, token, company in ATS_FEEDS:
        try:
            if kind == "greenhouse":
                r = await client.get(f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true")
                for j in r.json().get("jobs", []):
                    loc = (j.get("location") or {}).get("name", "")
                    if is_relevant_title(j.get("title")) and in_scope_location(loc):
                        out.append(make_job(title=j["title"], company=company, location=loc, description=clean_html(j.get("content")),
                                            date_posted=j.get("first_published") or j.get("updated_at"), source="Company careers (Greenhouse)",
                                            source_url=j.get("absolute_url")))
            else:
                r = await client.get(f"https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true")
                for j in r.json().get("jobs", []):
                    loc = j.get("location") or ""
                    if j.get("isRemote"):
                        loc = f"{loc} (Remote)".strip()
                    desc = j.get("descriptionPlain") or clean_html(j.get("descriptionHtml"))
                    if is_relevant_title(j.get("title")) and in_scope_location(loc, desc):
                        comp = (j.get("compensation") or {}).get("compensationTierSummary") or ""
                        out.append(make_job(title=j["title"], company=company, location=loc, description=desc, salary=comp,
                                            employment_type=j.get("employmentType") or "", date_posted=j.get("publishedAt"),
                                            source="Company careers (Ashby)", source_url=j.get("jobUrl"), apply_url=j.get("applyUrl")))
        except Exception as e:
            log.warning("ATS %s/%s failed: %s", kind, token, e)
    return out


async def fetch_adzuna(client: httpx.AsyncClient) -> list[dict]:
    app_id, key = os.environ.get("ADZUNA_APP_ID"), os.environ.get("ADZUNA_APP_KEY")
    if not (app_id and key):
        return []
    out = []
    for q in ADZUNA_QUERIES:
        for where in ["British Columbia", "remote"]:
            try:
                r = await client.get("https://api.adzuna.com/v1/api/jobs/ca/search/1", params={
                    "app_id": app_id, "app_key": key, "what": q, "where": where, "results_per_page": 30, "max_days_old": 30,
                    "sort_by": "date", "content-type": "application/json"})
                for j in r.json().get("results", []):
                    if not is_relevant_title(j.get("title")):
                        continue
                    sal = ""
                    if j.get("salary_min"):
                        sal = f"${int(j['salary_min']):,} - ${int(j.get('salary_max') or j['salary_min']):,}" + (" (estimated)" if str(j.get("salary_is_predicted")) == "1" else "")
                    out.append(make_job(title=clean_html(j["title"]), company=(j.get("company") or {}).get("display_name", ""),
                                        location=(j.get("location") or {}).get("display_name", ""), description=clean_html(j.get("description")),
                                        salary=sal, employment_type=" ".join(filter(None, [j.get("contract_time"), j.get("contract_type")])),
                                        date_posted=j.get("created"), source="Adzuna", source_url=j.get("redirect_url")))
            except Exception as e:
                log.warning("Adzuna %s failed: %s", q, e)
    return out


async def fetch_jsearch(client: httpx.AsyncClient) -> list[dict]:
    key = os.environ.get("RAPIDAPI_KEY")
    if not key:
        return []
    out = []
    for q in JSEARCH_QUERIES:
        try:
            r = await client.get("https://jsearch.p.rapidapi.com/search", params={"query": q, "country": "ca", "date_posted": "month", "num_pages": 1},
                                 headers={"x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com"})
            for j in r.json().get("data", []) or []:
                if not is_relevant_title(j.get("job_title")):
                    continue
                loc = ", ".join(filter(None, [j.get("job_city"), j.get("job_state"), j.get("job_country")]))
                sal = ""
                if j.get("job_min_salary"):
                    sal = f"${int(j['job_min_salary']):,} - ${int(j.get('job_max_salary') or j['job_min_salary']):,} {j.get('job_salary_period') or ''}".strip()
                out.append(make_job(title=j["job_title"], company=j.get("employer_name", ""), location=loc + (" (Remote)" if j.get("job_is_remote") else ""),
                                    work_mode="remote" if j.get("job_is_remote") else None, description=j.get("job_description") or "",
                                    salary=sal, employment_type=j.get("job_employment_type") or "", date_posted=j.get("job_posted_at_datetime_utc"),
                                    deadline=j.get("job_offer_expiration_datetime_utc"), apply_url=j.get("job_apply_link"),
                                    source=f"JSearch ({j.get('job_publisher') or 'Google Jobs'})", source_url=j.get("job_apply_link") or j.get("job_google_link")))
        except Exception as e:
            log.warning("JSearch %s failed: %s", q, e)
    return out


RESEARCH_SYSTEM = (
    "You are a meticulous job-market researcher for British Columbia, Canada. Use web_search to locate employer job portals and "
    "web_fetch to open job search pages and individual postings. Only report postings you actually saw, each with the exact URL of "
    "that single posting (not a search page). Never invent postings, salaries, deadlines or URLs. "
    "Leave a field as an empty string when it is not published. Respond with JSON only."
)


async def research_group(user_id: str, group: str, errors: list | None = None) -> list[dict]:
    prompt = (
        f"Find currently open job postings (posted in the last ~30 days, not expired) for: {group}.\n"
        "Return up to 12 postings as JSON: {\"jobs\": [{\"title\", \"company\", \"location\", \"work_mode\" (remote|hybrid|onsite|unknown), "
        "\"salary\", \"employment_type\", \"date_posted\" (YYYY-MM-DD or \"\"), \"deadline\" (YYYY-MM-DD or \"\"), \"experience\", "
        "\"certifications\" [..], \"skills\" [..], \"description\" (3-6 factual sentences from the posting), \"source_url\" (posting URL)}]}"
    )
    try:
        data = await ask_json(user_id, "research", RESEARCH_SYSTEM, prompt, web_uses=5)
    except Exception as e:
        log.warning("AI research failed: %s", e)
        if errors is not None:
            errors.append(ai_error_text(e))
        return []
    out = []
    for j in data.get("jobs", []) or []:
        if j.get("title") and j.get("source_url", "").startswith("http") and is_relevant_title(j["title"]) and in_scope_location(j.get("location") or "", j.get("description") or ""):
            out.append(make_job(**{**j, "source": "AI web research"}))
    return out


async def url_alive(client: httpx.AsyncClient, url: str) -> bool:
    try:
        r = await client.get(url, headers=UA, follow_redirects=True)
        return r.status_code not in (404, 410)
    except Exception:
        return False


async def ensure_company(user_id: str, name: str, industry: str = "") -> str | None:
    key = norm(name)
    if not key:
        return None
    existing = await db.companies.find_one({"user_id": user_id, "name_key": key}, {"_id": 0, "id": 1})
    if existing:
        return existing["id"]
    cid = new_id("co")
    await db.companies.insert_one({
        "id": cid, "user_id": user_id, "name": name.strip(), "name_key": key, "industry": industry, "location": "",
        "website": "", "careers_url": "", "linkedin_url": "", "it_notes": "", "source_urls": [], "researched_at": None,
        "high_priority": False, "created_at": iso()})
    return cid


async def upsert_jobs(user_id: str, jobs: list[dict], profile: dict) -> dict:
    added = updated = 0
    for j in jobs:
        if not j["title"] or not j["company"]:
            continue
        city = norm(j["location"]).split(" ")[0] if j["location"] else ""
        key = f"{norm(j['title'])}|{norm(j['company'])}|{city}"
        existing = await db.jobs.find_one({"user_id": user_id, "dedupe_key": key}, {"_id": 0, "id": 1, "sources": 1})
        if existing:
            src = {"source": j["source"], "url": j["source_url"]}
            sets = {"last_verified": iso()}
            await db.jobs.update_one({"id": existing["id"]}, {"$set": sets, "$addToSet": {"sources": src}})
            updated += 1
            continue
        cid = await ensure_company(user_id, j["company"])
        doc = {**j, **score_job(j, profile), "id": new_id("job"), "user_id": user_id, "company_id": cid, "dedupe_key": key,
               "sources": [{"source": j["source"], "url": j["source_url"]}], "status": "new", "applied_at": None, "notes": "",
               "last_verified": iso(), "created_at": iso()}
        await db.jobs.insert_one(doc)
        added += 1
    return {"added": added, "updated": updated}


async def run_discovery(user_id: str, task_id: str | None = None, use_ai: bool = True) -> dict:
    from tasks import step
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    async with httpx.AsyncClient(timeout=20, headers=UA) as client:
        await step(task_id, "sources", "running", "Checking employer career feeds and job APIs")
        results = await asyncio.gather(fetch_ats(client), fetch_adzuna(client), fetch_jsearch(client))
        ai_jobs: list[dict] = []
        ai_errors: list[str] = []
        if use_ai:
            await step(task_id, "sources", "running", "AI web research across Job Bank, BC public, education, private and remote sources")
            groups = await asyncio.gather(*[research_group(user_id, g, ai_errors) for g in RESEARCH_GROUPS])
            candidates = [j for g in groups for j in g]
            alive = await asyncio.gather(*[url_alive(client, j["source_url"]) for j in candidates])
            ai_jobs = [j for j, ok in zip(candidates, alive) if ok]
    counts = {"ats": len(results[0]), "adzuna": len(results[1]), "jsearch": len(results[2]), "ai_research": len(ai_jobs)}
    res = await upsert_jobs(user_id, [*results[0], *results[1], *results[2], *ai_jobs], profile)
    summary = {**counts, **res, "ai_errors": len(ai_errors), "finished_at": iso()}
    await db.discovery_runs.insert_one({"id": new_id("run"), "user_id": user_id, **summary, "created_at": iso()})
    note = f" · AI research failed for {len(ai_errors)} of {len(RESEARCH_GROUPS)} searches: {ai_errors[0]}" if ai_errors else ""
    await step(task_id, "sources", "failed" if ai_errors and not res["added"] else "done",
               f"{res['added']} new jobs, {res['updated']} re-verified{note}", {"jobs_added": res["added"]})
    summary["ai_error"] = ai_errors[0] if ai_errors else ""
    return summary


IMPORT_SYSTEM = "You extract structured job posting data from page text. Never invent values; use empty strings when absent. JSON only."


async def import_job_from_link(user_id: str, url: str, pasted_text: str = "") -> dict:
    text = pasted_text.strip()
    if not text:
        async with httpx.AsyncClient(timeout=20, headers=UA, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for t in soup(["script", "style", "nav", "footer", "noscript"]):
                t.decompose()
            text = re.sub(r"\s+", " ", soup.get_text(" "))
    if len(text) < 200:
        raise ValueError("Could not read enough text from that page. Paste the job description text instead.")
    prompt = (
        f"Source URL: {url}\n\nPage text:\n{text[:14000]}\n\nReturn JSON: {{\"title\", \"company\", \"location\", \"work_mode\" "
        "(remote|hybrid|onsite|unknown), \"salary\", \"employment_type\", \"date_posted\" (YYYY-MM-DD or \"\"), \"deadline\" (YYYY-MM-DD or \"\"), "
        "\"experience\", \"certifications\" [..], \"skills\" [..], \"description\" (the core duties and requirements, up to 15 sentences), "
        "\"recruiter\" (name only if printed on the page, else \"\")}"
    )
    data = await ask_json(user_id, "extraction", IMPORT_SYSTEM, prompt)
    if not data.get("title"):
        raise ValueError("No job posting found on that page.")
    source = "Imported link"
    for host, label in [("linkedin.", "LinkedIn (imported)"), ("indeed.", "Indeed (imported)"), ("workbc", "WorkBC (imported)"),
                        ("jobbank", "Job Bank (imported)"), ("guichetemplois", "Job Bank (imported)")]:
        if host in url:
            source = label
    job = make_job(**{**data, "source": source, "source_url": url, "apply_url": url})
    job["recruiter"] = data.get("recruiter") or ""
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    await upsert_jobs(user_id, [job], profile)
    city = norm(job["location"]).split(" ")[0] if job["location"] else ""
    return await db.jobs.find_one({"user_id": user_id, "dedupe_key": f"{norm(job['title'])}|{norm(job['company'])}|{city}"}, {"_id": 0})


async def rescore_all(user_id: str) -> int:
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    n = 0
    async for j in db.jobs.find({"user_id": user_id}, {"_id": 0}):
        await db.jobs.update_one({"id": j["id"]}, {"$set": score_job(j, profile)})
        n += 1
    return n
