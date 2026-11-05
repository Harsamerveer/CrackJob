import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, ShieldCheck, Briefcase, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  useEffect(() => {
    api.get("/auth/me").then(() => navigate("/", { replace: true })).catch(() => {});
  }, [navigate]);

  const signIn = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="grid-bg relative hidden flex-col justify-between border-r p-12 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-500 text-slate-950"><Radar className="h-4 w-4" /></div>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">BC IT Career Command Center</span>
        </div>
        <div className="max-w-lg">
          <div className="eyebrow mb-4">Find → Identify → Connect → Interview → Hired</div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Where to apply, who to contact, what to say, and when to follow up.</h1>
          <div className="mt-10 space-y-4 text-sm text-slate-300">
            <div className="flex gap-3"><Briefcase className="h-4 w-4 text-sky-400 mt-0.5" /> Real IT openings across BC and remote Canada, scored against your experience.</div>
            <div className="flex gap-3"><Users className="h-4 w-4 text-sky-400 mt-0.5" /> Public recruiters and IT leaders, with source links for every fact.</div>
            <div className="flex gap-3"><ShieldCheck className="h-4 w-4 text-sky-400 mt-0.5" /> Verified vs inferred, always labelled. Nothing is made up, and nothing is sent for you.</div>
          </div>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">Private workspace · single owner</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm fade-up">
          <div className="eyebrow mb-2">Sign in</div>
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">This workspace is private. The first Google account to sign in becomes its only owner.</p>
          <Button data-testid="google-login-btn" onClick={signIn} className="mt-8 h-11 w-full bg-sky-500 font-medium text-slate-950 hover:bg-sky-400">
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
