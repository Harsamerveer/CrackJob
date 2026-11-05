import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { get } from "../lib/api";

export function useTask(kind, onDone) {
  const [task, setTask] = useState(null);
  const qc = useQueryClient();
  useEffect(() => {
    if (!kind) return;
    let alive = true;
    let timer;
    const poll = async () => {
      try {
        const t = await get("/tasks/latest", { kind });
        if (!alive) return;
        setTask((prev) => {
          if (prev?.status === "running" && t.status && t.status !== "running") {
            qc.invalidateQueries();
            onDone?.(t);
          }
          return t;
        });
        timer = setTimeout(poll, t.status === "running" ? 3000 : 15000);
      } catch {
        timer = setTimeout(poll, 10000);
      }
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  return [task, setTask];
}

const Icon = ({ s }) =>
  s === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : s === "running" ? <Loader2 className="h-4 w-4 animate-spin text-sky-400" /> : s === "failed" ? <XCircle className="h-4 w-4 text-rose-400" /> : <Circle className="h-4 w-4 text-muted-foreground" />;

export default function TaskProgress({ task, testId = "task-progress" }) {
  if (!task?.id) return null;
  return (
    <div data-testid={testId} className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">{task.status === "running" ? "In progress" : task.status === "failed" ? "Stopped" : "Last run"}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{new Date(task.started_at).toLocaleString("en-CA")}</span>
      </div>
      <ul className="space-y-2">
        {task.steps?.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5 text-sm">
            <Icon s={task.status === "failed" && s.status === "running" ? "failed" : s.status} />
            <div>
              <div>{s.label}</div>
              {s.detail && <div className="text-xs text-muted-foreground" data-testid={`task-step-${s.key}-detail`}>{s.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
      {task.error && <p className="mt-3 text-xs text-rose-400" data-testid="task-error">{task.error}</p>}
    </div>
  );
}
