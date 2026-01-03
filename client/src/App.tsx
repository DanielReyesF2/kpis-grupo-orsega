import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "next-themes";
import { SafeAuthProvider } from "@/components/SafeAuthProvider";
import { CompanyFilterProvider } from "@/hooks/use-company-filter";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

// Import pages directly (lazy loading desactivado temporalmente para diagnosticar error React #31)
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

// CopilotKit
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

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
        <ProtectedRoute adminOnly>
          <SystemAdminPage />
        </ProtectedRoute>
      </Route>

      <Route path="/treasury">
        <ProtectedRoute>
          <TreasuryPage />
        </ProtectedRoute>
      </Route>
      <Route path="/treasury/vouchers">
        <ProtectedRoute>
          <TreasuryPage />
        </ProtectedRoute>
      </Route>
      <Route path="/treasury/exchange-rates">
        <ProtectedRoute>
          <TreasuryPage />
        </ProtectedRoute>
      </Route>

      <Route path="/sales">
        <ProtectedRoute>
          <SalesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/sales/dura">
        <ProtectedRoute>
          <SalesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/sales/orsega">
        <ProtectedRoute>
          <SalesPage />
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
          <ThemeProvider attribute="class" defaultTheme="dark">
            <SafeAuthProvider>
              <CompanyFilterProvider>
                <CopilotKit runtimeUrl="/api/copilotkit">
                  <Toaster />
                  <Router />
                  <CopilotPopup
                    instructions="Eres un asistente AI para Grupo Orsega. Ayudas a los usuarios a analizar datos de ventas, logística, tesorería y KPIs. Responde siempre en español. Sé conciso y profesional."
                    labels={{
                      title: "Asistente AI",
                      initial: "¡Hola! Soy tu asistente AI. ¿En qué puedo ayudarte hoy?",
                      placeholder: "Escribe tu pregunta aquí...",
                    }}
                    defaultOpen={false}
                    clickOutsideToClose={true}
                  />
                </CopilotKit>
              </CompanyFilterProvider>
            </SafeAuthProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
