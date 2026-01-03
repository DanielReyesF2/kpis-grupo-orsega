// DIAGNÓSTICO Error React #31 - PASO 7
// Probando: Dashboard mínimo solo con AppLayout

import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "next-themes";
import { SafeAuthProvider } from "@/components/SafeAuthProvider";
import { CompanyFilterProvider } from "@/hooks/use-company-filter";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Login from "@/pages/Login";
import { AppLayout } from "@/components/layout/AppLayout";

function MinimalDashboard() {
  return (
    <AppLayout title="Test Dashboard">
      <div className="p-8">
        <h1 className="text-2xl font-bold">Test - Paso 7</h1>
        <p>AppLayout funciona - si ves esto, el problema está en otro componente del Dashboard</p>
      </div>
    </AppLayout>
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
              <Switch>
                <Route path="/login">{() => <Login />}</Route>
                <Route path="/">
                  {() => (
                    <ProtectedRoute>
                      <MinimalDashboard />
                    </ProtectedRoute>
                  )}
                </Route>
              </Switch>
            </CompanyFilterProvider>
          </SafeAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
