// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { useEffect, useRef, useState } from "react";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { Toaster } from "sonner";
// import { useAuthStore } from "@/stores/authStore";
// import { syncEngine } from "@/lib/syncEngine";
// import { AppShell } from "@/components/layout/AppShell";
// import OnboardingPage from "@/pages/OnboardingPage";
// import LoginPage from "@/pages/LoginPage";
// import DrugListPage from "@/pages/DrugListPage";
// import InventoryPage from "@/pages/InventoryPage";
// import POSPage from "@/pages/POSPage";

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: { staleTime: 1000 * 60 * 5, retry: 1 },
//   },
// });

// function ComingSoon({ label }: { label: string }) {
//   return (
//     <div className="flex-1 flex items-center justify-center text-ink-muted">
//       <p className="text-sm">{label} coming soon</p>
//     </div>
//   );
// }

// function RequireAuth({ children }: { children: React.ReactNode }) {
//   const { isAuthenticated, activeBranchId } = useAuthStore();
//   if (!isAuthenticated || !activeBranchId) {
//     return <Navigate to="/login" replace />;
//   }
//   return <>{children}</>;
// }

// // FIX: Guard /onboarding so already-authenticated users are redirected away.
// // Without this, an admin who accidentally navigates to /onboarding while
// // logged in sees the full creation form, which is confusing and dangerous.
// function RequireUnauthenticated({ children }: { children: React.ReactNode }) {
//   const { isAuthenticated, activeBranchId } = useAuthStore();
//   if (isAuthenticated && activeBranchId) {
//     return <Navigate to="/drugs" replace />;
//   }
//   return <>{children}</>;
// }

// /**
//  * SyncGate — waits for the very first pull after a fresh login to complete
//  * before rendering the app, so the local DB is populated before any page
//  * tries to read it.
//  *
//  * FIX (original issues):
//  * 1. The gate was re-triggering on every branch switch, showing "Syncing…"
//  *    every time the user changed branches — not just on first login.
//  * 2. The 300ms fallback timer was the only thing preventing a permanent
//  *    loading screen on restarts where the engine was already "idle".
//  *
//  * Fix strategy:
//  * - Track whether we've already passed the gate once per mount via a ref.
//  *   Once `initialSyncDone` is true it is never reset back to false within
//  *   this component's lifetime — branch switches don't re-trigger it.
//  * - On mount, if the engine is already idle/offline/error (i.e. the user
//  *   is restoring a session and the engine ran before this component mounted)
//  *   we immediately mark the gate as done instead of waiting for a status
//  *   change that already happened.
//  */
// function SyncGate({ children }: { children: React.ReactNode }) {
//   const { isAuthenticated, activeBranchId } = useAuthStore();
//   const [initialSyncDone, setInitialSyncDone] = useState(false);
//   // Ref prevents the gate from re-opening once it has been passed
//   const hasPassedGate = useRef(false);

//   useEffect(() => {
//     // Not authenticated yet — nothing to gate
//     if (!isAuthenticated || !activeBranchId) {
//       return;
//     }

//     // Already passed the gate in a previous render (e.g. branch switch)
//     if (hasPassedGate.current) {
//       setInitialSyncDone(true);
//       return;
//     }

//     // FIX: if the engine is already in a terminal state when this effect
//     // runs (common on session restore where sync started before the gate
//     // mounted), mark done immediately rather than waiting for a future event
//     // that has already fired.
//     const currentStatus = syncEngine.status;
//     if (
//       currentStatus === "idle" ||
//       currentStatus === "offline" ||
//       currentStatus === "error"
//     ) {
//       hasPassedGate.current = true;
//       setInitialSyncDone(true);
//       return;
//     }

//     // Engine is "syncing" — wait for it to reach a terminal state
//     const unsub = syncEngine.subscribe((status) => {
//       if (
//         status === "idle" ||
//         status === "offline" ||
//         status === "error"
//       ) {
//         hasPassedGate.current = true;
//         setInitialSyncDone(true);
//       }
//     });

//     // Safety net: if the engine never notifies us within 5 s, unblock anyway.
//     // This guards against edge cases like an engine that fires its callback
//     // before subscribe() returns.
//     const safety = setTimeout(() => {
//       hasPassedGate.current = true;
//       setInitialSyncDone(true);
//     }, 5_000);

//     return () => {
//       unsub();
//       clearTimeout(safety);
//     };
//   }, [isAuthenticated, activeBranchId]);

//   // Show loading spinner only while authenticated + waiting for first sync
//   if (isAuthenticated && activeBranchId && !initialSyncDone) {
//     return (
//       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
//         <div className="flex flex-col items-center gap-4">
//           <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
//           <div className="text-center">
//             <p className="text-sm font-medium text-ink">Syncing your data…</p>
//             <p className="text-xs text-ink-muted mt-1">
//               Fetching latest drugs, inventory and contracts
//             </p>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return <>{children}</>;
// }

// function AppRoutes() {
//   const { isAuthenticated, activeBranchId, isLoading, initialize } = useAuthStore();

//   useEffect(() => {
//     initialize();
//     // Broadcast auth:logout → hard redirect so all state is cleared cleanly
//     const handler = () => { window.location.href = "/login"; };
//     window.addEventListener("auth:logout", handler);
//     return () => window.removeEventListener("auth:logout", handler);
//   }, [initialize]);

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
//         <div className="flex flex-col items-center gap-3">
//           <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
//           <p className="text-sm text-ink-muted">Loading…</p>
//         </div>
//       </div>
//     );
//   }

//   const isFullyAuthenticated = isAuthenticated && !!activeBranchId;

//   return (
//     <SyncGate>
//       <Routes>
//         {/* ── Public ── */}

//         {/* FIX: Wrap /onboarding in RequireUnauthenticated so logged-in
//             users are redirected to /drugs instead of seeing the setup form. */}
//         <Route
//           path="/onboarding"
//           element={<RequireUnauthenticated><OnboardingPage /></RequireUnauthenticated>}
//         />
//         <Route
//           path="/login"
//           element={isFullyAuthenticated ? <Navigate to="/drugs" replace /> : <LoginPage />}
//         />

//         {/* ── Protected ── */}
//         <Route
//           path="/drugs"
//           element={<RequireAuth><AppShell><DrugListPage /></AppShell></RequireAuth>}
//         />
//         <Route
//           path="/inventory"
//           element={<RequireAuth><AppShell><InventoryPage /></AppShell></RequireAuth>}
//         />
//         <Route
//           path="/pos"
//           element={<RequireAuth><AppShell><POSPage /></AppShell></RequireAuth>}
//         />
//         <Route
//           path="/customers"
//           element={<RequireAuth><AppShell><ComingSoon label="Customers" /></AppShell></RequireAuth>}
//         />
//         <Route
//           path="/purchases"
//           element={<RequireAuth><AppShell><ComingSoon label="Purchases" /></AppShell></RequireAuth>}
//         />
//         <Route
//           path="/reports"
//           element={<RequireAuth><AppShell><ComingSoon label="Reports" /></AppShell></RequireAuth>}
//         />

//         {/* ── FIX: /dashboard alias — LoginPage and authStore both navigate
//             here after login. Without this route the catch-all sent users to
//             "/" which redirected to "/drugs" via a second Navigate, causing a
//             flash. Now /dashboard goes directly to /drugs. ── */}
//         <Route
//           path="/dashboard"
//           element={<Navigate to="/drugs" replace />}
//         />

//         {/* ── Redirects ── */}
//         <Route
//           path="/"
//           element={<Navigate to={isFullyAuthenticated ? "/drugs" : "/login"} replace />}
//         />
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//     </SyncGate>
//   );
// }

// export default function App() {
//   return (
//     <QueryClientProvider client={queryClient}>
//       <BrowserRouter>
//         <AppRoutes />
//         <Toaster position="top-right" richColors closeButton />
//       </BrowserRouter>
//     </QueryClientProvider>
//   );
// }
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

// FIX: Guard /onboarding so already-authenticated users are redirected away.
// Without this, an admin who accidentally navigates to /onboarding while
// logged in sees the full creation form, which is confusing and dangerous.
function RequireUnauthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeBranchId } = useAuthStore();
  if (isAuthenticated && activeBranchId) {
    return <Navigate to="/drugs" replace />;
  }
  return <>{children}</>;
}

/**
 * SyncGate — waits for the very first pull after a fresh login to complete
 * before rendering the app, so the local DB is populated before any page
 * tries to read it.
 *
 * FIX (original issues):
 * 1. The gate was re-triggering on every branch switch, showing "Syncing…"
 *    every time the user changed branches — not just on first login.
 * 2. The 300ms fallback timer was the only thing preventing a permanent
 *    loading screen on restarts where the engine was already "idle".
 *
 * Fix strategy:
 * - Track whether we've already passed the gate once per mount via a ref.
 *   Once `initialSyncDone` is true it is never reset back to false within
 *   this component's lifetime — branch switches don't re-trigger it.
 * - On mount, if the engine is already idle/offline/error (i.e. the user
 *   is restoring a session and the engine ran before this component mounted)
 *   we immediately mark the gate as done instead of waiting for a status
 *   change that already happened.
 */
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

    // FIX: if the engine is already in a terminal state when this effect
    // runs (common on session restore where sync started before the gate
    // mounted), mark done immediately rather than waiting for a future event
    // that has already fired.
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

        {/* FIX: Wrap /onboarding in RequireUnauthenticated so logged-in
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
          element={<RequireAuth><AppShell><ComingSoon label="Purchases" /></AppShell></RequireAuth>}
        />
        <Route
          path="/reports"
          element={<RequireAuth><AppShell><ComingSoon label="Reports" /></AppShell></RequireAuth>}
        />

        {/* ── FIX: /dashboard alias — LoginPage and authStore both navigate
            here after login. Without this route the catch-all sent users to
            "/" which redirected to "/drugs" via a second Navigate, causing a
            flash. Now /dashboard goes directly to /drugs. ── */}
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