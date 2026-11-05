import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Download, Star, UserSearch, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { PageHeader, Empty, ScoreBadge, VerifyTag, TypeBadge, SourceStamp } from "../components/bits";
import TaskProgress, { useTask } from "../components/TaskProgress";
import { api, get, errMsg, relTime, BACKEND } from "../lib/api";

const L = ({ href, label }) => href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">{label}<ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-muted-foreground">{label}: not found</span>;

const CompanyDialog = ({ id, onClose }) => {
  const { data: co } = useQuery({ queryKey: ["company", id], queryFn: () => get(`/companies/${id}`), enabled: !!id });
  const [task, setTask] = useTask(id ? `company:${id}` : null);
  const research = async () => {
    try { setTask(await api.post(`/companies/${id}/research`).then((r) => r.data)); toast.success("Researching company and people"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-card" data-testid="company-dialog">
        {!co ? <div className="font-mono text-xs">Loading…</div> : (
          <div className="space-y-5">
            <DialogHeader className="text-left">
              <DialogTitle data-testid="company-dialog-name">{co.name}</DialogTitle>
              <div className="text-sm text-muted-foreground">{co.industry || "Industry unknown"} · {co.location || "Location not researched"}</div>
            </DialogHeader>
            <div className="flex flex-wrap gap-4"><L href={co.website} label="Website" /><L href={co.careers_url} label="Careers page" /><L href={co.linkedin_url} label="LinkedIn page" /></div>
            {co.it_notes && <div><div className="eyebrow mb-1">IT department notes</div><p className="text-sm text-slate-300">{co.it_notes}</p></div>}
            {co.source_urls?.length > 0 && <div className="flex flex-wrap gap-2">{co.source_urls.map((u) => <SourceStamp key={u} url={u} />)}</div>}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">Researched {relTime(co.researched_at)}</span>
              <Button data-testid="company-research-btn" size="sm" variant="secondary" onClick={research} disabled={task?.status === "running"}>
                <UserSearch className="mr-1.5 h-3.5 w-3.5" />{task?.status === "running" ? "Researching…" : "Research company & people"}
              </Button>
            </div>
            {task?.status === "running" && <TaskProgress task={task} />}
            <div>
              <div className="eyebrow mb-2">Open roles ({co.jobs.length})</div>
              {co.jobs.length === 0 ? <p className="text-xs text-muted-foreground">No current relevant openings found.</p> : co.jobs.map((j) => (
                <Link key={j.id} to={`/jobs?job=${j.id}`} className="row-hover flex items-center gap-3 rounded px-2 py-1.5"><ScoreBadge score={j.score} /><span className="truncate text-sm">{j.title}</span></Link>
              ))}
            </div>
            <div>
              <div className="eyebrow mb-2">People ({co.contacts.length})</div>
              {co.contacts.length === 0 ? <p className="text-xs text-muted-foreground">No public contacts yet.</p> : co.contacts.map((c) => (
                <Link key={c.id} to={`/crm?contact=${c.id}`} className="row-hover flex flex-wrap items-center gap-2 rounded px-2 py-1.5">
                  <span className="text-sm">{c.name}</span><span className="text-xs text-muted-foreground">{c.title}</span><VerifyTag value={c.verification} /><TypeBadge type={c.contact_type} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function Companies() {
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState(false);
  const [open, setOpen] = useState(null);
  const { data: cos = [], isLoading } = useQuery({ queryKey: ["companies", q, priority], queryFn: () => get("/companies", { q, priority }) });
  return (
    <div>
      <PageHeader eyebrow="03 · Employers" title="Companies & Employers"
        desc="BC and remote-Canada employers, ranked by active vacancies and fit. Research a company to fill in its website, careers page, LinkedIn page, IT notes and public contacts."
        actions={<a href={`${BACKEND}/api/export/companies`} data-testid="export-companies-btn"><Button size="sm" variant="ghost"><Download className="mr-2 h-4 w-4" />CSV</Button></a>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="companies-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employers…" className="h-9 pl-8" /></div>
        <label className="flex items-center gap-2 text-sm"><Switch data-testid="companies-priority-toggle" checked={priority} onCheckedChange={setPriority} />High priority only</label>
      </div>
      <div className="mb-2 font-mono text-[11px] text-muted-foreground" data-testid="companies-count">{cos.length} employers</div>
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="hidden grid-cols-[1fr_180px_90px_90px_120px] gap-3 border-b px-4 py-2 eyebrow md:grid"><span>Employer</span><span>Industry</span><span>Openings</span><span>Contacts</span><span>Researched</span></div>
        {isLoading ? <Empty>Loading…</Empty> : cos.length === 0 ? <Empty testId="companies-empty">No employers yet. Run initial research from the Command Center.</Empty> : cos.map((c) => (
          <button key={c.id} data-testid={`company-row-${c.id}`} onClick={() => setOpen(c.id)} className="row-hover grid w-full grid-cols-1 gap-1 border-b px-4 py-3 text-left last:border-0 md:grid-cols-[1fr_180px_90px_90px_120px] md:items-center md:gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">{c.high_priority && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.industry || "—"}</div>
            <div className="font-mono text-xs"><span className={c.open_jobs ? "text-emerald-300" : "text-muted-foreground"}>{c.open_jobs}</span><span className="md:hidden"> openings</span></div>
            <div className="font-mono text-xs text-muted-foreground">{c.contacts_count}<span className="md:hidden"> contacts</span></div>
            <div className="font-mono text-[11px] text-muted-foreground">{c.researched_at ? relTime(c.researched_at) : "not yet"}</div>
          </button>
        ))}
      </div>
      <CompanyDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
