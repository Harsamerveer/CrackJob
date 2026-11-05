import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api, errMsg, CONTACT_TYPES } from "../lib/api";

const EMPTY = { name: "", title: "", company: "", location: "", linkedin_url: "", website: "", email: "", contact_type: "recruiter", relevance: "", notes: "" };

export default function ContactFormDialog({ open, onOpenChange, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const qc = useQueryClient();
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const save = async () => {
    try {
      const c = await api.post("/contacts", f).then((r) => r.data);
      toast.success("Contact added");
      setF(EMPTY);
      qc.invalidateQueries();
      onSaved?.(c);
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  const inp = (k, ph) => <Input data-testid={`contact-form-${k}`} placeholder={ph} value={f[k]} onChange={set(k)} />;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>Add a contact</DialogTitle>
          <DialogDescription>Someone you found or met yourself. Save their LinkedIn profile URL so you can find them again.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {inp("name", "Full name *")}{inp("title", "Job title")}{inp("company", "Company")}{inp("location", "Location")}
          {inp("linkedin_url", "LinkedIn profile URL")}{inp("website", "Website")}{inp("email", "Work email (if shared with you)")}
          <Select value={f.contact_type} onValueChange={set("contact_type")}>
            <SelectTrigger data-testid="contact-form-type"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">{Object.entries(CONTACT_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea data-testid="contact-form-relevance" className="sm:col-span-2" rows={2} placeholder="Why they matter" value={f.relevance} onChange={set("relevance")} />
        </div>
        <DialogFooter>
          <Button data-testid="contact-form-save-btn" disabled={!f.name.trim()} onClick={save} className="bg-sky-500 text-slate-950 hover:bg-sky-400">Save contact</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
