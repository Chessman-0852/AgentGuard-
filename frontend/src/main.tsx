// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { AppShell } from "./layouts/AppShell";
import { OverviewPage } from "./pages/OverviewPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { AttackSimulatorPage } from "./pages/AttackSimulatorPage";
import { AuditChainPage } from "./pages/AuditChainPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { AgentsPage } from "./pages/AgentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Security Control Plane & Dashboard */}
        <Route path="/dashboard" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="attack" element={<AttackSimulatorPage />} />
          <Route path="audit" element={<AuditChainPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
