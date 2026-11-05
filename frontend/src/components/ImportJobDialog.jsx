import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { api, errMsg } from "../lib/api";

export default function ImportJobDialog({ open, onOpenChange, onImported }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const job = await api.post("/jobs/import", { url, text }).then((r) => r.data);
      toast.success(`Imported: ${job.title}`);
      setUrl(""); setText("");
      onImported?.(job);
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>Import a job link</DialogTitle>
          <DialogDescription>LinkedIn, Indeed, WorkBC, Job Bank, a university portal or any careers page. AI reads the page and fills in the fields.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input data-testid="import-url-input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Textarea data-testid="import-text-input" rows={5} placeholder="Optional: paste the job description if the site blocks reading (LinkedIn often does)" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <DialogFooter>
          <Button data-testid="import-submit-btn" onClick={submit} disabled={busy || !url} className="bg-sky-500 text-slate-950 hover:bg-sky-400">
            {busy ? "Reading…" : "Import job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
