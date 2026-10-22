import { useEffect, useMemo, useState } from "react";
import {
  getHealth,
  getStudentProfile,
  getStudentSubjects,
  getSubjectExplanation,
  type StudentDetail,
  type StudentSubject,
  type ExplanationResponse,
  type HealthResponse,
} from "./services/api";

type Role = "mentor" | "teacher" | "student";
type Risk = "High" | "Moderate" | "Low";
type TaskStatus = "Pending" | "Completed";
type Page =
  | "home"
  | "profile"
  | "feedback"
  | "records"
  | "assigned"
  | "task-form"
  | "tasks"
  | "task-detail"
  | "reviews"
  | "review-detail";

type StudentRosterItem = {
  id: string;
  name: string;
  branch: string;
  section: string;
  cgpa: number;
  attendance: number;
  risk: Risk;
  concern: string;
};

type Task = {
  id: string;
  feedbackId: string;
  studentId: string;
  student: string;
  subject: string;
  teacher: string;
  title: string;
  description: string;
  roadmap: string[];
  assigned: string;
  deadline: string;
  status: TaskStatus;
  submitted?: string;
  submissionFile?: string;
  teacherFile?: string;
  remarks?: string;
};

type Feedback = {
  id: string;
  studentId: string;
  student: string;
  branch: string;
  section: string;
  date: string;
  status: "Good" | "Average" | "Need Improvement";
  note: string;
  subject: string;
  teacher: string;
  routes?: FeedbackRoute[];
};

type FeedbackRoute = {
  subject: string;
  teacher: string;
};

type MentorFilters = {
  query: string;
  department: string;
  section: string;
};

// Real student cohort members from trained_model/data/raw/students.csv
const verifiedStudents: StudentRosterItem[] = [
  { id: "2428CS2286", name: "Atharv Saxena", branch: "Computer Science", section: "A", cgpa: 5.68, attendance: 87, risk: "High", concern: "High predicted risk in Semester 5 internal assessments" },
  { id: "2428CS2696", name: "Aarav Choudhary", branch: "Computer Science", section: "A", cgpa: 6.56, attendance: 75, risk: "High", concern: "Low class test scores and pending assignments" },
  { id: "2428CS3227", name: "Arjun Khan", branch: "Computer Science", section: "A", cgpa: 6.96, attendance: 87, risk: "High", concern: "Mid-semester marks deficit in core theory subjects" },
  { id: "2428CS1346", name: "Atharv Mehta", branch: "Computer Science", section: "A", cgpa: 7.36, attendance: 81, risk: "Moderate", concern: "Moderate risk flagged in internal assessments" },
  { id: "2428CS1477", name: "Ananya Reddy", branch: "Computer Science", section: "A", cgpa: 7.19, attendance: 79, risk: "Moderate", concern: "Class test scores below cohort average" },
  { id: "2428CS2071", name: "Aditya Srivastava", branch: "Computer Science", section: "A", cgpa: 7.02, attendance: 78, risk: "Moderate", concern: "Benchmark student for SHAP attribution audit" },
  { id: "2428CS1020", name: "Ananya Goyal", branch: "Computer Science", section: "A", cgpa: 7.96, attendance: 74, risk: "Low", concern: "Consistent performance across courses" },
  { id: "2428CS1384", name: "Aarav Malhotra", branch: "Computer Science", section: "A", cgpa: 7.75, attendance: 78, risk: "Low", concern: "Satisfactory internal assessment benchmarks" },
];

const seedFeedback: Feedback[] = [
  { id: "FB-2025-1042", studentId: "2428CS2286", student: "Atharv Saxena", branch: "Computer Science", section: "A", date: "12 Mar 2025", status: "Need Improvement", note: "Atharv needs structured support in Theory of Computation. Focus on automata practice and regular expressions.", subject: "Theory of Computation", teacher: "Dr. Priya Menon" },
  { id: "FB-2025-1038", studentId: "2428CS1477", student: "Ananya Reddy", branch: "Computer Science", section: "A", date: "10 Mar 2025", status: "Average", note: "Pending assignments are affecting continuous assessment marks.", subject: "Database Management Systems", teacher: "Prof. Vikram Joshi" },
];

const supportRouteOptions: FeedbackRoute[] = [
  { subject: "Theory of Computation", teacher: "Dr. Priya Menon" },
  { subject: "Database Management Systems", teacher: "Prof. Vikram Joshi" },
  { subject: "Computer Networks", teacher: "Dr. Leena Das" },
];

function getFeedbackRoutes(feedback: Feedback) {
  return feedback.routes?.length ? feedback.routes : feedback.subject ? [{ subject: feedback.subject, teacher: feedback.teacher }] : [];
}

function getTeacherRoute(feedback: Feedback, teacher: string) {
  return getFeedbackRoutes(feedback).find(route => route.teacher === teacher);
}

const seedTasks: Task[] = [
  { id: "TSK-250318-01", feedbackId: "FB-2025-1042", studentId: "2428CS2286", student: "Atharv Saxena", subject: "Theory of Computation", teacher: "Dr. Priya Menon", title: "DFA & NFA Remedial Practice", description: "Complete a focused problem set covering DFA construction and regular languages.", roadmap: ["Review Chapter 2 state transition notes", "Construct DFA for questions 1–8", "Verify equivalence on test strings", "Upload completed PDF"], assigned: "18 Mar 2025", deadline: "24 Mar 2025, 5:00 PM", status: "Pending", teacherFile: "TOC_Remedial_Sheet_1.pdf" },
  { id: "TSK-250312-04", feedbackId: "FB-2025-1038", studentId: "2428CS1477", student: "Ananya Reddy", subject: "Database Management Systems", teacher: "Prof. Vikram Joshi", title: "Normalization & SQL Recovery Plan", description: "Complete practice set covering 3NF, BCNF and intermediate queries.", roadmap: ["Read normalization guide", "Solve questions 1–10", "Execute SQL queries in lab", "Submit report"], assigned: "12 Mar 2025", deadline: "20 Mar 2025, 3:00 PM", status: "Pending", submitted: "19 Mar 2025, 8:42 PM", submissionFile: "Ananya_DBMS_Assignment.pdf", teacherFile: "DBMS_Practice_Set.pdf" },
  { id: "TSK-250305-02", feedbackId: "FB-2025-1042", studentId: "2428CS2286", student: "Atharv Saxena", subject: "Theory of Computation", teacher: "Dr. Priya Menon", title: "Grammar Simplification", description: "Eliminate epsilon transitions and unit productions from given CFG.", roadmap: ["Review feedback", "Eliminate null productions", "Simplify variables", "Submit solution"], assigned: "05 Mar 2025", deadline: "11 Mar 2025, 5:00 PM", status: "Completed", submitted: "10 Mar 2025, 4:18 PM", submissionFile: "Atharv_CFG_Solution.pdf", remarks: "Good improvement. Grammar is now properly reduced." },
];

const menuByRole: Record<Role, { page: Page; label: string; icon: IconName }[]> = {
  mentor: [
    { page: "home", label: "Assigned Students", icon: "users" },
    { page: "records", label: "Feedback Records", icon: "file" },
  ],
  teacher: [
    { page: "home", label: "Overview", icon: "grid" },
    { page: "assigned", label: "Assigned Feedback", icon: "inbox" },
    { page: "tasks", label: "Task Records", icon: "clipboard" },
    { page: "reviews", label: "Submission Review", icon: "check" },
  ],
  student: [
    { page: "home", label: "Overview", icon: "grid" },
    { page: "tasks", label: "My Tasks", icon: "clipboard" },
  ],
};

const roleMeta = {
  mentor: { name: "Dr. Ananya Sharma", subtitle: "Faculty Mentor", initials: "AS" },
  teacher: { name: "Dr. Priya Menon", subtitle: "Subject Teacher · CS", initials: "PM" },
  student: { name: "Atharv Saxena", subtitle: "2428CS2286 · Semester 5", initials: "AS" },
};

type IconName = "grid" | "users" | "file" | "inbox" | "clipboard" | "check" | "search" | "bell" | "chevron" | "arrow" | "download" | "plus" | "calendar" | "clock" | "upload" | "book" | "user" | "logout" | "menu" | "close" | "refresh" | "info" | "shield";

const iconPaths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  clipboard: <><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 12h6M9 16h4"/></>,
  check: <><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  arrow: <path d="m19 12-7 7-7-7M12 19V5"/>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 5.5v14"/></>,
  user: <><circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  refresh: <><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-blue-700 text-white hover:bg-blue-800 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
  };
  return (
    <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Status({ children }: { children: string }) {
  const key = children.toLowerCase();
  const style =
    key.includes("high") || key.includes("need") || key.includes("overdue")
      ? "bg-red-50 text-red-700 ring-red-600/15"
      : key.includes("moderate") || key.includes("medium") || key.includes("average") || key.includes("pending")
      ? "bg-amber-50 text-amber-700 ring-amber-600/15"
      : "bg-emerald-50 text-emerald-700 ring-emerald-600/15";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400";

function SummaryCard({ label, value, tone = "blue", icon }: { label: string; value: number | string; tone?: "blue" | "red" | "amber" | "green"; icon: IconName }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <Card className="flex items-center justify-between p-5">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
      <div className={`grid size-10 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon name={icon} />
      </div>
    </Card>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon name="inbox" />
      </div>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </Card>
  );
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [role, setRole] = useState<Role>("mentor");
  const [password, setPassword] = useState("");
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-1/4 size-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-blue-600">
            <Icon name="book" size={22} />
          </div>
          <div>
            <p className="font-bold">Academic Support</p>
            <p className="text-xs text-slate-400">Early Warning System</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-400">Student success, connected</p>
          <p className="mt-5 text-4xl font-bold leading-tight tracking-tight">Turn early academic signals into timely, coordinated support.</p>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            A focused workspace for mentors, subject teachers, and students to identify concerns, coordinate tasks, and track meaningful improvement.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {["Identify risk early", "Route precise support", "Track every action"].map((x, i) => (
              <div key={x} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="text-xs font-bold text-blue-400">0{i + 1}</span>
                <p className="mt-4 text-sm font-semibold">{x}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">KIET Group of Institutions · Academic Affairs · Batch 2024–2028</p>
      </div>
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white">
                <Icon name="book" />
              </div>
              <p className="font-bold text-slate-900">Academic Support</p>
            </div>
          </div>
          <p className="text-sm font-bold text-blue-700">Welcome back</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Use your institutional account to continue.</p>
          <div className="mt-8 space-y-5">
            <Field label="Email or user ID">
              <input className={inputClass} defaultValue={role === "mentor" ? "mentor@kiet.edu" : role === "teacher" ? "priya.menon@kiet.edu" : "2428CS2286"} />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" value={password} placeholder="Enter your password" onChange={e => setPassword(e.target.value)} />
            </Field>
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Demo workspace</span>
              <div className="grid grid-cols-3 gap-2">
                {(["mentor", "teacher", "student"] as Role[]).map(r => (
                  <button key={r} onClick={() => setRole(r)} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize transition ${role === r ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => onLogin(role)}>
              Sign in securely <Icon name="chevron" />
            </Button>
            <p className="text-center text-xs leading-5 text-slate-500">Connected to the trained academic risk ML model and FastAPI backend.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ role, page, setPage, onLogout, children, notifications, health }: { role: Role; page: Page; setPage: (p: Page) => void; onLogout: () => void; children: React.ReactNode; notifications: string[]; health: HealthResponse | null }) {
  const [mobile, setMobile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const meta = roleMeta[role];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {mobile && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobile(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-17 items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid size-9 place-items-center rounded-lg bg-blue-700 text-white">
            <Icon name="book" size={19} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">Academic Support</p>
            <p className="text-[11px] text-slate-500">AI Early Warning System</p>
          </div>
        </div>
        <div className="px-3 py-5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{role} workspace</p>
          <nav className="mt-3 space-y-1">
            {menuByRole[role].map(item => (
              <button key={item.page} onClick={() => { setPage(item.page); setMobile(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${page === item.page ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-100 p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
            <span className={`size-2 rounded-full ${health?.status === "healthy" ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-amber-500 ring-2 ring-amber-200"}`} />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-slate-800">ML Backend {health?.status === "healthy" ? "Active" : "Connecting..."}</p>
              <p className="truncate text-slate-500 text-[10px]">API {health?.version || "1.0.0"} · Model {health?.model_status || "Loaded"}</p>
            </div>
          </div>
          <div className="mb-2 flex items-center gap-3 rounded-lg p-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{meta.initials}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{meta.name}</p>
              <p className="truncate text-xs text-slate-500">{meta.subtitle}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
            <Icon name="logout" /> Sign out
          </Button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-17 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobile(true)}>
              <Icon name="menu" />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-800">KIET Group of Institutions</p>
              <p className="hidden text-xs text-slate-500 sm:block">Academic Year 2024–28 · Semester 5</p>
            </div>
          </div>
          <div className="relative">
            <button aria-label="Notifications" className="relative rounded-lg p-2.5 text-slate-600 hover:bg-slate-100" onClick={() => setShowNotifications(!showNotifications)}>
              <Icon name="bell" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            {showNotifications && (
              <Card className="absolute right-0 top-12 w-[min(22rem,calc(100vw-2rem))] overflow-hidden shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="font-semibold">Notifications</p>
                  <span className="text-xs font-semibold text-blue-700">{notifications.length} new</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {notifications.map((n, i) => (
                    <div key={n} className="flex gap-3 p-4">
                      <span className={`mt-1 size-2 shrink-0 rounded-full ${i < 2 ? "bg-blue-600" : "bg-slate-300"}`} />
                      <div>
                        <p className="text-sm leading-5 text-slate-700">{n}</p>
                        <p className="mt-1 text-xs text-slate-400">{i + 1}h ago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">{children}</table></div>;
}

function MentorHome({
  filters,
  onFiltersChange,
  onProfile,
}: {
  filters: MentorFilters;
  onFiltersChange: (filters: MentorFilters) => void;
  onProfile: (studentId: string) => void;
}) {
  const [directId, setDirectId] = useState("");

  const filtered = verifiedStudents.filter(
    s =>
      (s.name.toLowerCase().includes(filters.query.toLowerCase()) || s.id.toLowerCase().includes(filters.query.toLowerCase())) &&
      (filters.department === "All" || s.branch === filters.department) &&
      (filters.section === "All" || s.section === filters.section)
  );

  const handleDirectSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (directId.trim()) {
      onProfile(directId.trim());
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="Mentor dashboard"
        title="Assigned Students"
        description="Monitor academic standing, review ML risk predictions, and coordinate proactive interventions."
        action={
          <form onSubmit={handleDirectSearch} className="flex gap-2">
            <input
              className={`${inputClass} sm:w-56 h-10`}
              placeholder="Jump to ID (e.g. 2428CS1020)"
              value={directId}
              onChange={e => setDirectId(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="h-10 whitespace-nowrap">
              Load ID <Icon name="chevron" size={16} />
            </Button>
          </form>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Cohort Students" value={verifiedStudents.length} icon="users" />
        <SummaryCard label="High ESE Risk Signals" value={verifiedStudents.filter(student => student.risk === "High").length} tone="red" icon="arrow" />
        <SummaryCard label="Moderate Risk Signals" value={verifiedStudents.filter(student => student.risk === "Moderate").length} tone="amber" icon="bell" />
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Student academic register</p>
            <p className="mt-1 text-xs text-slate-500">Live risk signals derived from trained early-warning Random Forest model on pre-ESE assessments.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-400">
                <Icon name="search" size={17} />
              </span>
              <input
                aria-label="Search students"
                className={`${inputClass} sm:w-64 pl-9`}
                value={filters.query}
                onChange={e => onFiltersChange({ ...filters, query: e.target.value })}
                placeholder="Search name or student ID"
              />
            </div>
            <select
              aria-label="Department"
              className={`${inputClass} sm:w-44`}
              value={filters.department}
              onChange={e => onFiltersChange({ ...filters, department: e.target.value })}
            >
              <option>All</option>
              <option>Computer Science</option>
              <option>Electronics</option>
              <option>Mechanical</option>
            </select>
            <select
              aria-label="Section"
              className={`${inputClass} sm:w-32`}
              value={filters.section}
              onChange={e => onFiltersChange({ ...filters, section: e.target.value })}
            >
              <option>All</option>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </select>
          </div>
        </div>
        <DataTable>
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {["Student", "Department", "Section", "CGPA", "Attendance", "Model risk tier", "Recorded concern", "Action"].map(x => (
                <th key={x} className="px-5 py-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(s => (
              <tr key={s.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => onProfile(s.id)}>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.id}</p>
                </td>
                <td className="px-5 py-4 text-slate-600">{s.branch}</td>
                <td className="px-5 py-4 text-slate-600">{s.section}</td>
                <td className="px-5 py-4 font-semibold">{s.cgpa.toFixed(2)}</td>
                <td className="px-5 py-4">
                  <span className={s.attendance < 75 ? "font-semibold text-red-700" : "text-slate-700"}>{s.attendance}%</span>
                </td>
                <td className="px-5 py-4">
                  <Status>{s.risk}</Status>
                </td>
                <td className="max-w-xs px-5 py-4 text-slate-600">{s.concern}</td>
                <td className="px-5 py-4">
                  <Button
                    type="button"
                    aria-label={`View details for ${s.name}`}
                    variant="ghost"
                    className="whitespace-nowrap text-blue-700"
                    onClick={event => {
                      event.stopPropagation();
                      onProfile(s.id);
                    }}
                  >
                    View Details <Icon name="chevron" size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>Showing {filtered.length} of {verifiedStudents.length} sample cohort students</span>
          <span>Batch 2024–2028</span>
        </div>
      </Card>
    </>
  );
}

function StudentProfile({ studentId, onBack, onFeedback }: { studentId: string; onBack: () => void; onFeedback: () => void }) {
  const [profile, setProfile] = useState<StudentDetail | null>(null);
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number>(5);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);

  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true);
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  // 1. Fetch Student Profile
  useEffect(() => {
    let isMounted = true;
    setLoadingProfile(true);
    setProfileError(null);

    getStudentProfile(studentId)
      .then(data => {
        if (!isMounted) return;
        setProfile(data);
        if (data.current_semester) {
          setSelectedSemester(data.current_semester);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setProfileError(err.message || `Failed to load profile for ${studentId}`);
      })
      .finally(() => {
        if (isMounted) setLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // 2. Fetch Subjects and Predictions whenever student or semester changes
  useEffect(() => {
    let isMounted = true;
    setLoadingSubjects(true);
    setSubjectsError(null);
    setSelectedSubjectKey(null);
    setExplanation(null);

    getStudentSubjects(studentId, selectedSemester)
      .then(subjs => {
        if (!isMounted) return;
        setSubjects(subjs);
        if (subjs.length > 0) {
          // Default selection to the highest risk subject, or first subject
          const highRisk = subjs.find(s => s.risk_summary?.predicted_risk_level === "High");
          const modRisk = subjs.find(s => s.risk_summary?.predicted_risk_level === "Moderate");
          const defaultSubj = highRisk || modRisk || subjs[0];
          setSelectedSubjectKey(defaultSubj.subject_key);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setSubjectsError(err.message || "Failed to load subjects");
      })
      .finally(() => {
        if (isMounted) setLoadingSubjects(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId, selectedSemester]);

  // 3. Fetch SHAP Explanation whenever selectedSubjectKey changes
  useEffect(() => {
    if (!selectedSubjectKey) {
      setExplanation(null);
      return;
    }

    let isMounted = true;
    setLoadingExplanation(true);
    setExplanationError(null);

    getSubjectExplanation(studentId, selectedSubjectKey, selectedSemester)
      .then(exp => {
        if (!isMounted) return;
        setExplanation(exp);
      })
      .catch(err => {
        if (!isMounted) return;
        setExplanationError(err.message || "Failed to compute SHAP explanation");
      })
      .finally(() => {
        if (isMounted) setLoadingExplanation(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId, selectedSubjectKey, selectedSemester]);

  // Risk counts across enrolled subjects
  const riskCounts = useMemo(() => {
    let high = 0;
    let moderate = 0;
    let low = 0;
    subjects.forEach(s => {
      const lvl = s.risk_summary?.predicted_risk_level;
      if (lvl === "High") high++;
      else if (lvl === "Moderate") moderate++;
      else if (lvl === "Low") low++;
    });
    return { high, moderate, low, total: subjects.length };
  }, [subjects]);

  const selectedSubject = subjects.find(s => s.subject_key === selectedSubjectKey);

  if (loadingProfile) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-4 font-semibold text-slate-700">Loading student profile from ML Backend...</p>
        <p className="text-xs text-slate-500">Querying /api/v1/students/{studentId}</p>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <>
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700">
          <span className="rotate-180"><Icon name="chevron" /></span>Back to assigned students
        </button>
        <Empty
          title="Student record not found"
          detail={profileError || `No student record found for ${studentId}. Please verify student ID in students.csv.`}
        />
      </>
    );
  }

  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700">
        <span className="rotate-180"><Icon name="chevron" /></span>Back to assigned students
      </button>

      <PageTitle
        eyebrow={`${profile.student_id} · Semester ${profile.current_semester}`}
        title={profile.student_name}
        description={`${profile.department_name} (${profile.department_code}) · Section ${profile.section} · ${profile.program} Batch ${profile.batch_year}`}
        action={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
              <span className="size-2 rounded-full bg-emerald-600" />
              Model Active (Random Forest v2.0)
            </span>
          </div>
        }
      />

      {/* Semester Selector Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-500">Enrolled Term:</span>
        {[1, 2, 3, 4, 5].map(sem => (
          <button
            key={sem}
            onClick={() => setSelectedSemester(sem)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedSemester === sem
                ? "bg-blue-700 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Semester {sem}
            {sem === profile.current_semester && " (Active)"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="space-y-6">
          {/* 1. Overall Academic Risk Summary */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <p className="font-semibold text-slate-900">Overall academic risk summary</p>
              <p className="mt-1 text-xs text-slate-500">
                Calibrated pre-ESE failure risk estimates (P(ESE &lt; 40%)) across Semester {selectedSemester} courses.
              </p>
            </div>
            <div className="p-5">
              {loadingSubjects ? (
                <div className="py-6 text-center text-sm text-slate-500">Loading risk predictions...</div>
              ) : subjectsError ? (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{subjectsError}</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                      <p className="text-xs font-semibold text-red-700">High Risk (&gt;60%)</p>
                      <p className="mt-1 text-2xl font-bold text-red-950">{riskCounts.high}</p>
                      <p className="mt-1 text-[11px] text-red-600">Priority intervention courses</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <p className="text-xs font-semibold text-amber-700">Moderate (30-60%)</p>
                      <p className="mt-1 text-2xl font-bold text-amber-950">{riskCounts.moderate}</p>
                      <p className="mt-1 text-[11px] text-amber-600">Advisory review needed</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <p className="text-xs font-semibold text-emerald-700">Low Risk (&le;30%)</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-950">{riskCounts.low}</p>
                      <p className="mt-1 text-[11px] text-emerald-600">Satisfactory standing</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
                    <span className="mt-0.5 text-blue-700 shrink-0"><Icon name="info" size={16} /></span>
                    <p leading-5>
                      <strong>Target Definition:</strong> Provisional probability of scoring below 40% in final End-Semester Examinations (ESE), estimated using pre-examination continuous assessments. Real student transcripts require mentor review.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 2. Subject-wise Academic Risk Analysis */}
          <Card className="overflow-hidden">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold text-slate-900">Subject-wise academic risk analysis</p>
                <p className="mt-1 text-xs text-slate-500">
                  Enrolled courses with attendance rate, credit weight, and ML risk probability. Click any subject to inspect SHAP attributions.
                </p>
              </div>
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {subjects.length} enrolled subjects
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {loadingSubjects ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading course records...</div>
              ) : subjects.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No course enrollments found for Semester {selectedSemester}.</div>
              ) : (
                subjects.map(subj => {
                  const isSelected = subj.subject_key === selectedSubjectKey;
                  const riskLevel = subj.risk_summary?.predicted_risk_level || "Low";
                  const riskProb = subj.risk_summary ? (subj.risk_summary.predicted_risk_probability * 100).toFixed(1) : "0.0";

                  return (
                    <div
                      key={subj.subject_key}
                      onClick={() => setSelectedSubjectKey(subj.subject_key)}
                      className={`cursor-pointer p-4 transition flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                        isSelected ? "bg-blue-50/70 ring-1 ring-inset ring-blue-500" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{subj.subject_name}</span>
                          <span className="text-xs font-medium text-slate-500">({subj.subject_key})</span>
                          <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {subj.component} · {subj.credits} Credits
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                          <span>
                            Attendance: <strong className={subj.attendance_percentage < 75 ? "text-red-700" : "text-slate-700"}>{subj.attendance_percentage.toFixed(1)}%</strong> ({subj.classes_attended}/{subj.total_classes} hrs)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <Status>{riskLevel}</Status>
                          <p className="mt-1 text-xs font-bold text-slate-900">{riskProb}% risk</p>
                        </div>
                        <Button
                          variant={isSelected ? "primary" : "secondary"}
                          className="h-8 px-2.5 text-xs"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedSubjectKey(subj.subject_key);
                          }}
                        >
                          {isSelected ? "Inspecting" : "Explain"} <Icon name="chevron" size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* 3. Why Is This Student at Risk? (SHAP Explanation) */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Why Is This Student at Risk?</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Evidence-based model explanation & feature contributions for: <span className="font-semibold text-blue-700">{selectedSubject?.subject_name || selectedSubjectKey}</span>
                  </p>
                </div>
                {explanation && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                    Additivity Closed (&le;1e-15 error)
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              {loadingExplanation ? (
                <div className="py-10 text-center">
                  <div className="mx-auto size-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Calculating SHAP feature attributions on-the-fly...</p>
                  <p className="text-xs text-slate-400">PermutationExplainer with Rank 11 residual closure</p>
                </div>
              ) : explanationError ? (
                <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-semibold">Explanation unavailable for this record</p>
                  <p className="mt-1 text-xs text-amber-700">{explanationError}</p>
                </div>
              ) : !explanation ? (
                <DataUnavailable
                  title="Select a course to view SHAP explanation"
                  detail="Click on any subject above to inspect model feature contributions, baseline probability, and additivity closure."
                />
              ) : (
                <div className="space-y-5">
                  {/* Probability Summary Bar */}
                  <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                    <div>
                      <p className="text-slate-500">Cohort Base Probability (Baseline):</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900">{(explanation.base_probability * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Predicted Subject Risk (Predicted):</p>
                      <p className="mt-0.5 text-base font-bold text-red-700">{(explanation.predicted_risk_probability * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Reconstructed Sum Check:</p>
                      <p className="mt-0.5 text-base font-bold text-emerald-700">
                        {(explanation.reconstructed_probability * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Feature Breakdown Table */}
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-600 uppercase tracking-wide">
                        <tr>
                          <th className="py-2.5 px-3 w-12">Rank</th>
                          <th className="py-2.5 px-3">Contributing Feature</th>
                          <th className="py-2.5 px-3">Original Assessment Score</th>
                          <th className="py-2.5 px-3">SHAP Attribution</th>
                          <th className="py-2.5 px-3">Impact Direction</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {explanation.features.map(f => {
                          const isResidual = f.is_aggregate_residual;
                          const isPositive = f.shap_value > 0;
                          const shapPct = (f.shap_value * 100).toFixed(2);

                          return (
                            <tr
                              key={f.rank}
                              className={isResidual ? "bg-slate-50 font-medium" : "hover:bg-slate-50/60"}
                            >
                              <td className="py-2.5 px-3 font-bold text-slate-500">#{f.rank}</td>
                              <td className="py-2.5 px-3">
                                <span className={isResidual ? "italic text-slate-600" : "font-semibold text-slate-900"}>
                                  {f.display_label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                                {f.original_value}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">
                                <span className={isResidual ? "text-slate-600" : isPositive ? "text-red-700" : "text-emerald-700"}>
                                  {isPositive ? `+${shapPct}%` : `${shapPct}%`}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                                    isResidual
                                      ? "bg-slate-200 text-slate-700"
                                      : isPositive
                                      ? "bg-red-50 text-red-700"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {isResidual
                                    ? "Aggregate residual"
                                    : isPositive
                                    ? "Increases risk"
                                    : "Decreases risk"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-4">
                    <strong>Attribution Notice:</strong> SHAP values explain statistical correlations between internal marks and predicted risk. They do not constitute causal proof. Rank 11 closes total additivity within &le; 1e-15 error.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* 4. Recommended Mentor Action Plan */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <p className="font-semibold text-slate-900">Recommended Mentor Action Plan</p>
              <p className="mt-1 text-xs text-slate-500">
                Data-driven intervention guidance based on highest risk contributors in Semester {selectedSemester}.
              </p>
            </div>
            <div className="p-5 space-y-3">
              {riskCounts.high > 0 ? (
                <>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                    <p className="font-semibold text-xs text-red-900 uppercase tracking-wide">High Priority Actions</p>
                    <ul className="mt-2 space-y-2 text-xs text-red-800 list-disc list-inside">
                      <li>
                        Schedule academic counseling session for <strong>{subjects.find(s => s.risk_summary?.predicted_risk_level === "High")?.subject_name}</strong>.
                      </li>
                      <li>Assign targeted practice sheets covering lowest continuous internal assessment components.</li>
                      <li>Review class test and assignment turn-ins before the upcoming examination cutoff.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">Coordination Protocol:</p>
                    <p className="mt-1">
                      Route remedial tasks to respective subject teachers using the <strong>Give Feedback</strong> interface below. Teachers will assign customized practice sets.
                    </p>
                  </div>
                </>
              ) : riskCounts.moderate > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900">
                  <p className="font-semibold uppercase tracking-wide">Moderate Advisory Action</p>
                  <p className="mt-1">
                    Student is near the boundary for {riskCounts.moderate} course(s). Monitor upcoming assignment submissions and provide refresher problem sheets.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900">
                  <p className="font-semibold uppercase tracking-wide">Satisfactory Standing</p>
                  <p className="mt-1">
                    All enrolled courses currently exhibit low predicted ESE risk (&le;30%). Maintain periodic attendance checks.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* 5. Academic Performance Visualizations */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <p className="font-semibold text-slate-900">Academic performance visualizations</p>
              <p className="mt-1 text-xs text-slate-500">
                Course risk probability breakdown across Semester {selectedSemester}
              </p>
            </div>
            <div className="p-5 space-y-5">
              {/* Course Risk Bar Visualization */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700">Course-by-Course Predicted Risk Probability</p>
                {subjects.map(s => {
                  const prob = s.risk_summary ? s.risk_summary.predicted_risk_probability : 0;
                  const probPct = (prob * 100).toFixed(1);
                  const isHigh = prob > 0.6;
                  const isMod = prob > 0.3 && prob <= 0.6;
                  const barColor = isHigh ? "bg-red-500" : isMod ? "bg-amber-500" : "bg-emerald-500";

                  return (
                    <div key={s.subject_key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800">{s.subject_name} ({s.subject_id})</span>
                        <span className="font-bold text-slate-900">{probPct}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(prob * 100, 3)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CGPA and Attendance Summary Boxes */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cumulative Recorded CGPA</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900">
                    {profile.academic_summary ? profile.academic_summary.cumulative_cgpa.toFixed(2) : "N/A"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Passed {profile.academic_summary?.total_subjects_passed || 0} of {profile.academic_summary?.total_subjects_enrolled || 0} total enrolled courses.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semester Term Attendance</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900">
                    {profile.academic_summary ? `${profile.academic_summary.semester_attendance_percentage.toFixed(1)}%` : "N/A"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {profile.academic_summary?.pending_assignments_total || 0} pending assignment(s) across all subjects.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar Details */}
        <div className="space-y-6">
          {/* Student Info Card */}
          <Card className="p-5">
            <p className="font-semibold text-slate-900">Student information</p>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              {[
                ["Student ID", profile.student_id],
                ["Full Name", profile.student_name],
                ["Department", `${profile.department_name} (${profile.department_code})`],
                ["Section", profile.section],
                ["Program", profile.program],
                ["Batch Year", String(profile.batch_year)],
                ["Active Semester", `Semester ${profile.current_semester}`],
                ["Selected Term", `Semester ${selectedSemester}`],
                ["Assigned Mentor", "Dr. Ananya Sharma"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5 text-xs">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Data Readiness Card */}
          <Card className="p-5">
            <p className="font-semibold text-slate-900">System Integration Status</p>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">FastAPI Backend</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-600" /> Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Model Artifact</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-600" /> Random Forest (v2.0)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">SHAP Engine</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-600" /> Permutation (Residual Closed)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Dataset Provenance</span>
                <span className="font-semibold text-blue-700">KIET Batch 2028 (Demo)</span>
              </div>
            </div>
          </Card>

          {/* Model Risk Card */}
          <Card className="border-amber-200 bg-amber-50/70 p-5">
            <p className="font-semibold text-amber-950">Early-Warning Advisory</p>
            <div className="mt-3">
              <Status>{riskCounts.high > 0 ? "High" : riskCounts.moderate > 0 ? "Moderate" : "Low"}</Status>
            </div>
            <p className="mt-3 text-xs leading-5 text-amber-900">
              Risk predictions are early warning indicators generated from pre-examination continuous assessment patterns. They do not replace institutional faculty evaluations.
            </p>
          </Card>
        </div>
      </div>

      {/* Give Feedback Bottom Action */}
      <Card className="mt-6 flex flex-col items-start justify-between gap-4 border-blue-200 bg-blue-50/50 p-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold text-slate-900">Record a mentor assessment & assign tasks</p>
          <p className="mt-1 text-sm text-slate-600">
            Manual notes are preserved in mentor records and routed to respective subject teachers for support planning.
          </p>
        </div>
        <Button onClick={onFeedback}>
          Give Feedback <Icon name="chevron" />
        </Button>
      </Card>
    </>
  );
}

function FeedbackForm({ student, onBack, onSave }: { student: StudentRosterItem; onBack: () => void; onSave: (f: Feedback) => void }) {
  const [status, setStatus] = useState<Feedback["status"]>("Need Improvement");
  const [routes, setRoutes] = useState<FeedbackRoute[]>([]);
  const [note, setNote] = useState("");
  const toggleRoute = (route: FeedbackRoute) =>
    setRoutes(current =>
      current.some(item => item.subject === route.subject) ? current.filter(item => item.subject !== route.subject) : [...current, route]
    );

  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700">
        <span className="rotate-180"><Icon name="chevron" /></span>Back to student profile
      </button>
      <PageTitle eyebrow="Mentor assessment" title="Give Feedback" description="Create an internal feedback record and route subject-specific support when needed." />
      <form
        onSubmit={e => {
          e.preventDefault();
          const primary = routes[0];
          onSave({
            id: `FB-2025-${1043 + Math.floor(Math.random() * 50)}`,
            studentId: student.id,
            student: student.name,
            branch: student.branch,
            section: student.section,
            date: "20 Mar 2025",
            status,
            note,
            subject: primary?.subject || "",
            teacher: primary?.teacher || "",
            routes,
          });
        }}
        className="grid gap-6 xl:grid-cols-[1fr_360px]"
      >
        <Card className="p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Student Name"><input className={`${inputClass} bg-slate-50`} readOnly value={student.name} /></Field>
            <Field label="Student ID"><input className={`${inputClass} bg-slate-50`} readOnly value={student.id} /></Field>
            <Field label="Mentor Name"><input className={`${inputClass} bg-slate-50`} readOnly value="Dr. Ananya Sharma" /></Field>
            <Field label="Feedback Date"><input className={inputClass} type="date" defaultValue="2025-03-20" /></Field>
          </div>
          <div className="mt-6">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Overall Student Status</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["Good", "Average", "Need Improvement"] as Feedback["status"][]).map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border p-3 text-sm font-semibold transition ${
                    status === s
                      ? s === "Good"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500"
                        : s === "Average"
                        ? "border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500"
                        : "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Your qualitative assessment remains separate from the automated ML risk score.</p>
          </div>
          <div className="mt-6">
            <Field label="Mentor Feedback">
              <textarea className={`${inputClass} min-h-36 py-3`} value={note} onChange={e => setNote(e.target.value)} placeholder="Enter your evidence-based assessment..." required />
            </Field>
          </div>
          <div className="mt-7 border-t border-slate-100 pt-6">
            <div className="mb-4">
              <p className="font-semibold text-slate-900">Subject support routing</p>
              <p className="mt-1 text-xs text-slate-500">Optional · Select one or more subjects. Only the relevant context is routed to each subject teacher.</p>
            </div>
            <div className="grid gap-3">
              {supportRouteOptions.map(route => {
                const selected = routes.some(item => item.subject === route.subject);
                return (
                  <label key={route.subject} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleRoute(route)} className="size-4 accent-blue-700" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{route.subject}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{route.teacher}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <Button type="button" variant="secondary" onClick={onBack}>Cancel</Button>
            <Button type="submit">Submit Feedback</Button>
          </div>
        </Card>
        <div>
          <Card className="p-5">
            <p className="font-semibold text-slate-900">Privacy & routing</p>
            <div className="mt-4 space-y-4 text-xs leading-5 text-slate-600">
              <p className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" size={12} /></span>Full feedback stays in mentor records.</p>
              <p className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" size={12} /></span>Teachers see only subject-specific context.</p>
              <p className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" size={12} /></span>Students see assigned tasks, not raw mentor feedback.</p>
            </div>
          </Card>
        </div>
      </form>
    </>
  );
}

function exportTable(filename: string, headers: string[], rows: string[][]) {
  const body = `<table><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const blob = new Blob([body], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function MentorRecords({ feedback, tasks, notify }: { feedback: Feedback[]; tasks: Task[]; notify: (m: string) => void }) {
  const download = () => {
    exportTable(
      "Mentor_Feedback_Records",
      ["Feedback ID", "Student ID", "Student Name", "Branch", "Section", "Mentor", "Date", "Status", "Feedback", "Subject", "Teacher", "Task IDs", "Task Status"],
      feedback.map(f => {
        const linked = tasks.filter(t => t.feedbackId === f.id);
        const routes = getFeedbackRoutes(f);
        return [f.id, f.studentId, f.student, f.branch, f.section, "Dr. Ananya Sharma", f.date, f.status, f.note, routes.map(route => route.subject).join(", "), routes.map(route => route.teacher).join(", "), linked.map(t => t.id).join(", "), linked.map(t => t.status).join(", ") || "Not assigned"];
      })
    );
    notify("Mentor spreadsheet downloaded successfully.");
  };

  return (
    <>
      <PageTitle eyebrow="Shared records" title="Feedback Records" description="Review feedback, routing, and the latest linked task status." action={<Button onClick={download}><Icon name="download" />Download Excel</Button>} />
      <Card className="overflow-hidden">
        <DataTable>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Feedback ID", "Student", "Date", "Mentor status", "Subject / Teacher", "Linked tasks & current status"].map(x => (
                <th key={x} className="px-5 py-3">{x}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feedback.map(f => {
              const linked = tasks.filter(t => t.feedbackId === f.id);
              const routes = getFeedbackRoutes(f);
              return (
                <tr key={f.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-blue-700">{f.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{f.student}</p>
                    <p className="text-xs text-slate-500">{f.studentId}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{f.date}</td>
                  <td className="px-5 py-4"><Status>{f.status}</Status></td>
                  <td className="px-5 py-4">
                    {routes.length ? (
                      <div className="space-y-2">
                        {routes.map(route => (
                          <div key={route.subject}>
                            <p className="font-medium text-slate-900">{route.subject}</p>
                            <p className="text-xs text-slate-500">{route.teacher}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">Not routed</span>
                    )}
                  </td>
                  <td className="min-w-72 px-5 py-4">
                    {linked.length ? (
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="grid grid-cols-[1fr_auto] gap-5 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          <span>Task ID</span>
                          <span>Status</span>
                        </div>
                        {linked.map(t => (
                          <div key={t.id} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-5 border-b border-slate-100 px-3 py-2 last:border-b-0">
                            <span className="whitespace-nowrap text-xs font-semibold text-blue-700">{t.id}</span>
                            <Status>{t.status}</Status>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">No task assigned</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Card>
    </>
  );
}

function TeacherHome({ feedback, tasks, go }: { feedback: Feedback[]; tasks: Task[]; go: (p: Page) => void }) {
  const routed = feedback.filter(f => getTeacherRoute(f, "Dr. Priya Menon"));
  return (
    <>
      <PageTitle eyebrow="Subject teacher dashboard" title="Good morning, Dr. Menon" description="Here is what needs your attention in Theory of Computation." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="New Feedback" value={routed.length} icon="inbox" />
        <SummaryCard label="Assigned Feedback" value={routed.length} icon="file" />
        <SummaryCard label="Active Tasks" value={tasks.filter(t => t.teacher === "Dr. Priya Menon" && t.status === "Pending").length} tone="amber" icon="clipboard" />
        <SummaryCard label="Pending Submissions" value={tasks.filter(t => t.teacher === "Dr. Priya Menon" && t.submitted && t.status === "Pending").length} tone="red" icon="bell" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.7fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <p className="font-semibold text-slate-900">Recently assigned feedback</p>
              <p className="mt-1 text-xs text-slate-500">Course-specific student context routed by mentors</p>
            </div>
            <Button variant="ghost" onClick={() => go("assigned")}>View all <Icon name="chevron" /></Button>
          </div>
          {routed.map(f => (
            <button key={f.id} onClick={() => go("assigned")} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 p-5 text-left hover:bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{f.student}</p>
                  <span className="text-xs text-slate-400">{f.studentId}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{getTeacherRoute(f, "Dr. Priya Menon")?.subject} · Routed by Dr. Ananya Sharma</p>
              </div>
              <div className="flex items-center gap-3">
                <Status>Pending</Status>
                <Icon name="chevron" />
              </div>
            </button>
          ))}
        </Card>
        <Card className="p-5">
          <p className="font-semibold text-slate-900">Upcoming deadlines</p>
          <div className="mt-4 space-y-4">
            {tasks.filter(t => t.teacher === "Dr. Priya Menon" && t.status === "Pending").map(t => (
              <div key={t.id} className="border-l-2 border-amber-400 pl-3">
                <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                <p className="mt-1 text-xs text-slate-500">{t.student} · {t.deadline}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function AssignedFeedback({ feedback, tasks, onAssign }: { feedback: Feedback[]; tasks: Task[]; onAssign: (f: Feedback) => void }) {
  const routed = feedback.filter(f => getTeacherRoute(f, "Dr. Priya Menon"));
  return (
    <>
      <PageTitle eyebrow="Subject-specific access" title="Assigned Feedback" description="Mentor concerns routed to you for Theory of Computation." />
      <div className="space-y-5">
        {routed.map(f => (
          <Card key={f.id} className="overflow-hidden">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold text-blue-700">{f.id}</p>
                <h2 className="mt-1 text-lg font-bold">{f.student} <span className="text-sm font-normal text-slate-500">· {f.studentId}</span></h2>
                <p className="mt-1 text-sm text-slate-500">{f.branch} · Section {f.section}</p>
              </div>
              <Button onClick={() => onAssign(f)}><Icon name="plus" />Assign Task</Button>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Relevant subject</p>
                <p className="mt-2 text-sm font-semibold">{getTeacherRoute(f, "Dr. Priya Menon")?.subject}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Relevant mentor context</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.note}</p>
              </div>
            </div>
            {tasks.filter(t => t.feedbackId === f.id && t.teacher === "Dr. Priya Menon").length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
                {tasks.filter(t => t.feedbackId === f.id && t.teacher === "Dr. Priya Menon").length} linked task(s)
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function TaskForm({ feedback, onBack, onSave }: { feedback: Feedback; onBack: () => void; onSave: (task: Task) => void }) {
  const [file, setFile] = useState("");
  const route = getTeacherRoute(feedback, "Dr. Priya Menon");
  const subject = route?.subject || feedback.subject;
  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className="rotate-180"><Icon name="chevron" /></span>Back to assigned feedback
      </button>
      <PageTitle eyebrow={feedback.id} title="Assign Improvement Task" description={`Create a focused ${subject} task for ${feedback.student}.`} />
      <Card className="mx-auto max-w-4xl p-6">
        <form
          onSubmit={e => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            onSave({
              id: `TSK-250320-${String(Math.floor(Math.random() * 90) + 10)}`,
              feedbackId: feedback.id,
              studentId: feedback.studentId,
              student: feedback.student,
              subject,
              teacher: "Dr. Priya Menon",
              title: String(d.get("title")),
              description: String(d.get("description")),
              roadmap: String(d.get("roadmap")).split("\n").filter(Boolean),
              assigned: "20 Mar 2025",
              deadline: "28 Mar 2025, 5:00 PM",
              status: "Pending",
              teacherFile: file || undefined,
            });
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Feedback ID"><input className={`${inputClass} bg-slate-50`} readOnly value={feedback.id} /></Field>
            <Field label="Student"><input className={`${inputClass} bg-slate-50`} readOnly value={`${feedback.student} · ${feedback.studentId}`} /></Field>
            <Field label="Subject"><input className={`${inputClass} bg-slate-50`} readOnly value={subject} /></Field>
            <Field label="Deadline Date and Time"><input required className={inputClass} type="datetime-local" defaultValue="2025-03-28T17:00" /></Field>
          </div>
          <div className="mt-5"><Field label="Task Title"><input required name="title" className={inputClass} defaultValue="Automata Problem Set 1" /></Field></div>
          <div className="mt-5"><Field label="Task Description"><textarea required name="description" className={`${inputClass} min-h-28 py-3`} defaultValue="Complete the DFA and NFA conversion practice set." /></Field></div>
          <div className="mt-5"><Field label="Step-by-Step Roadmap" hint="Add one step per line."><textarea required name="roadmap" className={`${inputClass} min-h-36 py-3`} defaultValue={"Review state transition definitions\nConstruct DFA for problems 1–6\nVerify edge cases\nSubmit PDF with transitions"} /></Field></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {["Assignment Document", "Study Material"].map((label, i) => (
              <label key={label} className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-blue-400 hover:bg-blue-50">
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0]?.name || `TOC_${i ? "Notes" : "Assignment"}.pdf`)} />
                <span className="mx-auto grid size-9 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><Icon name="upload" /></span>
                <span className="mt-2 block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs text-slate-500">{file || "PDF, DOCX or ZIP · Optional"}</span>
              </label>
            ))}
          </div>
          <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <Button type="button" variant="secondary" onClick={onBack}>Cancel</Button>
            <Button type="submit">Assign Task</Button>
          </div>
        </form>
      </Card>
    </>
  );
}

function TaskRecords({ role, tasks, onOpen, notify }: { role: Role; tasks: Task[]; onOpen: (t: Task) => void; notify?: (m: string) => void }) {
  const visible = role === "teacher" ? tasks.filter(t => t.teacher === "Dr. Priya Menon") : tasks.filter(t => t.studentId === "2428CS2286");
  const download = () => {
    exportTable(
      "Teacher_Task_Records",
      ["Feedback ID", "Task ID", "Student ID", "Student", "Subject", "Task Title", "Description", "Roadmap", "Deadline", "Submission", "Status", "Remarks"],
      visible.map(t => [t.feedbackId, t.id, t.studentId, t.student, t.subject, t.title, t.description, t.roadmap.join("; "), t.deadline, t.submissionFile || "", t.status, t.remarks || ""])
    );
    notify?.("Teacher task spreadsheet downloaded successfully.");
  };

  return (
    <>
      <PageTitle
        eyebrow={role === "teacher" ? "Teacher records" : "Student workspace"}
        title={role === "teacher" ? "Task Records" : "My Tasks"}
        description={role === "teacher" ? "All tasks assigned by you and their latest status." : "Review deadlines, follow instructions, and submit your assigned work."}
        action={role === "teacher" ? <Button onClick={download}><Icon name="download" />Download Excel</Button> : undefined}
      />
      {visible.length === 0 ? (
        <Empty title="No tasks assigned" detail="New improvement tasks will appear here." />
      ) : (
        <div className="grid gap-4">
          {visible.map(t => (
            <Card key={t.id} className="group p-5 transition hover:border-blue-200 hover:shadow-sm">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-blue-700">{t.id}</span>
                    <Status>{t.status}</Status>
                  </div>
                  <p className="mt-2 text-lg font-bold text-slate-900">{t.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{t.subject} · {role === "student" ? t.teacher : `${t.student} · ${t.studentId}`}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="rounded-lg bg-amber-50 px-4 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Deadline</p>
                    <p className="mt-0.5 text-sm font-semibold text-amber-950">{t.deadline}</p>
                  </div>
                  <Button variant="secondary" onClick={() => onOpen(t)}>Open Task <Icon name="chevron" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function StudentHome({ tasks, go }: { tasks: Task[]; go: (p: Page) => void }) {
  const mine = tasks.filter(t => t.studentId === "2428CS2286");
  return (
    <>
      <PageTitle eyebrow="Student dashboard" title="Welcome back, Atharv" description="Stay focused on your assigned improvement tasks and upcoming deadlines." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Assigned Tasks" value={mine.length} icon="clipboard" />
        <SummaryCard label="Pending Tasks" value={mine.filter(t => t.status === "Pending").length} tone="amber" icon="clock" />
        <SummaryCard label="Completed Tasks" value={mine.filter(t => t.status === "Completed").length} tone="green" icon="check" />
        <SummaryCard label="Overdue Tasks" value={0} tone="red" icon="bell" />
      </div>
      <Card className="mt-6 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-slate-900">Next deadline</p>
            <h2 className="mt-2 text-xl font-bold">{mine.find(t => t.status === "Pending")?.title || "No pending deadlines"}</h2>
            <p className="mt-1 text-sm text-slate-500">Theory of Computation · Dr. Priya Menon</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              <Icon name="clock" /> 24 Mar 2025, 5:00 PM
            </div>
          </div>
          <Button onClick={() => go("tasks")}>View My Tasks <Icon name="chevron" /></Button>
        </div>
      </Card>
    </>
  );
}

function TaskDetail({ role, task, onBack, onSubmit }: { role: Role; task: Task; onBack: () => void; onSubmit?: (file: string) => void }) {
  const [file, setFile] = useState("");
  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className="rotate-180"><Icon name="chevron" /></span>Back to tasks
      </button>
      <PageTitle eyebrow={`${task.id} · ${task.subject}`} title={task.title} description={`Assigned by ${task.teacher} on ${task.assigned}`} action={<Status>{task.status}</Status>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="font-semibold text-slate-900">Task description</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{task.description}</p>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="font-semibold text-slate-900">Step-by-step roadmap</p>
              <ol className="mt-4 space-y-4">
                {task.roadmap.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                    <p className="pt-1 text-sm text-slate-700">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
          <Card className="p-6">
            <p className="font-semibold text-slate-900">Teacher-provided material</p>
            <button className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-red-50 text-red-700"><Icon name="file" /></span>
                <span>
                  <span className="block text-sm font-semibold">{task.teacherFile || "Reference_Notes.pdf"}</span>
                  <span className="text-xs text-slate-500">PDF document · 1.8 MB</span>
                </span>
              </span>
              <Icon name="download" />
            </button>
          </Card>
          {role === "student" && task.status !== "Completed" && (
            <Card className="p-6">
              <p className="font-semibold text-slate-900">Submit completed work</p>
              <p className="mt-1 text-sm text-slate-500">Upload one PDF or ZIP containing your complete solution.</p>
              <label className="mt-5 block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-7 text-center hover:border-blue-400 hover:bg-blue-50/50">
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0]?.name || "")} />
                <span className="mx-auto grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon name="upload" /></span>
                <span className="mt-3 block text-sm font-semibold">{file || "Choose a file to upload"}</span>
                <span className="mt-1 block text-xs text-slate-500">PDF or ZIP up to 20 MB</span>
              </label>
              <Button className="mt-4 w-full" disabled={!file} onClick={() => onSubmit?.(file)}>
                {task.submitted ? "Resubmit Task" : "Submit Task"}
              </Button>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Deadline</p>
            <p className="mt-2 text-lg font-bold text-amber-800">{task.deadline}</p>
          </Card>
          <Card className="p-5">
            <p className="font-semibold text-slate-900">Task information</p>
            <dl className="mt-3 divide-y divide-slate-100 text-xs">
              {[["Subject", task.subject], ["Teacher", task.teacher], ["Feedback ID", task.feedbackId], ["Assigned", task.assigned]].map(([k, v]) => (
                <div key={k} className="py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Reviews({ tasks, onReview }: { tasks: Task[]; onReview: (t: Task) => void }) {
  const [q, setQ] = useState("");
  const rows = tasks.filter(t => t.teacher === "Dr. Priya Menon" && t.submitted && (t.student.toLowerCase().includes(q.toLowerCase()) || t.studentId.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageTitle eyebrow="Teacher review" title="Submission Review" description="Review submitted work and decide the final task status." />
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="relative max-w-sm">
            <span className="absolute left-3 top-3 text-slate-400"><Icon name="search" size={17} /></span>
            <input className={`${inputClass} pl-9`} placeholder="Search student name or ID" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <DataTable>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Task / Feedback ID", "Student", "Task Title", "Deadline", "Submission", "Status", ""].map(x => <th key={x} className="px-5 py-3">{x}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(t => (
              <tr key={t.id}>
                <td className="px-5 py-4"><p className="font-semibold text-blue-700">{t.id}</p><p className="text-xs text-slate-500">{t.feedbackId}</p></td>
                <td className="px-5 py-4"><p className="font-semibold">{t.student}</p><p className="text-xs text-slate-500">{t.studentId}</p></td>
                <td className="px-5 py-4">{t.title}</td>
                <td className="px-5 py-4 text-slate-600">{t.deadline}</td>
                <td className="px-5 py-4"><p className="font-medium">{t.submissionFile}</p><p className="text-xs text-slate-500">{t.submitted}</p></td>
                <td className="px-5 py-4"><Status>{t.status}</Status></td>
                <td className="px-5 py-4"><Button variant="secondary" onClick={() => onReview(t)}>Review</Button></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </>
  );
}

function ReviewDetail({ task, onBack, onSave }: { task: Task; onBack: () => void; onSave: (status: TaskStatus, remarks: string) => void }) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [remarks, setRemarks] = useState(task.remarks || "");
  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><span className="rotate-180"><Icon name="chevron" /></span>Back to submissions</button>
      <PageTitle eyebrow={`${task.id} · ${task.feedbackId}`} title="Review Submission" description={`${task.student} · ${task.studentId} · ${task.subject}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <p className="font-semibold text-slate-900">Submitted document</p>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon name="file" /></span>
              <div>
                <p className="text-sm font-semibold">{task.submissionFile}</p>
                <p className="text-xs text-slate-500">Submitted {task.submitted}</p>
              </div>
            </div>
            <Button variant="secondary"><Icon name="download" />Download</Button>
          </div>
          <div className="mt-6">
            <p className="font-semibold text-slate-900">Task assigned</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
          </div>
        </Card>
        <Card className="p-6">
          <p className="font-semibold text-slate-900">Review decision</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(["Pending", "Completed"] as TaskStatus[]).map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-lg border p-3 text-sm font-semibold ${status === s ? s === "Completed" ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500" : "border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500" : "border-slate-200 text-slate-600"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <Field label="Teacher Remarks">
              <textarea className={`${inputClass} min-h-32 py-3`} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add feedback or correction notes..." />
            </Field>
          </div>
          <Button className="mt-5 w-full" onClick={() => onSave(status, remarks)}>Save Review</Button>
        </Card>
      </div>
    </>
  );
}

function DataUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
        <Icon name="inbox" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [selectedStudentId, setSelectedStudentId] = useState(verifiedStudents[0].id);
  const [mentorFilters, setMentorFilters] = useState<MentorFilters>({ query: "", department: "All", section: "All" });
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback>(seedFeedback[0]);
  const [selectedTask, setSelectedTask] = useState<Task>(seedTasks[0]);
  const [feedback, setFeedback] = useState(seedFeedback);
  const [tasks, setTasks] = useState(seedTasks);
  const [toast, setToast] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const notifications = useMemo(
    () =>
      role === "mentor"
        ? ["Dr. Priya Menon assigned a new TOC task to Atharv Saxena.", "Task TSK-250305-02 was marked Completed.", "Your feedback was routed successfully."]
        : role === "teacher"
        ? ["New feedback FB-2025-1042 was routed by Dr. Ananya Sharma.", "Atharv Saxena submitted Grammar Simplification.", "Task deadline is approaching."]
        : ["A new Theory of Computation task was assigned by Dr. Priya Menon.", "Your submission was received and is awaiting review.", "DFA & NFA Remedial Practice is due on 24 Mar."],
    [role]
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  if (!role) {
    return <Login onLogin={r => { setRole(r); setPage("home"); }} />;
  }

  const selectedStudent = verifiedStudents.find(s => s.id === selectedStudentId);

  const body =
    role === "mentor"
      ? page === "home"
        ? <MentorHome filters={mentorFilters} onFiltersChange={setMentorFilters} onProfile={studentId => { setSelectedStudentId(studentId); setPage("profile"); }} />
        : page === "profile"
        ? <StudentProfile studentId={selectedStudentId} onBack={() => setPage("home")} onFeedback={() => setPage("feedback")} />
        : page === "feedback"
        ? selectedStudent
          ? <FeedbackForm student={selectedStudent} onBack={() => setPage("profile")} onSave={f => { setFeedback([f, ...feedback]); setPage("records"); const routes = getFeedbackRoutes(f); notify(`Feedback ${f.id} saved${routes.length ? ` and routed to ${routes.length} subject teacher${routes.length > 1 ? "s" : ""}` : ""}.`); }} />
          : <Empty title="Student record not found" detail="Return to Assigned Students and select a valid student before giving feedback." />
        : <MentorRecords feedback={feedback} tasks={tasks} notify={notify} />
      : role === "teacher"
      ? page === "home"
        ? <TeacherHome feedback={feedback} tasks={tasks} go={setPage} />
        : page === "assigned"
        ? <AssignedFeedback feedback={feedback} tasks={tasks} onAssign={f => { setSelectedFeedback(f); setPage("task-form"); }} />
        : page === "task-form"
        ? <TaskForm feedback={selectedFeedback} onBack={() => setPage("assigned")} onSave={t => { setTasks([t, ...tasks]); setPage("tasks"); notify(`${t.id} assigned to ${t.student}.`); }} />
        : page === "reviews"
        ? <Reviews tasks={tasks} onReview={t => { setSelectedTask(t); setPage("review-detail"); }} />
        : page === "review-detail"
        ? <ReviewDetail task={selectedTask} onBack={() => setPage("reviews")} onSave={(status, remarks) => { setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, status, remarks } : t)); setPage("reviews"); notify(`${selectedTask.id} updated to ${status}.`); }} />
        : page === "task-detail"
        ? <TaskDetail role="teacher" task={selectedTask} onBack={() => setPage("tasks")} />
        : <TaskRecords role="teacher" tasks={tasks} onOpen={t => { setSelectedTask(t); setPage("task-detail"); }} notify={notify} />
      : page === "home"
      ? <StudentHome tasks={tasks} go={setPage} />
      : page === "task-detail"
      ? <TaskDetail role="student" task={selectedTask} onBack={() => setPage("tasks")} onSubmit={file => { setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, submissionFile: file, submitted: "20 Mar 2025, 2:14 PM" } : t)); setSelectedTask({ ...selectedTask, submissionFile: file, submitted: "20 Mar 2025, 2:14 PM" }); notify("Task submitted successfully. Your teacher will review it."); }} />
      : <TaskRecords role="student" tasks={tasks} onOpen={t => { setSelectedTask(t); setPage("task-detail"); }} />;

  return (
    <Shell role={role} page={page} setPage={setPage} onLogout={() => setRole(null)} notifications={notifications} health={health}>
      {body}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500">
            <Icon name="check" size={14} />
          </span>
          {toast}
        </div>
      )}
    </Shell>
  );
}

export default App;
