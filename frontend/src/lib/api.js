import axios from "axios";

export const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const api = axios.create({ baseURL: `${BACKEND}/api`, withCredentials: true });
export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const errMsg = (e) => e?.response?.data?.detail || e?.message || "Something went wrong";

export const CONTACT_TYPES = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  potential_hiring_manager: "Potential hiring manager",
  employee: "Employee contact",
  referral: "Referral opportunity",
};

export const STAGES = {
  identified: "Identified",
  request_sent: "Request sent",
  connected: "Connected",
  conversation: "In conversation",
  referral: "Referral",
  interview: "Interview",
  closed: "Closed",
};

export const SKILL_CATALOG = [
  "Microsoft 365", "Microsoft Intune", "Microsoft Entra ID", "Active Directory", "Group Policy", "Azure", "Windows Server",
  "Windows", "macOS", "PowerShell", "Microsoft Defender", "Networking / TCP/IP", "VMware / Hyper-V", "SharePoint",
  "ServiceNow", "ITIL", "Linux", "AWS", "MDM", "Conditional Access", "Ticketing / Help Desk", "Documentation",
  "Cybersecurity", "Hardware Support", "SCCM / ConfigMgr",
];

export const relTime = (iso) => {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const abs = Math.abs(diff);
  const fmt = (n, u) => `${Math.round(n)}${u}`;
  const s = abs < 60 ? "just now" : abs < 3600 ? fmt(abs / 60, "m") : abs < 86400 ? fmt(abs / 3600, "h") : fmt(abs / 86400, "d");
  if (s === "just now") return s;
  return diff >= 0 ? `${s} ago` : `in ${s}`;
};

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "");

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + "T23:59:59").getTime() - Date.now()) / 86400000);
};
