// DIAGNÓSTICO Error React #31 - PASO 8
// Probando: AppLayout + PageHeader

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
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { BarChart3 } from "lucide-react";

function MinimalDashboard() {
  return (
    <AppLayout title="Test Dashboard">
      <PageHeader
        objectIcon={BarChart3}
        title="Dashboard Ejecutivo"
        subtitle="Test - Paso 8"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Dashboard' },
        ]}
      />
      <div className="p-8">
        <p>PageHeader agregado - si ves esto, PageHeader funciona</p>
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
