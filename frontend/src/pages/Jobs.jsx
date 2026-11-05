import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radar, Link2, Download, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageHeader, ScoreBadge, SourceStamp, DeadlineFlag, Empty, Chip } from "../components/bits";
import TaskProgress, { useTask } from "../components/TaskProgress";
import JobDetailSheet from "../components/JobDetailSheet";
import ImportJobDialog from "../components/ImportJobDialog";
import { api, get, errMsg, BACKEND } from "../lib/api";

const CITIES = ["Vancouver", "Burnaby", "Surrey", "Richmond", "Coquitlam", "New Westminster", "Kelowna", "West Kelowna", "Victoria", "Kamloops"];

const F = ({ value, onChange, placeholder, items, testId }) => (
  <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
    <SelectTrigger data-testid={testId} className="h-9 w-full text-xs sm:w-[150px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="bg-card">
      <SelectItem value="all">{placeholder}</SelectItem>
      {items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState({ q: "", work_mode: "", min_score: "", city: "", source: "", posted_days: "", status: "", sort: params.get("sort") || "" });
  const [importOpen, setImportOpen] = useState(false);
  const [task, setTask] = useTask("discovery");
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["jobs", f], queryFn: () => get("/jobs", Object.fromEntries(Object.entries(f).filter(([, v]) => v))) });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const openJob = (id) => setParams(id ? { job: id } : {});
  const run = async () => {
    try { setTask(await api.post("/discovery/run").then((r) => r.data)); toast.success("Discovery started. This can take a few minutes."); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const running = task?.status === "running";

  return (
    <div>
      <PageHeader eyebrow="02 · Live jobs" title="Live IT Job Opportunities"
        desc="Real listings from employer career feeds, AI web research, Adzuna, JSearch and links you import. Duplicates are merged; every job shows its source and last-verified time."
        actions={<>
          <Button data-testid="discover-jobs-btn" onClick={run} disabled={running} size="sm" className="bg-sky-500 text-slate-950 hover:bg-sky-400">
            <Radar className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />{running ? "Discovering…" : "Run discovery"}
          </Button>
          <Button data-testid="import-job-btn" onClick={() => setImportOpen(true)} size="sm" variant="secondary"><Link2 className="mr-2 h-4 w-4" />Import link</Button>
          <a href={`${BACKEND}/api/export/jobs`} data-testid="export-jobs-btn"><Button size="sm" variant="ghost"><Download className="mr-2 h-4 w-4" />CSV</Button></a>
        </>} />
      {running && <div className="mb-4"><TaskProgress task={task} testId="discovery-progress" /></div>}
      {task?.status === "failed" && <p className="mb-4 text-xs text-rose-400">Last discovery stopped: {task.error}</p>}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="jobs-search-input" value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="Search title, company, skills…" className="h-9 pl-8 text-sm" />
        </div>
        <F testId="filter-work-mode" value={f.work_mode} onChange={set("work_mode")} placeholder="Any work mode" items={[["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "Onsite"], ["unknown", "Unknown"]]} />
        <F testId="filter-city" value={f.city} onChange={set("city")} placeholder="Any city" items={CITIES.map((c) => [c, c])} />
        <F testId="filter-min-score" value={f.min_score} onChange={set("min_score")} placeholder="Any score" items={[["75", "75+ strong"], ["55", "55+ worth it"], ["40", "40+"]]} />
        <F testId="filter-source" value={f.source} onChange={set("source")} placeholder="Any source" items={[["careers", "Company careers"], ["AI web", "AI web research"], ["Adzuna", "Adzuna"], ["JSearch", "JSearch"], ["imported", "Imported links"]]} />
        <F testId="filter-posted" value={f.posted_days} onChange={set("posted_days")} placeholder="Found any time" items={[["1", "Found today"], ["7", "Last 7 days"], ["30", "Last 30 days"]]} />
        <F testId="filter-status" value={f.status} onChange={set("status")} placeholder="Active" items={[["new", "New"], ["saved", "Saved"], ["applied", "Applied"], ["dismissed", "Hidden"]]} />
        <F testId="sort-select" value={f.sort} onChange={set("sort")} placeholder="Newest first" items={[["score", "Best fit first"]]} />
      </div>

      <div className="mb-2 font-mono text-[11px] text-muted-foreground" data-testid="jobs-count">{jobs.length} jobs</div>
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="hidden grid-cols-[56px_1fr_180px_110px_200px] gap-3 border-b px-4 py-2 eyebrow md:grid">
          <span>Fit</span><span>Role · Company</span><span>Location</span><span>Posted</span><span>Source</span>
        </div>
        {isLoading ? <Empty>Loading…</Empty> : jobs.length === 0 ? (
          <Empty testId="jobs-empty">No jobs match. Run discovery or import a link. Adzuna and JSearch add many more once connected in Settings.</Empty>
        ) : jobs.map((j) => (
          <button key={j.id} data-testid={`job-row-${j.id}`} onClick={() => openJob(j.id)}
            className="row-hover grid w-full grid-cols-[48px_1fr] gap-3 border-b px-4 py-3 text-left last:border-0 md:grid-cols-[56px_1fr_180px_110px_200px] md:items-center">
            <ScoreBadge score={j.score} testId={`job-score-${j.id}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{j.title}</span>
                <DeadlineFlag deadline={j.deadline} />
                {j.status === "applied" && <Chip tone="good">applied</Chip>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{j.company}{j.salary ? ` · ${j.salary}` : ""}</div>
              <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                <Chip>{j.work_mode}</Chip><Chip>{j.location || "n/a"}</Chip>
              </div>
              <div className="mt-1 md:hidden"><SourceStamp url={j.source_url} label={j.source} at={j.last_verified} /></div>
            </div>
            <div className="hidden text-xs md:block"><div className="truncate">{j.location || "—"}</div><div className="capitalize text-muted-foreground">{j.work_mode}</div></div>
            <div className="hidden font-mono text-xs text-muted-foreground md:block">{j.date_posted || "—"}</div>
            <div className="hidden md:block"><SourceStamp url={j.source_url} label={j.source} at={j.last_verified} /></div>
          </button>
        ))}
      </div>
      <JobDetailSheet jobId={params.get("job")} onClose={() => openJob(null)} />
      <ImportJobDialog open={importOpen} onOpenChange={setImportOpen} onImported={(j) => j && openJob(j.id)} />
    </div>
  );
}
