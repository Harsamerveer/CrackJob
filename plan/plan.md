# BC IT Career Command Center

A personal, AI-assisted system for landing an IT support, sysadmin, infrastructure or cloud support job in British Columbia or remotely in Canada.
It finds real openings, finds the people connected to them, writes outreach, scores fit, and tells you each day what to do next.

## Who it's for
One user: a final-year UBCO BSc (General Studies) student with a Sheridan Computer Systems Technician diploma, a year of hands-on M365/Intune/Entra/Azure support experience at Signal Technologies, and the MD-102 Endpoint Administrator certification. Only you can sign in. Your data is private to your account.

## Core features and experience

**Live IT Job Opportunities**
- Pulls real listings from four places:
  - Public career feeds of employers on your company list (many BC employers post through standard hiring systems that publish openings publicly), plus BC Public Service and other public job pages found by AI web research.
  - Adzuna Canada (needs your free Adzuna key).
  - Google Jobs aggregator (JSearch), which covers LinkedIn, Indeed, Glassdoor and others (needs your RapidAPI key).
  - Paste any job link (LinkedIn, Indeed, WorkBC, Job Bank, a university portal). AI reads the page and fills in the fields.
- Each job shows: title, company, location, remote/hybrid/onsite, salary, type, date posted, deadline, experience, certifications, skills, description, apply link, source URL and a last-verified time.
- Duplicates are merged. Results are sorted with the newest first. Jobs closing within 7 days are flagged.
- You can search and filter by role, city, work mode, score, source and date.
- Discovery runs automatically every day. You can also run it any time.

**AI Job Compatibility Scoring (0–100)**
- Scores each job against your profile on skills, experience, education, certifications, level, location and employment terms.
- Shows the skills you have, the skills you're missing and what to learn. It also gives an apply / contact-first / skip recommendation, resume adjustments and interview topics.
- M365, Azure, Entra ID, Intune, endpoint and Windows work get extra weight. Jobs aren't rejected just because you miss some listed requirements, and a CS degree is never treated as required.

**Companies & Employers**
- AI web research builds a list of BC and remote-Canada employers: government, universities, health authorities, MSPs, telecoms, banks, tech, engineering, manufacturing and automotive.
- Each company shows its industry, location, website, careers page, LinkedIn page, current openings, IT team notes and known contacts. Source links are shown for everything.
- Companies are ranked by active vacancies and how well they fit your skills. The top 30 are marked high priority.

**Recruiters & Hiring Managers**
- People come from three sources:
  1. AI web research of public pages such as company team pages, press releases, conference speaker lists and public profiles that appear in search results.
  2. An optional people-data service (Apollo), using your key.
  3. People you add yourself.
- Each person shows: name, title, company, LinkedIn URL (only if found publicly), website, location, linked jobs, why they matter, their role type and a suggested approach.
- Every fact is labelled **Verified** (with a source link and date) or **Inferred**. Nobody is called a hiring manager for a job without evidence. Emails and profiles are never made up, and LinkedIn is never scraped.

**Networking CRM**
- Contacts are grouped by type: recruiter, hiring manager, employee or referral opportunity.
- Track connection request dates, accepted connections, conversations, referrals, linked jobs, follow-up reminders and outcomes, with a full timeline per contact.

**AI Outreach Assistant**
- Writes 8 message types: connection request (kept within LinkedIn's length limit), post-connection message, IT manager message, recruiter message, referral request, informational interview request, follow-up and thank-you.
- Messages are personalised from the contact, company, job and your real experience. They're written to sound plain and human.
- You copy and send them yourself. Nothing is ever sent for you. Each draft is saved to the contact's history.

**Career Command Center (daily dashboard)**
- Daily targets you can change. Defaults: 10 jobs found, 5 contacts identified, 5 requests sent, 2–3 applications, follow-ups, and skill practice time.
- Counters for applications, requests, accepted connections, conversations, referrals, interviews, follow-ups due and jobs waiting for an application.
- "Today's moves" list: what to do next.

**Application Tracker**
- 13 statuses, from Discovered to Archived, shown as a board and a list. Every change is recorded in a history log with notes.

**Settings & Integrations**
- Profile editor, pre-filled with your background.
- Daily targets.
- Which AI model handles which task.
- Reminder emails on/off.
- Plain-language steps to connect Adzuna, JSearch and Apollo, with a connection status for each.

**CSV export** for jobs, companies, contacts and applications.

**First-launch research:** builds the employer list (target 100), the top 30 companies, current matching jobs, public contacts (target 50), the first 20 people to approach and the first 10 jobs to prioritise. If fewer verified results exist, the real counts are shown. Nothing is padded.

## User flow
1. Sign in with Google. Your profile is already filled in from the brief. Review it.
2. Start the initial research. A progress screen fills companies, jobs and contacts as they're found.
3. Each day, open the Command Center and see today's targets and moves.
4. Open a top-scored job → see who's connected to it → generate a connection note → copy it to LinkedIn → log it as sent.
5. The CRM reminds you to follow up, in the app and by a daily email.
6. Move the application through its statuses as it progresses, and watch referrals and interviews grow on the dashboard.

## UI/UX feel
A calm, information-dense work tool, like a well-made operations console rather than a marketing site. There's a left sidebar with the 11 sections, plus compact tables, clear score badges, and Verified/Inferred tags. Source links and timestamps are always visible. It's fully usable on a phone, where the sidebar becomes a menu.

## Implementation phases

**Phase 1 — MVP (built now): the four core tools you asked for first**
1. **Live Job Discovery**
   - Sources: public career feeds and AI web research, paste-a-link import, and Adzuna and JSearch once their keys are added.
   - Dedupe, deadline flags, search and filters, a daily automatic run, source links and last-verified times.
   - A quick fit score (0–100) with matched and missing skills, so the list is ranked for you.
   - A "Mark applied" button on each job.
   - First run shows the real number of jobs found.
2. **People Finder**
   - AI web research for recruiters, IT managers and relevant employees at the companies behind discovered jobs, plus manual entry.
   - Verified/Inferred labels, source links, why each person matters and a suggested approach.
   - A basic company record for each employer: name, industry, location, website, careers page, LinkedIn page, openings and people.
   - First run targets 50 contacts and the first 20 to approach, showing the real counts.
3. **Networking CRM**
   - Contacts by type, connection dates, accepted connections, conversations, referrals, linked jobs, outcomes and a timeline.
   - Follow-up reminders, in the app and by daily email.
   - Basic AI message drafts: connection request, follow-up and thank-you. You copy and send them yourself.
4. **Career Command Center**
   - Daily targets you can change, live counters and a "Today's moves" list built from your real jobs, contacts and follow-ups due.
- Supporting pieces: Google sign-in, your pre-filled profile, a Settings & Integrations page with key setup steps, and CSV export of jobs and contacts.

**Phase 2**
- Full AI Compatibility Scoring: resume adjustments, interview topics and an apply / contact-first recommendation.
- Full AI Outreach Assistant with all 8 message types.
- Companies & Employers database built by AI research (target 100), with the top 30 prioritised.
- Application Tracker with 13 statuses, action history and file attachments.
- Apollo people-data integration.

**Phase 3**
- AI Career Strategist chat.
- Weekly Execution Plan and 30-day acquisition plan.
- Skills & Certifications tracker with market demand and a learning roadmap.
- Weekly and monthly Reports & Analytics.

## Assumptions
- **AI models.** You picked all three, so each does a different job. Claude Opus 5.5 handles job scoring, research and strategy. Claude Sonnet 5.5 writes outreach messages. GPT 6 Luna handles quick extraction, such as reading pasted job pages. You can change these in Settings. All three run on the Emergent universal key, so no AI key is needed from you, and usage draws from your Emergent balance.
- **People sources.** You picked all three. AI research and manual entry work immediately. Apollo needs your paid key and arrives in Phase 2.
- **Sidebar during Phase 1.** All 11 sections appear in the sidebar from the start. Sections not yet built are marked "coming in Phase 2/3".
- **Reminders.** You picked both options. Daily reminder emails go to your Google sign-in email, and you can switch them off in Settings to get in-app reminders only.
- **No LinkedIn or Indeed access without a provider.** Neither offers a public jobs API, and neither is scraped. Their listings come only through JSearch or links you paste.
- **Job Bank and WorkBC.** Neither offers a live public API, so their postings come in through AI web research, the aggregators or pasted links.
- **Key-dependent sources start empty.** Adzuna, JSearch and Apollo show as "not connected", with setup steps, until you add the keys.
- **Missing details stay blank.** Where a field (salary, deadline, recruiter) isn't published, it's left blank, not estimated.
- **Research takes time.** The first-launch run uses AI web research and may take several minutes. Real counts are shown even if they fall short of 100 companies or 50 contacts.
- **Automatic discovery runs once a day** (early morning, Pacific time).
- **One user.** The app is built for you alone, with no other accounts or sharing.
