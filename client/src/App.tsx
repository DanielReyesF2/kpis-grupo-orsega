import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "next-themes";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import LogisticsPage from "@/pages/LogisticsPage";
import TrendsAnalysisPage from "@/pages/TrendsAnalysisPage";

import KpiControlCenter from "@/pages/KpiControlCenter";
import SystemAdminPage from "@/pages/SystemAdminPage";
import ProfilePage from "@/pages/ProfilePage";
import UserActivation from "@/pages/UserActivation";
import { SafeAuthProvider } from "@/components/SafeAuthProvider";
import { CompanyFilterProvider } from "@/hooks/use-company-filter";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import ShipmentsPage from "@/pages/ShipmentsPage";
import NewShipmentPage from "@/pages/NewShipmentPage";
import TeamManagement from "@/pages/TeamManagement";
import TreasuryPage from "@/pages/TreasuryPage";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/activate/:token" component={UserActivation} />
      
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      

      
      <Route path="/logistics">
        <ProtectedRoute logisticsOnly>
          <LogisticsPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/shipments">
        <ProtectedRoute>
          <ShipmentsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/new-shipment">
        <ProtectedRoute>
          <NewShipmentPage />
        </ProtectedRoute>
      </Route>

      <Route path="/trends-analysis">
        <ProtectedRoute executiveOnly>
          <TrendsAnalysisPage />
        </ProtectedRoute>
      </Route>


      <Route path="/kpi-control">
        <ProtectedRoute>
          <KpiControlCenter />
        </ProtectedRoute>
      </Route>

      <Route path="/team-management">
        <ProtectedRoute>
          <KpiControlCenter />
        </ProtectedRoute>
      </Route>

      <Route path="/treasury">
        <ProtectedRoute>
          <TreasuryPage />
        </ProtectedRoute>
      </Route>

      <Route path="/mi-perfil">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin">
        <ProtectedRoute adminOnly>
          <SystemAdminPage />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider attribute="class" defaultTheme="light">
            <SafeAuthProvider>
              <CompanyFilterProvider>
                <Toaster />
                <Router />
              </CompanyFilterProvider>
            </SafeAuthProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
