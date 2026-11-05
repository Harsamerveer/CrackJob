import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Building2, UserSearch, Users, PenLine, KanbanSquare, GraduationCap, CalendarCheck,
  BarChart3, Settings, Menu, LogOut, Radar,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { api } from "../lib/api";

export const NAV = [
  { to: "/", label: "Career Command Center", icon: LayoutDashboard, id: "command-center" },
  { to: "/jobs", label: "Live IT Job Opportunities", icon: Briefcase, id: "jobs" },
  { to: "/companies", label: "Companies & Employers", icon: Building2, id: "companies" },
  { to: "/people", label: "Recruiters & Hiring Managers", icon: UserSearch, id: "people" },
  { to: "/crm", label: "Networking CRM", icon: Users, id: "crm" },
  { to: "/outreach", label: "AI Outreach Assistant", icon: PenLine, id: "outreach" },
  { to: "/tracker", label: "Application Tracker", icon: KanbanSquare, id: "tracker", phase: 2 },
  { to: "/skills", label: "Skills & Certifications", icon: GraduationCap, id: "skills", phase: 3 },
  { to: "/plan", label: "Weekly Execution Plan", icon: CalendarCheck, id: "plan", phase: 3 },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3, id: "reports", phase: 3 },
  { to: "/settings", label: "Settings & Integrations", icon: Settings, id: "settings" },
];

const NavList = ({ onPick }) => (
  <nav className="flex flex-col gap-0.5 px-2">
    {NAV.map(({ to, label, icon: Icon, id, phase }) => (
      <NavLink
        key={to}
        to={to}
        end={to === "/"}
        onClick={onPick}
        data-testid={`sidebar-nav-${id}`}
        className={({ isActive }) =>
          `group flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors duration-150 ${
            isActive ? "bg-sky-500/10 text-sky-300" : "text-slate-300 hover:bg-secondary hover:text-white"
          }`
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {phase && <span className="rounded border border-border px-1 font-mono text-[9px] text-muted-foreground">P{phase}</span>}
      </NavLink>
    ))}
  </nav>
);

const Brand = () => (
  <div className="flex items-center gap-2 px-4 py-4">
    <div className="flex h-7 w-7 items-center justify-center rounded bg-sky-500 text-slate-950"><Radar className="h-4 w-4" /></div>
    <div className="leading-tight">
      <div className="text-sm font-semibold">BC IT Career</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Command Center</div>
    </div>
  </div>
);

const UserBox = ({ user }) => {
  const logout = async () => {
    await api.post("/auth/logout");
    window.location.href = "/login";
  };
  return (
    <div className="flex items-center gap-2 border-t px-4 py-3">
      {user?.picture ? <img src={user.picture} alt="" className="h-7 w-7 rounded-full" /> : <div className="h-7 w-7 rounded-full bg-secondary" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium" data-testid="current-user-name">{user?.name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{user?.email}</div>
      </div>
      <button data-testid="logout-btn" aria-label="Sign out" onClick={logout} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-white">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
};

export default function Layout({ user }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-[#0d121c] lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto py-2"><NavList /></div>
        <UserBox user={user} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button data-testid="mobile-menu-btn" aria-label="Open menu" className="rounded p-1.5 hover:bg-secondary"><Menu className="h-5 w-5" /></button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col bg-[#0d121c] p-0">
              <Brand />
              <div className="flex-1 overflow-y-auto py-2"><NavList onPick={() => setOpen(false)} /></div>
              <UserBox user={user} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">BC IT Career Command Center</span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
