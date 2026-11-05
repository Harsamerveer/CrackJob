import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { Input } from "../components/ui/input";
import { PageHeader, Panel, Empty, VerifyTag, TypeBadge } from "../components/bits";
import OutreachComposer, { CopyBtn } from "../components/OutreachComposer";
import { get, relTime } from "../lib/api";

export default function Outreach() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const contactId = params.get("contact");
  const { data: list = [] } = useQuery({ queryKey: ["contacts", "outreach", q], queryFn: () => get("/contacts", { q }) });
  const { data: contact } = useQuery({ queryKey: ["contact", contactId], queryFn: () => get(`/contacts/${contactId}`), enabled: !!contactId });
  const drafts = (contact?.activities || []).filter((a) => a.type === "message_draft");
  return (
    <div>
      <PageHeader eyebrow="06 · Outreach" title="AI Outreach Assistant" desc="Personal, plain-spoken messages built from the person, the role and your real experience. You review, copy and send them yourself." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Choose a contact" testId="outreach-contact-list">
          <div className="relative border-b p-2"><Search className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
            <Input data-testid="outreach-contact-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 pl-8 text-xs" /></div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.length === 0 ? <Empty>No contacts yet.</Empty> : list.map((c) => (
              <button key={c.id} data-testid={`outreach-contact-${c.id}`} onClick={() => setParams({ contact: c.id })}
                className={`row-hover flex w-full flex-col items-start border-b px-3 py-2 text-left last:border-0 ${c.id === contactId ? "bg-sky-500/10" : ""}`}>
                <span className="flex items-center gap-1.5 text-sm">{c.approach_first && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}{c.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{c.title} · {c.company}</span>
              </button>
            ))}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title={contact ? `Writing to ${contact.name}` : "Compose"} right={contact && <div className="flex gap-1.5"><VerifyTag value={contact.verification} /><TypeBadge type={contact.contact_type} /></div>}>
            <div className="p-4"><OutreachComposer contactId={contactId} initialJobId={params.get("job")} /></div>
          </Panel>
          {contactId && (
            <Panel title="Previous drafts" testId="outreach-drafts">
              {drafts.length === 0 ? <Empty>No drafts yet.</Empty> : drafts.map((a) => (
                <div key={a.id} className="border-b p-4 last:border-0">
                  <div className="mb-1 flex items-center justify-between"><span className="font-mono text-[11px] text-muted-foreground">{a.message_type?.replace("_", " ")} · {relTime(a.created_at)}</span><CopyBtn text={a.text} testId={`draft-copy-${a.id}`} /></div>
                  <p className="whitespace-pre-line text-sm text-slate-300">{a.text}</p>
                </div>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
