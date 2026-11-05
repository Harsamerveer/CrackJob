import re

SKILLS = {
    "Microsoft 365": ["microsoft 365", "office 365", "m365", "o365", "exchange online"],
    "Microsoft Intune": ["intune", "endpoint manager"],
    "Microsoft Entra ID": ["entra", "azure ad", "azure active directory"],
    "Active Directory": ["active directory"],
    "Group Policy": ["group policy", "gpo"],
    "Azure": ["azure"],
    "Windows Server": ["windows server"],
    "Windows": ["windows 10", "windows 11", "windows"],
    "macOS": ["macos", "mac os", "jamf"],
    "PowerShell": ["powershell"],
    "Microsoft Defender": ["defender"],
    "Networking / TCP/IP": ["tcp/ip", "dns", "dhcp", "vlan", "lan/wan", "firewall", "networking"],
    "VMware / Hyper-V": ["vmware", "hyper-v", "vsphere", "virtualization"],
    "SharePoint": ["sharepoint"],
    "ServiceNow": ["servicenow"],
    "ITIL": ["itil"],
    "Linux": ["linux", "ubuntu", "red hat", "rhel"],
    "AWS": ["aws", "amazon web services"],
    "MDM": ["mdm", "mobile device management", "apple business manager"],
    "Conditional Access": ["conditional access"],
    "Ticketing / Help Desk": ["ticketing", "help desk", "helpdesk", "service desk", "zendesk", "freshservice", "jira service"],
    "Documentation": ["confluence", "documentation", "knowledge base"],
    "Cybersecurity": ["cybersecurity", "information security"],
    "Hardware Support": ["hardware", "printers", "imaging", "peripherals"],
    "SCCM / ConfigMgr": ["sccm", "configmgr", "configuration manager"],
}
CORE = {"Microsoft 365", "Microsoft Intune", "Microsoft Entra ID", "Azure", "Windows", "MDM"}
_PATTERNS = {k: [re.compile(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])") for a in v] for k, v in SKILLS.items()}

TARGET_TITLE = re.compile(
    r"(it support|support analyst|support specialist|desktop support|service desk|help ?desk|system(s)? admin|sysadmin|"
    r"infrastructure (analyst|support|specialist)|endpoint|intune|microsoft 365|m365|office 365|cloud support|azure admin|"
    r"it operations|technical support|it technician|it analyst|end user|computer technician|it specialist)", re.I)
IT_TITLE = re.compile(
    r"(\bit\b|i\.t\.|help ?desk|service desk|desktop|technical support|tech support|support (analyst|specialist|technician|engineer)|"
    r"system(s)? (administrator|admin|analyst|engineer)|sysadmin|infrastructure|endpoint|intune|microsoft 365|m365|office 365|"
    r"cloud support|azure|network (administrator|analyst|technician)|noc|end user|computer technician|workplace technology)", re.I)
EXCLUDE_TITLE = re.compile(
    r"\b(sales|account executive|marketing|recruiter|designer|product manager|software engineer|software developer|developer|"
    r"data scientist|director|vice president|vp|principal|staff|counsel|accountant|chief|head of|product management|software engineering|manager|marketing|finance)\b", re.I)
SENIOR = re.compile(r"\b(senior|sr\.?|lead|manager|architect|iii|level 3)\b", re.I)
JUNIOR = re.compile(r"\b(junior|jr\.?|entry|associate|level 1|level 2|tier 1|tier 2|i|ii|technician|co-?op|intern)\b", re.I)
BC = re.compile(r"(british columbia|\bbc\b|vancouver|burnaby|surrey|richmond|coquitlam|new westminster|kelowna|victoria|"
                r"kamloops|nanaimo|abbotsford|langley|delta|vernon|penticton|prince george|north vancouver|okanagan)", re.I)
CANADA = re.compile(r"(canada|ontario|alberta|quebec|toronto|calgary|edmonton|ottawa|montreal|manitoba|saskatchewan|nova scotia)", re.I)
YEARS = re.compile(r"(\d{1,2})\+?\s*(?:-\s*\d+\s*)?years?", re.I)


def detect_skills(text: str) -> list[str]:
    t = (text or "").lower()
    return [k for k, pats in _PATTERNS.items() if any(p.search(t) for p in pats)]


def is_relevant_title(title: str) -> bool:
    return bool(IT_TITLE.search(title or "")) and not EXCLUDE_TITLE.search(title or "")


def work_mode(text: str, location: str) -> str:
    t = f"{text or ''} {location or ''}".lower()
    if "hybrid" in t:
        return "hybrid"
    if "remote" in t or "work from home" in t:
        return "remote"
    return "onsite" if location else "unknown"


def score_job(job: dict, profile: dict) -> dict:
    text = f"{job.get('title', '')}\n{job.get('description', '')}\n{' '.join(job.get('skills') or [])}"
    job_skills = sorted(set(detect_skills(text)) | {s for s in (job.get("skills") or []) if s in SKILLS})
    mine = set(profile.get("skills") or [])
    matched = [s for s in job_skills if s in mine]
    missing = [s for s in job_skills if s not in mine]
    weight = lambda s: 2 if s in CORE else 1
    total_w = sum(weight(s) for s in job_skills)
    skills_pts = round(40 * sum(weight(s) for s in matched) / total_w) if total_w else 18
    if len(job_skills) < 3:
        skills_pts = min(skills_pts, 28)
    title = job.get("title", "")
    role_pts = 20 if TARGET_TITLE.search(title) else 10 if IT_TITLE.search(title) else 2
    years = [int(y) for y in YEARS.findall(job.get("description") or "") if int(y) < 20]
    senior = bool(SENIOR.search(title))
    level_pts = 0 if senior else 15 if JUNIOR.search(title) else 11
    if years and min(years) >= 5:
        level_pts = min(level_pts, 5)
    loc = f"{job.get('location', '')} {job.get('work_mode', '')}"
    mode = job.get("work_mode")
    if BC.search(loc):
        loc_pts = 15
    elif mode == "remote" and (CANADA.search(loc) or "canada" in (job.get("description") or "").lower()):
        loc_pts = 14
    elif CANADA.search(loc):
        loc_pts = 4
    else:
        loc_pts = 7
    certs_text = f"{text} {' '.join(job.get('certifications') or [])}".lower()
    cert_pts = 10 if any(k in certs_text for k in ["md-102", "endpoint administrator", "microsoft certified", "az-104", "az-900"]) else 8
    score = max(0, min(100, skills_pts + role_pts + level_pts + loc_pts + cert_pts - (12 if senior else 0)))
    rec = "apply" if score >= 75 else "contact_first" if score >= 55 else "low_fit"
    return {
        "score": score,
        "matched_skills": matched,
        "missing_skills": missing,
        "recommendation": rec,
        "breakdown": {"skills": skills_pts, "role": role_pts, "level": level_pts, "location": loc_pts, "certs_education": cert_pts},
    }
