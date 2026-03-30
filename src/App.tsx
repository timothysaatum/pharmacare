import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { syncEngine } from "@/lib/syncEngine";
import { AppShell } from "@/components/layout/AppShell";
import OnboardingPage from "@/pages/OnboardingPage";
import LoginPage from "@/pages/LoginPage";
import DrugListPage from "@/pages/DrugListPage";
import InventoryPage from "@/pages/InventoryPage";
import POSPage from "@/pages/POSPage";
import ContractsPage from "@/pages/ContractsPage";
import CustomersPage from "@/pages/CustomersPage";
import PurchasesPage from "@/pages/PurchasesPage";
import SalesHistoryPage from "@/pages/SalesHistoryPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-ink-muted">
      <p className="text-sm">{label} coming soon</p>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeBranchId } = useAuthStore();
  if (!isAuthenticated || !activeBranchId) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Guard /onboarding so already-authenticated users are redirected away.
// Without this, an admin who accidentally navigates to /onboarding while
// logged in sees the full creation form, which is confusing and dangerous.
function RequireUnauthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeBranchId } = useAuthStore();
  if (isAuthenticated && activeBranchId) {
    return <Navigate to="/drugs" replace />;
  }
  return <>{children}</>;
}


function SyncGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeBranchId } = useAuthStore();
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  // Ref prevents the gate from re-opening once it has been passed
  const hasPassedGate = useRef(false);

  useEffect(() => {
    // Not authenticated yet — nothing to gate
    if (!isAuthenticated || !activeBranchId) {
      return;
    }

    // Already passed the gate in a previous render (e.g. branch switch)
    if (hasPassedGate.current) {
      setInitialSyncDone(true);
      return;
    }

    const currentStatus = syncEngine.status;
    if (
      currentStatus === "idle" ||
      currentStatus === "offline" ||
      currentStatus === "error"
    ) {
      hasPassedGate.current = true;
      setInitialSyncDone(true);
      return;
    }

    // Engine is "syncing" — wait for it to reach a terminal state
    const unsub = syncEngine.subscribe((status) => {
      if (
        status === "idle" ||
        status === "offline" ||
        status === "error"
      ) {
        hasPassedGate.current = true;
        setInitialSyncDone(true);
      }
    });

    // Safety net: if the engine never notifies us within 5 s, unblock anyway.
    // This guards against edge cases like an engine that fires its callback
    // before subscribe() returns.
    const safety = setTimeout(() => {
      hasPassedGate.current = true;
      setInitialSyncDone(true);
    }, 5_000);

    return () => {
      unsub();
      clearTimeout(safety);
    };
  }, [isAuthenticated, activeBranchId]);

  // Show loading spinner only while authenticated + waiting for first sync
  if (isAuthenticated && activeBranchId && !initialSyncDone) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-ink">Syncing your data…</p>
            <p className="text-xs text-ink-muted mt-1">
              Fetching latest drugs, inventory and contracts
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, activeBranchId, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
    // Broadcast auth:logout → hard redirect so all state is cleared cleanly
    const handler = () => { window.location.href = "/login"; };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-muted">Loading…</p>
        </div>
      </div>
    );
  }

  const isFullyAuthenticated = isAuthenticated && !!activeBranchId;

  return (
    <SyncGate>
      <Routes>
        {/* ── Public ── */}

        {/* Wrap /onboarding in RequireUnauthenticated so logged-in
            users are redirected to /drugs instead of seeing the setup form. */}
        <Route
          path="/onboarding"
          element={<RequireUnauthenticated><OnboardingPage /></RequireUnauthenticated>}
        />
        <Route
          path="/login"
          element={isFullyAuthenticated ? <Navigate to="/drugs" replace /> : <LoginPage />}
        />

        {/* ── Protected ── */}
        <Route
          path="/drugs"
          element={<RequireAuth><AppShell><DrugListPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/inventory"
          element={<RequireAuth><AppShell><InventoryPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/pos"
          element={<RequireAuth><AppShell><POSPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/customers"
          element={<RequireAuth><AppShell><CustomersPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/contracts"
          element={<RequireAuth><AppShell><ContractsPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/purchases"
          element={<RequireAuth><AppShell><PurchasesPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/sales"
          element={<RequireAuth><AppShell><SalesHistoryPage /></AppShell></RequireAuth>}
        />
        <Route
          path="/reports"
          element={<RequireAuth><AppShell><ComingSoon label="Reports" /></AppShell></RequireAuth>}
        />

        <Route
          path="/dashboard"
          element={<Navigate to="/drugs" replace />}
        />

        {/* ── Redirects ── */}
        <Route
          path="/"
          element={<Navigate to={isFullyAuthenticated ? "/drugs" : "/login"} replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SyncGate>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  );
}