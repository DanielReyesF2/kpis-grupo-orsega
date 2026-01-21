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

// Import pages directly
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import LogisticsPage from "@/pages/LogisticsPage";
import TrendsAnalysisPage from "@/pages/TrendsAnalysisPage";
import KpiControlCenter from "@/pages/KpiControlCenter";
import SystemAdminPage from "@/pages/SystemAdminPage";
import ProfilePage from "@/pages/ProfilePage";
import UserActivation from "@/pages/UserActivation";
import ShipmentsPage from "@/pages/ShipmentsPage";
import NewShipmentPage from "@/pages/NewShipmentPage";
import TreasuryPage from "@/pages/TreasuryPage";
import SalesPage from "@/pages/SalesPage";

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
              <Router />
              <EcoNovaAssistant />
            </CompanyFilterProvider>
          </SafeAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
