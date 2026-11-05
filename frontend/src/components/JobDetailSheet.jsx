import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Bookmark, EyeOff, UserSearch, ExternalLink, PenLine } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { ScoreBadge, SourceStamp, DeadlineFlag, Chip, VerifyTag, TypeBadge } from "./bits";
import TaskProgress, { useTask } from "./TaskProgress";
import { api, get, errMsg, fmtDate } from "../lib/api";

const REC = { apply: ["Apply now", "text-emerald-300"], contact_first: ["Contact someone first", "text-amber-300"], low_fit: ["Low fit, apply only if interested", "text-rose-300"] };

const Field = ({ label, value }) => (
  <div><div className="eyebrow">{label}</div><div className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">Not published</span>}</div></div>
);

const People = ({ job }) => {
  const [task, setTask] = useTask(job.company_id ? `company:${job.company_id}` : null);
  const find = async () => {
    try { setTask(await api.post(`/jobs/${job.id}/find-people`).then((r) => r.data)); toast.success("Researching people at " + job.company); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="eyebrow">People at {job.company}</div>
        <Button data-testid="job-find-people-btn" size="sm" variant="secondary" onClick={find} disabled={task?.status === "running"}>
          <UserSearch className="mr-1.5 h-3.5 w-3.5" />{task?.status === "running" ? "Researching…" : "Find people"}
        </Button>
      </div>
      {task?.status === "running" && <TaskProgress task={task} />}
      {job.contacts.length === 0 ? <p className="text-xs text-muted-foreground">No contacts yet for this employer.</p> : job.contacts.map((c) => (
        <div key={c.id} className="rounded border p-3" data-testid={`job-contact-${c.id}`}>
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{c.name}</span><VerifyTag value={c.verification} /><TypeBadge type={c.contact_type} /></div>
          <div className="text-xs text-muted-foreground">{c.title}</div>
          {(c.job_ids || []).includes(job.id) && <div className="mt-1 text-[11px] text-sky-300">Possibly linked to this opening (inferred unless stated in the posting)</div>}
          <div className="mt-2 flex items-center justify-between"><SourceStamp url={c.source_url} at={c.verified_at} />
            <Link to={`/outreach?contact=${c.id}&job=${job.id}`} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><PenLine className="h-3 w-3" />Draft note</Link>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function JobDetailSheet({ jobId, onClose }) {
  const qc = useQueryClient();
  const { data: job } = useQuery({ queryKey: ["job", jobId], queryFn: () => get(`/jobs/${jobId}`), enabled: !!jobId });
  const setStatus = async (status) => {
    await api.patch(`/jobs/${jobId}`, { status });
    toast.success(status === "applied" ? "Marked as applied" : status === "saved" ? "Saved" : status === "dismissed" ? "Hidden" : "Updated");
    qc.invalidateQueries();
    if (status === "dismissed") onClose();
  };
  return (
    <Sheet open={!!jobId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-card sm:max-w-2xl" data-testid="job-detail-sheet">
        {!job ? <div className="font-mono text-xs text-muted-foreground">Loading…</div> : (
          <div className="space-y-6">
            <SheetHeader className="text-left">
              <div className="flex items-start gap-3">
                <ScoreBadge score={job.score} testId="job-detail-score" />
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-snug" data-testid="job-detail-title">{job.title}</SheetTitle>
                  <div className="text-sm text-muted-foreground">{job.company} · {job.location || "Location not published"} · <span className="capitalize">{job.work_mode}</span></div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <DeadlineFlag deadline={job.deadline} />
                <span className={`text-xs font-medium ${REC[job.recommendation]?.[1]}`} data-testid="job-recommendation">{REC[job.recommendation]?.[0]}</span>
                {job.status !== "new" && <Chip>{job.status}</Chip>}
              </div>
            </SheetHeader>
            <div className="flex flex-wrap gap-2">
              <Button data-testid="job-mark-applied-btn" size="sm" onClick={() => setStatus("applied")} disabled={job.status === "applied"} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{job.status === "applied" ? "Applied" : "Mark applied"}</Button>
              <Button data-testid="job-save-btn" size="sm" variant="secondary" onClick={() => setStatus("saved")}><Bookmark className="mr-1.5 h-3.5 w-3.5" />Save</Button>
              <Button data-testid="job-dismiss-btn" size="sm" variant="ghost" onClick={() => setStatus("dismissed")}><EyeOff className="mr-1.5 h-3.5 w-3.5" />Hide</Button>
              {job.apply_url && <a href={job.apply_url} target="_blank" rel="noreferrer"><Button data-testid="job-apply-link-btn" size="sm" variant="secondary"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open posting</Button></a>}
            </div>
            <div className="rounded border p-3">
              <div className="eyebrow mb-2">Fit breakdown</div>
              <div className="grid grid-cols-5 gap-2 font-mono text-xs">
                {Object.entries(job.breakdown || {}).map(([k, v]) => <div key={k}><div className="text-base font-semibold">{v}</div><div className="text-[10px] text-muted-foreground">{k.replace("_", " ")}</div></div>)}
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex flex-wrap gap-1"><span className="mr-1 text-muted-foreground">You have:</span>{job.matched_skills?.length ? job.matched_skills.map((s) => <Chip key={s} tone="good">{s}</Chip>) : "—"}</div>
                <div className="flex flex-wrap gap-1"><span className="mr-1 text-muted-foreground">To learn:</span>{job.missing_skills?.length ? job.missing_skills.map((s) => <Chip key={s} tone="bad">{s}</Chip>) : "—"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Salary" value={job.salary} /><Field label="Employment type" value={job.employment_type} />
              <Field label="Date posted" value={job.date_posted} /><Field label="Deadline" value={job.deadline} />
              <Field label="Experience" value={job.experience} /><Field label="Certifications" value={(job.certifications || []).join(", ")} />
              <Field label="Recruiter / hiring manager" value={job.recruiter} />
            </div>
            <div>
              <div className="eyebrow mb-1.5">Description</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{job.description || "No description captured."}</p>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Sources</div>
              <div className="space-y-1">{(job.sources || []).map((s, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">{s.source}</span><SourceStamp url={s.url} /></div>)}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">Found {fmtDate(job.created_at)} · last verified {fmtDate(job.last_verified)}</div>
            </div>
            <People job={job} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
