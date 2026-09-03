// frontend/src/layouts/AppShell.tsx
import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { fetchHealth } from "../lib/api";
import { VerifyChainButton } from "../components/VerifyChainButton";
import {
  Shield,
  LayoutDashboard,
  ReceiptText,
  Bot,
  SlidersHorizontal,
  Link2,
  Swords,
  Settings,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";

export const AppShell: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const ok = await fetchHealth();
      if (mounted) setIsLive(ok);
    };
    check();
    const interval = setInterval(check, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { to: "/dashboard", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" />, end: true },
    { to: "/dashboard/transactions", label: "Transactions", icon: <ReceiptText className="w-4 h-4" /> },
    { to: "/dashboard/attack", label: "Attack Simulator", icon: <Swords className="w-4 h-4" /> },
    { to: "/dashboard/audit", label: "Audit Chain", icon: <Link2 className="w-4 h-4" /> },
    { to: "/dashboard/policies", label: "Policies", icon: <SlidersHorizontal className="w-4 h-4" /> },
    { to: "/dashboard/agents", label: "Agent Controls", icon: <Bot className="w-4 h-4" /> },
    { to: "/dashboard/settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col md:flex-row font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col justify-between w-60 bg-surface border-r border-border shrink-0 p-4 min-h-screen">
        <div>
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 px-2 py-3 mb-6 group">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-text-primary block">
                AgentGuard
              </span>
              <span className="text-[10px] text-text-secondary tracking-wider uppercase font-mono">
                Commerce Firewall
              </span>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-accent/15 text-accent border border-accent/30 font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-border/80">
          <NavLink
            to="/"
            className="flex items-center justify-between text-xs text-text-secondary hover:text-text-primary px-2 py-1.5 rounded transition-colors"
          >
            <span>Public Landing Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </NavLink>
          <div className="text-[10px] font-mono text-text-secondary px-2 mt-2">
            AgentGuard Core v1.0.0
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border">
        <NavLink to="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          <span className="font-bold text-sm">AgentGuard</span>
        </NavLink>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-success animate-pulse" : "bg-danger"}`} />
            <span className="text-text-secondary">{isLive ? "LIVE" : "OFFLINE"}</span>
          </div>
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-1.5 text-text-secondary hover:text-text-primary"
            aria-label="Toggle Navigation"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden bg-surface-2 border-b border-border p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                  isActive
                    ? "bg-accent/20 text-accent font-bold"
                    : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {/* Main Content Area with Topbar */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-border bg-surface/50 backdrop-blur-xs sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-text-primary capitalize">
              {navItems.find((item) =>
                item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to)
              )?.label || "Control Plane"}
            </h1>
            <span className="text-text-secondary text-xs">•</span>
            <span className="text-xs text-text-secondary">AI Payment Gateway Monitoring</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${isLive ? "bg-success animate-pulse" : "bg-danger"}`}
              />
              <span className="text-text-primary font-semibold">{isLive ? "SYSTEM LIVE" : "DISCONNECTED"}</span>
            </div>
            <VerifyChainButton />
          </div>
        </header>

        {/* Dynamic Nested Page Content */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
