import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, PenLine, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { VerifyTag, SourceStamp, ScoreBadge } from "./bits";
import { CopyBtn } from "./OutreachComposer";
import { api, get, errMsg, STAGES, CONTACT_TYPES, relTime, fmtDate } from "../lib/api";

const LOG_TYPES = [
  ["request_sent", "Connection request sent"], ["accepted", "Request accepted"], ["conversation", "Conversation"],
  ["follow_up", "Follow-up sent"], ["referral", "Referral received"], ["interview", "Interview scheduled"], ["note", "Note"],
];
const ACT_LABEL = Object.fromEntries([...LOG_TYPES, ["message_draft", "AI draft"], ["message_sent", "Message sent"], ["applied", "Applied"]]);

const Logger = ({ id }) => {
  const qc = useQueryClient();
  const [type, setType] = useState("conversation");
  const [text, setText] = useState("");
  const [days, setDays] = useState("");
  const save = async () => {
    try {
      await api.post(`/contacts/${id}/activities`, { type, text, follow_up_days: days === "" ? null : Number(days) });
      setText(""); setDays("");
      toast.success("Logged");
      qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-2 rounded border p-3">
      <div className="eyebrow">Log activity</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="crm-log-type"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card">{LOG_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Input data-testid="crm-log-followup-days" type="number" min="0" placeholder="Follow up in N days" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <Textarea data-testid="crm-log-text" rows={2} placeholder="What happened? Key points, next steps…" value={text} onChange={(e) => setText(e.target.value)} />
      <Button data-testid="crm-log-save-btn" size="sm" onClick={save} className="bg-sky-500 text-slate-950 hover:bg-sky-400">Add to timeline</Button>
      <p className="text-[11px] text-muted-foreground">Leave days empty for a sensible default reminder (request 5d, accepted 2d, conversation 7d). Enter 0 to clear it.</p>
    </div>
  );
};

export default function ContactDetailSheet({ id, onClose }) {
  const qc = useQueryClient();
  const { data: c } = useQuery({ queryKey: ["contact", id], queryFn: () => get(`/contacts/${id}`), enabled: !!id });
  const [edit, setEdit] = useState({});
  useEffect(() => { if (c) setEdit({ stage: c.stage, contact_type: c.contact_type, outcome: c.outcome || "", notes: c.notes || "", linkedin_url: c.linkedin_url || "", next_follow_up: c.next_follow_up ? c.next_follow_up.slice(0, 10) : "" }); }, [c]);
  const save = async () => {
    const body = { ...edit, next_follow_up: edit.next_follow_up ? new Date(edit.next_follow_up + "T09:00:00").toISOString() : null };
    await api.patch(`/contacts/${id}`, body);
    toast.success("Saved");
    qc.invalidateQueries();
  };
  const remove = async () => {
    if (!window.confirm("Delete this contact and its timeline?")) return;
    await api.delete(`/contacts/${id}`);
    qc.invalidateQueries();
    onClose();
  };
  const set = (k) => (e) => setEdit((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-card sm:max-w-xl" data-testid="contact-detail-sheet">
        {!c ? <div className="font-mono text-xs">Loading…</div> : (
          <div className="space-y-5">
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2"><SheetTitle data-testid="contact-detail-name">{c.name}</SheetTitle><VerifyTag value={c.verification} /></div>
              <div className="text-sm text-muted-foreground">{c.title} · {c.company}{c.location ? ` · ${c.location}` : ""}</div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <SourceStamp url={c.source_url} at={c.verified_at} />
                {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">LinkedIn<ExternalLink className="h-3 w-3" /></a>}
              </div>
            </SheetHeader>
            {(c.relevance || c.approach) && <div className="space-y-1 rounded border p-3 text-xs text-slate-300">
              {c.relevance && <p><span className="text-muted-foreground">Why: </span>{c.relevance}</p>}
              {c.approach && <p><span className="text-muted-foreground">Approach: </span>{c.approach}</p>}
              {c.hiring_manager_evidence && <p className="text-emerald-300">Hiring evidence: {c.hiring_manager_evidence}</p>}
            </div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className="eyebrow mb-1">Stage</div>
                <Select value={edit.stage} onValueChange={set("stage")}><SelectTrigger data-testid="crm-stage-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.entries(STAGES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
              <div><div className="eyebrow mb-1">Type</div>
                <Select value={edit.contact_type} onValueChange={set("contact_type")}><SelectTrigger data-testid="crm-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.entries(CONTACT_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
              <div><div className="eyebrow mb-1">Next follow-up</div><Input data-testid="crm-followup-date" type="date" value={edit.next_follow_up || ""} onChange={set("next_follow_up")} /></div>
              <div><div className="eyebrow mb-1">LinkedIn URL</div><Input data-testid="crm-linkedin-input" value={edit.linkedin_url || ""} onChange={set("linkedin_url")} placeholder="https://www.linkedin.com/in/…" /></div>
              <div className="sm:col-span-2"><div className="eyebrow mb-1">Outcome</div><Input data-testid="crm-outcome-input" value={edit.outcome || ""} onChange={set("outcome")} placeholder="e.g. Referred me to the Service Desk Analyst role" /></div>
              <div className="sm:col-span-2"><div className="eyebrow mb-1">Notes</div><Textarea data-testid="crm-notes-input" rows={2} value={edit.notes || ""} onChange={set("notes")} /></div>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
              <span>request sent: {c.request_sent_at ? fmtDate(c.request_sent_at) : "—"}</span><span>· accepted: {c.accepted_at ? fmtDate(c.accepted_at) : "—"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button data-testid="crm-save-btn" size="sm" onClick={save} className="bg-sky-500 text-slate-950 hover:bg-sky-400">Save changes</Button>
              <Link to={`/outreach?contact=${c.id}`}><Button data-testid="crm-draft-btn" size="sm" variant="secondary"><PenLine className="mr-1.5 h-3.5 w-3.5" />Draft message</Button></Link>
              <Button data-testid="crm-delete-btn" size="sm" variant="ghost" onClick={remove} className="text-rose-400"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
            </div>
            {c.jobs?.length > 0 && <div><div className="eyebrow mb-1.5">Linked jobs</div>{c.jobs.map((j) => <Link key={j.id} to={`/jobs?job=${j.id}`} className="row-hover flex items-center gap-2 rounded px-2 py-1.5"><ScoreBadge score={j.score} /><span className="truncate text-sm">{j.title}</span></Link>)}</div>}
            <Logger id={c.id} />
            <div>
              <div className="eyebrow mb-2">Timeline</div>
              <ol className="space-y-3 border-l pl-4" data-testid="crm-timeline">
                {c.activities.length === 0 && <li className="text-xs text-muted-foreground">No activity yet.</li>}
                {c.activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-sky-400" />
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{ACT_LABEL[a.type] || a.type}{a.message_type ? ` · ${a.message_type.replace("_", " ")}` : ""}</span><span className="font-mono text-[10px] text-muted-foreground">{relTime(a.created_at)}</span></div>
                    {a.text && <p className="mt-1 whitespace-pre-line text-xs text-slate-300">{a.text}</p>}
                    {a.type === "message_draft" && a.text && <div className="mt-1.5"><CopyBtn text={a.text} testId={`timeline-copy-${a.id}`} /></div>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
