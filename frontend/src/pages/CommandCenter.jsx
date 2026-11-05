import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Radar, Timer, Rocket } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Panel, PageHeader, ScoreBadge, Empty, TypeBadge, VerifyTag, SourceStamp } from "../components/bits";
import TaskProgress, { useTask } from "../components/TaskProgress";
import { api, get, errMsg, relTime } from "../lib/api";

const TARGET_LABELS = {
  jobs_discovered: "Jobs discovered", contacts_identified: "Contacts identified", requests_sent: "Requests sent",
  applications: "Applications", follow_ups: "Follow-ups sent", skill_minutes: "Skill practice (min)",
};
const TOTAL_LABELS = {
  applications: "Applications submitted", requests_sent: "Networking requests", accepted: "Connections accepted",
  conversations: "Conversations", referrals: "Referrals", interviews: "Interviews", follow_ups_due: "Follow-ups due",
  awaiting_application: "Awaiting application",
};
const HIGHLIGHT = new Set(["conversations", "referrals", "interviews"]);

const SetupPanel = () => {
  const [task, setTask] = useTask("initial");
  const start = async () => {
    try { setTask(await api.post("/research/initial").then((r) => r.data)); toast.success("Initial research started"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const running = task?.status === "running";
  return (
    <Panel testId="setup-panel" className="mb-6 border-sky-500/30">
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="eyebrow mb-2 text-sky-300">First launch</div>
          <h2 className="text-lg font-semibold">Run your initial research</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Builds your BC employer list, finds current IT vacancies across public feeds and AI web research, looks up publicly named
            recruiters and IT leaders, then ranks your first 20 people and top 10 jobs. This takes several minutes. Real counts are shown,
            never padded.
          </p>
          <Button data-testid="start-initial-research-btn" onClick={start} disabled={running} className="mt-5 bg-sky-500 text-slate-950 hover:bg-sky-400">
            <Rocket className="mr-2 h-4 w-4" /> {running ? "Research running…" : task?.id ? "Run again" : "Start initial research"}
          </Button>
        </div>
        <TaskProgress task={task} testId="initial-research-progress" />
      </div>
    </Panel>
  );
};

const TargetTile = ({ k, value, target }) => {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div data-testid={`target-${k}`} className="rounded-md border bg-card p-3.5">
      <div className="text-xs text-muted-foreground">{TARGET_LABELS[k]}</div>
      <div className="mt-1.5 flex items-baseline gap-1 font-mono">
        <span className="text-2xl font-semibold" data-testid={`target-${k}-value`}>{value}</span>
        <span className="text-xs text-muted-foreground">/ {target}</span>
      </div>
      <Progress value={pct} className="mt-2.5 h-1 bg-secondary" />
    </div>
  );
};

const SkillLogger = () => {
  const [min, setMin] = useState(30);
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const save = async () => {
    await api.post("/activities/skill", { type: "skill_practice", minutes: Number(min), text: text || "Skill practice" });
    toast.success("Practice logged");
    setText("");
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
      <Timer className="h-4 w-4 text-muted-foreground" />
      <Input data-testid="skill-log-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you practise? e.g. Intune compliance lab" className="h-8 min-w-[200px] flex-1 text-xs" />
      <Input data-testid="skill-log-minutes" type="number" value={min} onChange={(e) => setMin(e.target.value)} className="h-8 w-20 text-xs" />
      <Button data-testid="skill-log-btn" size="sm" variant="secondary" onClick={save}>Log</Button>
    </div>
  );
};

export default function CommandCenter() {
  const { data: d, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => get("/dashboard"), refetchInterval: 30000 });
  if (isLoading || !d) return <div className="font-mono text-xs text-muted-foreground">Loading dashboard…</div>;
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Vancouver" });
  return (
    <div>
      <PageHeader eyebrow={`01 · ${today}`} title="Career Command Center"
        desc="Progress is measured by conversations, referrals and interviews, not just applications."
        actions={<Link to="/jobs"><Button data-testid="go-jobs-btn" variant="secondary" size="sm"><Radar className="mr-2 h-4 w-4" />Job discovery</Button></Link>} />
      {!d.setup_done && <SetupPanel />}

      <div className="mb-2 eyebrow">Today's targets</div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.keys(TARGET_LABELS).map((k) => <TargetTile key={k} k={k} value={d.today[k] || 0} target={d.targets[k] || 0} />)}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4 xl:grid-cols-8">
        {Object.entries(TOTAL_LABELS).map(([k, label]) => (
          <div key={k} data-testid={`total-${k}`} className="bg-card p-3.5">
            <div className={`font-mono text-xl font-semibold ${HIGHLIGHT.has(k) ? "text-sky-300" : ""} ${k === "follow_ups_due" && d.totals[k] ? "text-amber-300" : ""}`}>{d.totals[k]}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="Today's moves" testId="todays-moves" right={<span className="font-mono text-[11px] text-muted-foreground">{d.moves.length} actions</span>}>
          {d.moves.length === 0 ? <Empty>All caught up for today.</Empty> : (
            <ul>
              {d.moves.map((m, i) => (
                <li key={i}>
                  <Link to={m.link} data-testid={`move-${i}`} className="row-hover flex items-center gap-3 border-b px-4 py-3 last:border-0">
                    <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-sky-400">{m.kind.replace("_", " ")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{m.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.detail}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <SkillLogger />
        </Panel>

        <Panel title="Top jobs to act on" testId="top-jobs" right={<Link to="/jobs?sort=score" className="text-xs text-sky-400 hover:underline">All jobs</Link>}>
          {d.top_jobs.length === 0 ? <Empty>No jobs yet. Run discovery to pull real listings.</Empty> : (
            <ul>
              {d.top_jobs.map((j) => (
                <li key={j.id}>
                  <Link to={`/jobs?job=${j.id}`} data-testid={`top-job-${j.id}`} className="row-hover flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
                    <ScoreBadge score={j.score} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{j.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{j.company} · {j.location || "location n/a"} · {j.work_mode}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Follow-ups due" testId="followups-due">
          {d.due_contacts.length === 0 ? <Empty>No follow-ups due.</Empty> : (
            <ul>
              {d.due_contacts.map((c) => (
                <li key={c.id}>
                  <Link to={`/crm?contact=${c.id}`} className="row-hover flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.title} · {c.company}</div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-amber-300">due {relTime(c.next_follow_up)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Discovery status" testId="discovery-status">
          <div className="space-y-2 p-4 text-sm">
            {d.last_run ? (
              <>
                <div>Last run <span className="font-mono text-xs text-muted-foreground">{relTime(d.last_run.created_at)}</span></div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-muted-foreground sm:grid-cols-3">
                  <span>new: {d.last_run.added}</span><span>re-verified: {d.last_run.updated}</span><span>AI research: {d.last_run.ai_research}</span>
                  <span>career feeds: {d.last_run.ats}</span><span>Adzuna: {d.last_run.adzuna}</span><span>JSearch: {d.last_run.jsearch}</span>
                </div>
              </>
            ) : <div className="text-muted-foreground">Discovery hasn't run yet.</div>}
            {d.last_run?.ai_error && <p data-testid="discovery-ai-error" className="text-xs text-rose-400">{d.last_run.ai_error}</p>}
            <div className="pt-2 text-xs text-muted-foreground">Totals: {d.totals.jobs} jobs · {d.totals.companies} employers · {d.totals.contacts} contacts. Runs automatically every day at 6am Pacific.</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export { TypeBadge, VerifyTag, SourceStamp };
