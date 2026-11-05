import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, Search, PenLine, Linkedin, Star } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageHeader, Empty, VerifyTag, TypeBadge, SourceStamp } from "../components/bits";
import ContactFormDialog from "../components/ContactFormDialog";
import { get, CONTACT_TYPES, BACKEND } from "../lib/api";

const PersonCard = ({ c }) => (
  <div data-testid={`person-card-${c.id}`} className="flex flex-col rounded-md border bg-card p-4 fade-up">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold">{c.approach_first && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}<span className="truncate">{c.name}</span></div>
        <div className="truncate text-xs text-muted-foreground">{c.title} · {c.company}</div>
        {c.location && <div className="text-[11px] text-muted-foreground">{c.location}</div>}
      </div>
      <VerifyTag value={c.verification} testId={`person-verify-${c.id}`} />
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5"><TypeBadge type={c.contact_type} /><span className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{c.origin === "manual" ? "Added by you" : "AI research"}</span></div>
    {c.evidence && c.origin !== "manual" && <p className="mt-2.5 border-l-2 border-emerald-500/40 pl-2 text-[11px] italic text-slate-400">“{c.evidence}”</p>}
    {c.relevance && <p className="mt-2 text-xs text-slate-300"><span className="text-muted-foreground">Why: </span>{c.relevance}</p>}
    {c.approach && <p className="mt-1 text-xs text-slate-300"><span className="text-muted-foreground">Approach: </span>{c.approach}</p>}
    {c.contact_type === "potential_hiring_manager" && <p className="mt-1 text-[11px] text-amber-300/80">Not confirmed as the hiring manager for any specific vacancy.</p>}
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
      <SourceStamp url={c.source_url} at={c.verified_at} testId={`person-source-${c.id}`} />
      <div className="flex items-center gap-2">
        {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn profile" className="text-sky-400 hover:text-sky-300"><Linkedin className="h-4 w-4" /></a>}
        <Link to={`/crm?contact=${c.id}`} data-testid={`person-open-crm-${c.id}`} className="text-xs text-sky-400 hover:underline">Track</Link>
        <Link to={`/outreach?contact=${c.id}`} data-testid={`person-draft-${c.id}`} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><PenLine className="h-3 w-3" />Draft</Link>
      </div>
    </div>
  </div>
);

export default function People() {
  const [f, setF] = useState({ q: "", contact_type: "", verification: "", approach_first: false });
  const [add, setAdd] = useState(false);
  const { data: people = [], isLoading } = useQuery({ queryKey: ["contacts", f], queryFn: () => get("/contacts", Object.fromEntries(Object.entries(f).filter(([, v]) => v))) });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v === "all" ? "" : v }));
  return (
    <div>
      <PageHeader eyebrow="04 · People" title="Recruiters & Hiring Managers"
        desc="Publicly named recruiters, IT leaders and team members. Verified means a public page names them in that role (source linked). Inferred means the role link is a judgement. LinkedIn is never scraped."
        actions={<>
          <Button data-testid="add-person-btn" size="sm" onClick={() => setAdd(true)} className="bg-sky-500 text-slate-950 hover:bg-sky-400"><Plus className="mr-2 h-4 w-4" />Add person</Button>
          <a href={`${BACKEND}/api/export/contacts`} data-testid="export-contacts-btn"><Button size="sm" variant="ghost"><Download className="mr-2 h-4 w-4" />CSV</Button></a>
        </>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="people-search-input" value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="Search name, company, title…" className="h-9 pl-8" /></div>
        <Select value={f.contact_type || "all"} onValueChange={set("contact_type")}>
          <SelectTrigger data-testid="people-type-filter" className="h-9 sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card"><SelectItem value="all">All types</SelectItem>{Object.entries(CONTACT_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.verification || "all"} onValueChange={set("verification")}>
          <SelectTrigger data-testid="people-verify-filter" className="h-9 sm:w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card"><SelectItem value="all">Verified + inferred</SelectItem><SelectItem value="verified">Verified only</SelectItem><SelectItem value="inferred">Inferred only</SelectItem></SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch data-testid="people-first20-toggle" checked={f.approach_first} onCheckedChange={(v) => setF((p) => ({ ...p, approach_first: v }))} />First 20 to approach</label>
      </div>
      <div className="mb-2 font-mono text-[11px] text-muted-foreground" data-testid="people-count">{people.length} people</div>
      {isLoading ? <Empty>Loading…</Empty> : people.length === 0 ? (
        <div className="rounded-md border bg-card"><Empty testId="people-empty">No people yet. Run initial research, use "Find people" on a job, or add someone yourself.</Empty></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{people.map((c) => <PersonCard key={c.id} c={c} />)}</div>
      )}
      <ContactFormDialog open={add} onOpenChange={setAdd} />
    </div>
  );
}
