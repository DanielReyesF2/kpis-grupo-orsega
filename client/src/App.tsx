import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "next-themes";
import { SafeAuthProvider } from "@/components/SafeAuthProvider";
import { CompanyFilterProvider } from "@/hooks/use-company-filter";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { EcoNovaAssistant } from "@/components/ai/EcoNovaAssistant";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages (code splitting)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const LogisticsPage = lazy(() => import("@/pages/LogisticsPage"));
const TrendsAnalysisPage = lazy(() => import("@/pages/TrendsAnalysisPage"));
const KpiControlCenter = lazy(() => import("@/pages/KpiControlCenter"));
const SystemAdminPage = lazy(() => import("@/pages/SystemAdminPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const UserActivation = lazy(() => import("@/pages/UserActivation"));
const ShipmentsPage = lazy(() => import("@/pages/ShipmentsPage"));
const NewShipmentPage = lazy(() => import("@/pages/NewShipmentPage"));
const TreasuryPage = lazy(() => import("@/pages/TreasuryPage"));
const SalesPage = lazy(() => import("@/pages/SalesPage"));
const ComercialPage = lazy(() => import("@/pages/ComercialPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <Login />}</Route>
      <Route path="/register">{() => <Register />}</Route>
      <Route path="/activate/:token">{() => <UserActivation />}</Route>

      <Route path="/">
        {() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/logistics">
        {() => (
          <ProtectedRoute logisticsOnly>
            <LogisticsPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/shipments">
        {() => (
          <ProtectedRoute>
            <ShipmentsPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/new-shipment">
        {() => (
          <ProtectedRoute>
            <NewShipmentPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/trends-analysis">
        {() => (
          <ProtectedRoute executiveOnly>
            <TrendsAnalysisPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/kpi-control">
        {() => (
          <ProtectedRoute>
            <KpiControlCenter />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/team-management">
        {() => (
          <ProtectedRoute adminOnly>
            <SystemAdminPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/treasury">
        {() => (
          <ProtectedRoute>
            <TreasuryPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/treasury/vouchers">
        {() => (
          <ProtectedRoute>
            <TreasuryPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/treasury/exchange-rates">
        {() => (
          <ProtectedRoute>
            <TreasuryPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/sales">
        {() => (
          <ProtectedRoute>
            <SalesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales/dura">
        {() => (
          <ProtectedRoute>
            <SalesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales/orsega">
        {() => (
          <ProtectedRoute>
            <SalesPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/comercial">
        {() => (
          <ProtectedRoute>
            <ComercialPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/mi-perfil">
        {() => (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/system-admin">
        {() => (
          <ProtectedRoute adminOnly>
            <SystemAdminPage />
          </ProtectedRoute>
        )}
      </Route>

      <Route>{() => <NotFound />}</Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <SafeAuthProvider>
            <CompanyFilterProvider>
              <Toaster />
              <Suspense fallback={<PageLoader />}>
                <Router />
              </Suspense>
              <EcoNovaAssistant />
            </CompanyFilterProvider>
          </SafeAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
