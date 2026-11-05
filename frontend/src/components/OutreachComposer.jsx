import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, Sparkles, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api, get, errMsg, BACKEND } from "../lib/api";

export const MSG_TYPES = [
  ["connection_request", "LinkedIn connection request", true],
  ["follow_up", "Follow-up message", true],
  ["thank_you", "Thank-you message", true],
  ["post_connection", "Message after connecting", false],
  ["it_manager", "Message to an IT manager", false],
  ["recruiter", "Message to an internal recruiter", false],
  ["referral", "Referral request", false],
  ["informational", "Informational interview request", false],
];
const SENT_ACTIVITY = { connection_request: "request_sent", follow_up: "follow_up", thank_you: "message_sent" };

export const CopyBtn = ({ text, testId }) => {
  const [ok, setOk] = useState(false);
  return (
    <Button data-testid={testId} size="sm" variant="secondary" disabled={!text} onClick={async () => {
      await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500);
    }}>{ok ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{ok ? "Copied" : "Copy"}</Button>
  );
};

export default function OutreachComposer({ contactId, initialJobId }) {
  const qc = useQueryClient();
  const [type, setType] = useState("connection_request");
  const [jobId, setJobId] = useState(initialJobId || "");
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef(null);
  const { data: contact } = useQuery({ queryKey: ["contact", contactId], queryFn: () => get(`/contacts/${contactId}`), enabled: !!contactId });
  const { data: coJobs = [] } = useQuery({ queryKey: ["company-jobs", contact?.company_id], queryFn: () => get(`/companies/${contact.company_id}`).then((c) => c.jobs), enabled: !!contact?.company_id });
  useEffect(() => { setText(""); setJobId(initialJobId || ""); }, [contactId, initialJobId]);

  const generate = async () => {
    setBusy(true); setText("");
    abort.current = new AbortController();
    try {
      const res = await fetch(`${BACKEND}/api/outreach/stream`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, signal: abort.current.signal,
        body: JSON.stringify({ contact_id: contactId, message_type: type, job_id: jobId || null, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Could not generate");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          const ev = JSON.parse(p.slice(6));
          if (ev.t) setText((s) => s + ev.t);
          if (ev.error) toast.error(ev.error);
        }
      }
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
    } catch (e) { if (e.name !== "AbortError") toast.error(e.message); }
    finally { setBusy(false); }
  };

  const markSent = async () => {
    try {
      await api.post(`/contacts/${contactId}/activities`, { type: SENT_ACTIVITY[type], text: text.trim() });
      toast.success("Logged as sent. Follow-up reminder set.");
      qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!contactId) return <p className="text-sm text-muted-foreground">Pick a contact to start.</p>;
  const limit = type === "connection_request" ? 200 : null;
  const len = text.trim().length;
  return (
    <div className="space-y-3" data-testid="outreach-composer">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="outreach-type-select"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card">
            {MSG_TYPES.map(([v, l, on]) => <SelectItem key={v} value={v} disabled={!on}>{l}{on ? "" : " · Phase 2"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={jobId || "none"} onValueChange={(v) => setJobId(v === "none" ? "" : v)}>
          <SelectTrigger data-testid="outreach-job-select"><SelectValue placeholder="Related job (optional)" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="none">No specific job</SelectItem>
            {coJobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Textarea data-testid="outreach-notes-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context: where you saw them, what you talked about, a shared connection…" />
      <Button data-testid="outreach-generate-btn" onClick={generate} disabled={busy} className="bg-sky-500 text-slate-950 hover:bg-sky-400">
        <Sparkles className="mr-2 h-4 w-4" />{busy ? "Writing…" : text ? "Rewrite" : "Write message"}
      </Button>
      <Textarea data-testid="outreach-output" rows={type === "connection_request" ? 4 : 8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your draft appears here. Edit it freely before copying." className="font-[inherit] text-sm leading-relaxed" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span data-testid="outreach-char-count" className={`font-mono text-[11px] ${limit && len > limit ? "text-rose-400" : "text-muted-foreground"}`}>{len}{limit ? ` / ${limit} chars` : " chars"}</span>
        <div className="flex gap-2">
          <CopyBtn text={text} testId="outreach-copy-btn" />
          <Button data-testid="outreach-mark-sent-btn" size="sm" variant="secondary" disabled={!text || busy} onClick={markSent}><Send className="mr-1.5 h-3.5 w-3.5" />I sent it</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Nothing is sent for you. Copy the message, send it yourself on LinkedIn, then press "I sent it" to log it.</p>
    </div>
  );
}
