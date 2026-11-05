import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import { api } from "./lib/api";
import Login from "./pages/Login";
import CommandCenter from "./pages/CommandCenter";
import Jobs from "./pages/Jobs";
import Companies from "./pages/Companies";
import People from "./pages/People";
import CRM from "./pages/CRM";
import Outreach from "./pages/Outreach";
import Settings from "./pages/Settings";
import { TrackerPage, SkillsPage, PlanPage, ReportsPage } from "./pages/Later";

function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const done = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(location.hash.slice(1)).get("session_id");
    api
      .post("/auth/session", { session_id: sid })
      .then((r) => {
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true, state: { user: r.data } });
      })
      .catch((e) => setError(e?.response?.data?.detail || "Sign-in failed"));
  }, [location.hash, navigate]);
  if (!error) return null;
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm rounded-md border bg-card p-6 text-center" data-testid="auth-error">
        <p className="text-sm">{error}</p>
        <a href="/login" className="mt-4 inline-block text-sm text-sky-400 hover:underline">Back to sign in</a>
      </div>
    </div>
  );
}

function Protected() {
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [ok, setOk] = useState(location.state?.user ? true : null);
  useEffect(() => {
    if (location.state?.user) return;
    api.get("/auth/me").then((r) => { setUser(r.data); setOk(true); }).catch(() => setOk(false));
  }, [location.state]);
  if (ok === null) return <div className="flex min-h-screen items-center justify-center font-mono text-xs text-muted-foreground">Loading…</div>;
  if (!ok) return <Navigate to="/login" replace />;
  return <Layout user={user} />;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/people" element={<People />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/outreach" element={<Outreach />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}
