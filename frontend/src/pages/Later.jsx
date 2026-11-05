import { ComingSoon, PageHeader } from "../components/bits";

export const TrackerPage = () => (
  <>
    <PageHeader eyebrow="07 · Applications" title="Application Tracker" desc="Jobs you mark as applied are already counted on the Command Center." />
    <ComingSoon phase={2} title="Full application pipeline" items={[
      "13 statuses from Discovered to Archived, as a board and a list",
      "Attach resumes, cover letters, job descriptions and interview notes",
      "A complete history of every action on each application",
    ]} />
  </>
);

export const SkillsPage = () => (
  <>
    <PageHeader eyebrow="08 · Skills" title="Skills & Certifications" desc="Every job is already tagged with matched and missing skills." />
    <ComingSoon phase={3} title="Market demand and learning roadmap" items={[
      "Demand counts for M365, Intune, Entra ID, AD, Azure, PowerShell, ServiceNow, ITIL and more across your jobs",
      "Your skills compared with the market",
      "Learning priorities with labs, Microsoft Learn paths and certification picks",
    ]} />
  </>
);

export const PlanPage = () => (
  <>
    <PageHeader eyebrow="09 · Plan" title="Weekly Execution Plan" desc="Today's moves on the Command Center already come from your real jobs and contacts." />
    <ComingSoon phase={3} title="AI career strategist" items={[
      "A weekly plan built from your actual openings and networking progress",
      "A personalised 30-day job acquisition plan",
      "Ask questions like 'Who should I contact this week?'",
    ]} />
  </>
);

export const ReportsPage = () => (
  <>
    <PageHeader eyebrow="10 · Reports" title="Reports & Analytics" desc="Live counters are on the Command Center." />
    <ComingSoon phase={3} title="Weekly and monthly reports" items={[
      "Conversations, referrals and interviews over time",
      "Response rates by contact type and message type",
      "Fit-score trends and source quality",
    ]} />
  </>
);
