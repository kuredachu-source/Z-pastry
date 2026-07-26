import { useState } from "react";
import { Moon, Sun, ClipboardList, BarChart3, UtensilsCrossed, MessageSquare, QrCode, Settings, FileSpreadsheet, ShieldCheck, UserRound, Lock, Image as ImageIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import OrderQueue from "@/pages/staff/order-queue";
import AnalyticsHub from "@/pages/staff/analytics-hub";
import MenuEdit from "@/pages/staff/menu-edit";
import SentimentLogs from "@/pages/staff/sentiment-logs";
import QRGenerator from "@/pages/staff/qr-generator";
import SettingsPage from "@/pages/staff/settings";
import Reports from "@/pages/staff/reports";
import BillPhotos from "@/pages/staff/bill-photos";
import { useStaffAuth } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "orders" | "analytics" | "menu" | "sentiment" | "qr" | "reports" | "bills" | "settings";
type Role = "worker" | "admin";

const ALL_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "orders", label: "Order Queue", icon: <ClipboardList size={18} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
  { id: "menu", label: "Menu Edit", icon: <UtensilsCrossed size={18} /> },
  { id: "sentiment", label: "Sentiment", icon: <MessageSquare size={18} /> },
  { id: "reports", label: "Reports", icon: <FileSpreadsheet size={18} /> },
  { id: "bills", label: "Bill Photos", icon: <ImageIcon size={18} /> },
  { id: "qr", label: "QR Generator", icon: <QrCode size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

const ROLE_KEY = "ZPASTRY_cafe_staff_role_v1";

function RoleGate({ onEnter }: { onEnter: (role: Role) => void }) {
  const { data: staffAuth } = useStaffAuth();
  const [showPasswordFor, setShowPasswordFor] = useState<Role | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submitPassword() {
    const role = showPasswordFor;
    if (!role) return;
    const correct = role === "admin"
      ? staffAuth?.adminPassword || "admin123"
      : staffAuth?.workerPassword || "worker123";
    if (password === correct) {
      sessionStorage.setItem(ROLE_KEY, role);
      onEnter(role);
    } else {
      setError("Incorrect password");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-sm bg-card border border-card-border rounded-2xl p-6 space-y-5">
        <div className="text-center">
          <h1 className="font-serif text-xl font-bold">Z Pastry Cafe</h1>
          <p className="text-xs text-muted-foreground mt-1">Who's logging in to the Staff Terminal?</p>
        </div>

        {showPasswordFor === null ? (
          <div className="space-y-2.5">
            <button
              onClick={() => { setShowPasswordFor("worker"); setError(""); setPassword(""); }}
              data-testid="button-role-worker"
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-secondary hover:bg-border/60 transition-all text-left"
            >
              <UserRound size={20} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Worker</p>
                <p className="text-[11px] text-muted-foreground">Order Queue only · password required</p>
              </div>
            </button>
            <button
              onClick={() => { setShowPasswordFor("admin"); setError(""); setPassword(""); }}
              data-testid="button-role-admin"
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-secondary hover:bg-border/60 transition-all text-left"
            >
              <ShieldCheck size={20} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Admin</p>
                <p className="text-[11px] text-muted-foreground">Full access · password required</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Lock size={12} /> {showPasswordFor === "admin" ? "Admin" : "Worker"} Password
              </label>
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitPassword(); }}
                data-testid="input-role-password"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPasswordFor(null)}>Back</Button>
              <Button className="flex-1" onClick={submitPassword} data-testid="button-submit-role-password">Enter</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [role, setRole] = useState<Role | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem(ROLE_KEY);
    return stored === "worker" || stored === "admin" ? stored : null;
  });
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const { theme, setTheme } = useTheme();

  if (!role) {
    return <RoleGate onEnter={setRole} />;
  }

  const TABS = role === "admin" ? ALL_TABS : ALL_TABS.filter((t) => t.id === "orders");

  function switchRole() {
    sessionStorage.removeItem(ROLE_KEY);
    setRole(null);
    setActiveTab("orders");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex-col hidden md:flex">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <h1 className="font-serif text-lg font-bold text-sidebar-foreground">Z Pastry Cafe</h1>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-sidebar-foreground/50 mt-0.5 uppercase">
            Staff Terminal · {role === "admin" ? "Admin" : "Worker"}
          </p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`button-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
          <button
            data-testid="button-theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            data-testid="button-switch-role"
            onClick={switchRole}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            <UserRound size={16} />
            Switch User
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-serif font-bold text-sidebar-foreground">Z Pastry Cafe — Staff</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={switchRole}
              className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70"
              title="Switch user"
            >
              <UserRound size={18} />
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto px-3 pb-3 gap-1.5 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-sidebar-accent text-sidebar-accent-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-5 pt-32 md:pt-8 pb-10">
          <div className="mb-5">
            <h2 className="font-serif text-2xl font-bold">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Z Pastry Cafe · Dire Dawa, Ethiopia</p>
          </div>

          {activeTab === "orders" && <OrderQueue />}
          {role === "admin" && activeTab === "analytics" && <AnalyticsHub />}
          {role === "admin" && activeTab === "menu" && <MenuEdit />}
          {role === "admin" && activeTab === "sentiment" && <SentimentLogs />}
          {role === "admin" && activeTab === "reports" && <Reports />}
          {role === "admin" && activeTab === "bills" && <BillPhotos />}
          {role === "admin" && activeTab === "qr" && <QRGenerator />}
          {role === "admin" && activeTab === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
