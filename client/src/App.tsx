import { lazy, Suspense } from "react";
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
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";

// Lazy load pages for better performance
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

// CopilotKit
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <Suspense fallback={<LoadingState variant="page" />}>
          <Login />
        </Suspense>
      </Route>
      <Route path="/register">
        <Suspense fallback={<LoadingState variant="page" />}>
          <Register />
        </Suspense>
      </Route>
      <Route path="/activate/:token">
        <Suspense fallback={<LoadingState variant="page" />}>
          <UserActivation />
        </Suspense>
      </Route>
      
      <Route path="/">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <Dashboard />
          </Suspense>
        </ProtectedRoute>
      </Route>
      
      <Route path="/logistics">
        <ProtectedRoute logisticsOnly>
          <Suspense fallback={<LoadingState variant="page" />}>
            <LogisticsPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      
      <Route path="/shipments">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <ShipmentsPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/new-shipment">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <NewShipmentPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/trends-analysis">
        <ProtectedRoute executiveOnly>
          <Suspense fallback={<LoadingState variant="page" />}>
            <TrendsAnalysisPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/kpi-control">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <KpiControlCenter />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/team-management">
        <ProtectedRoute adminOnly>
          <Suspense fallback={<LoadingState variant="page" />}>
            <SystemAdminPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/treasury">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <TreasuryPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/treasury/vouchers">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <TreasuryPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/treasury/exchange-rates">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <TreasuryPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/sales">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <SalesPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/sales/dura">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <SalesPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/sales/orsega">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <SalesPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/mi-perfil">
        <ProtectedRoute>
          <Suspense fallback={<LoadingState variant="page" />}>
            <ProfilePage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin">
        <ProtectedRoute adminOnly>
          <Suspense fallback={<LoadingState variant="page" />}>
            <SystemAdminPage />
          </Suspense>
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
