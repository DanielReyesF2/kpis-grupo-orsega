// DIAGNÓSTICO Error React #31 - PASO 6b
// Probando: Solo ProtectedRoute SIN Dashboard

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
                      <div className="p-8">
                        <h1 className="text-2xl font-bold">Test - Paso 6b</h1>
                        <p>ProtectedRoute SIN Dashboard - si ves esto, Dashboard es el problema</p>
                      </div>
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
