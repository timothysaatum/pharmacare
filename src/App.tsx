// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { useEffect } from "react";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { Toaster } from "sonner";
// import OnboardingPage from "@/pages/OnboardingPage";
// import LoginPage from "@/pages/LoginPage";
// import { useAuthStore } from "@/stores/authStore";

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 1000 * 60 * 5,
//       retry: 1,
//     },
//   },
// });

// function AppRoutes() {
//   const { isAuthenticated, activeBranchId, isLoading, initialize } = useAuthStore();

//   useEffect(() => {
//     initialize();

//     // Listen for forced logout from API client (expired refresh token)
//     const handler = () => {
//       window.location.href = "/login";
//     };
//     window.addEventListener("auth:logout", handler);
//     return () => window.removeEventListener("auth:logout", handler);
//   }, [initialize]);

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-surface flex items-center justify-center">
//         <div className="flex flex-col items-center gap-3">
//           <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
//           <p className="text-sm text-ink-muted">Loading…</p>
//         </div>
//       </div>
//     );
//   }

//   const isFullyAuthenticated = isAuthenticated && !!activeBranchId;

//   return (
//     <Routes>
//       {/* Public routes */}
//       <Route path="/onboarding" element={<OnboardingPage />} />
//       <Route
//         path="/login"
//         element={
//           isFullyAuthenticated
//             ? <Navigate to="/dashboard" replace />
//             : <LoginPage />
//         }
//       />

//       {/* Protected placeholder — replace with real Dashboard later */}
//       <Route
//         path="/dashboard"
//         element={
//           isFullyAuthenticated
//             ? <div className="min-h-screen flex items-center justify-center font-display text-2xl text-ink">Dashboard coming soon</div>
//             : <Navigate to="/login" replace />
//         }
//       />

//       {/* Root redirect */}
//       <Route
//         path="/"
//         element={
//           isFullyAuthenticated
//             ? <Navigate to="/dashboard" replace />
//             : isAuthenticated
//               ? <Navigate to="/login" replace /> // authenticated but no branch
//               : <Navigate to="/login" replace />
//         }
//       />

//       {/* Catch-all */}
//       <Route path="*" element={<Navigate to="/" replace />} />
//     </Routes>
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
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { AppShell } from "@/components/layout/AppShell";
import OnboardingPage from "@/pages/OnboardingPage";
import LoginPage from "@/pages/LoginPage";
import DrugListPage from "@/pages/DrugListPage";
import InventoryPage from "@/pages/InventoryPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

// Placeholder for pages not yet built
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

function AppRoutes() {
  const { isAuthenticated, activeBranchId, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
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
    <Routes>
      {/* ── Public ── */}
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/login"
        element={isFullyAuthenticated ? <Navigate to="/drugs" replace /> : <LoginPage />}
      />

      {/* ── Protected (all wrapped in AppShell) ── */}
      <Route
        path="/drugs"
        element={
          <RequireAuth>
            <AppShell><DrugListPage /></AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireAuth>
            <AppShell><InventoryPage /></AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/pos"
        element={
          <RequireAuth>
            <AppShell><ComingSoon label="Point of Sale" /></AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/customers"
        element={
          <RequireAuth>
            <AppShell><ComingSoon label="Customers" /></AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchases"
        element={
          <RequireAuth>
            <AppShell><ComingSoon label="Purchases" /></AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <AppShell><ComingSoon label="Reports" /></AppShell>
          </RequireAuth>
        }
      />

      {/* ── Redirects ── */}
      <Route
        path="/"
        element={<Navigate to={isFullyAuthenticated ? "/drugs" : "/login"} replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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