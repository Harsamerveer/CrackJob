import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, Search, BellRing } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { PageHeader, Empty, VerifyTag, TypeBadge } from "../components/bits";
import ContactFormDialog from "../components/ContactFormDialog";
import ContactDetailSheet from "../components/ContactDetailSheet";
import { get, STAGES, BACKEND, relTime } from "../lib/api";

export default function CRM() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [add, setAdd] = useState(false);
  const filters = { q, ...(stage === "due" ? { due: true } : stage !== "all" ? { stage } : {}) };
  const { data: list = [], isLoading } = useQuery({ queryKey: ["contacts", "crm", filters], queryFn: () => get("/contacts", filters) });
  const open = (id) => setParams(id ? { contact: id } : {});
  return (
    <div>
      <PageHeader eyebrow="05 · CRM" title="Networking CRM" desc="Every person you're working with, where each relationship stands, and when to follow up."
        actions={<>
          <Button data-testid="crm-add-contact-btn" size="sm" onClick={() => setAdd(true)} className="bg-sky-500 text-slate-950 hover:bg-sky-400"><Plus className="mr-2 h-4 w-4" />Add contact</Button>
          <a href={`${BACKEND}/api/export/contacts`}><Button size="sm" variant="ghost"><Download className="mr-2 h-4 w-4" />CSV</Button></a>
        </>} />
      <Tabs value={stage} onValueChange={setStage} className="mb-3">
        <TabsList className="h-auto flex-wrap justify-start bg-card">
          <TabsTrigger data-testid="crm-tab-all" value="all">All</TabsTrigger>
          <TabsTrigger data-testid="crm-tab-due" value="due"><BellRing className="mr-1 h-3 w-3" />Due</TabsTrigger>
          {Object.entries(STAGES).map(([v, l]) => <TabsTrigger key={v} data-testid={`crm-tab-${v}`} value={v}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="relative mb-3"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input data-testid="crm-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="h-9 pl-8" /></div>
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="hidden grid-cols-[1fr_200px_130px_130px] gap-3 border-b px-4 py-2 eyebrow md:grid"><span>Contact</span><span>Type</span><span>Stage</span><span>Follow-up</span></div>
        {isLoading ? <Empty>Loading…</Empty> : list.length === 0 ? <Empty testId="crm-empty">No contacts here.</Empty> : list.map((c) => {
          const due = c.next_follow_up && c.next_follow_up <= new Date().toISOString();
          return (
            <button key={c.id} data-testid={`crm-row-${c.id}`} onClick={() => open(c.id)} className="row-hover grid w-full grid-cols-1 gap-1 border-b px-4 py-3 text-left last:border-0 md:grid-cols-[1fr_200px_130px_130px] md:items-center md:gap-3">
              <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{c.name}</span><VerifyTag value={c.verification} /></div>
                <div className="truncate text-xs text-muted-foreground">{c.title} · {c.company}</div></div>
              <div><TypeBadge type={c.contact_type} /></div>
              <div className="text-xs">{STAGES[c.stage] || c.stage}</div>
              <div className={`font-mono text-[11px] ${due ? "text-amber-300" : "text-muted-foreground"}`}>{c.next_follow_up ? relTime(c.next_follow_up) : "—"}</div>
            </button>
          );
        })}
      </div>
      <ContactFormDialog open={add} onOpenChange={setAdd} onSaved={(c) => open(c.id)} />
      <ContactDetailSheet id={params.get("contact")} onClose={() => open(null)} />
    </div>
  );
}
