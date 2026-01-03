// DIAGNÓSTICO Error React #31 - PASO 5
// Agregando: Router con solo Login

import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "next-themes";
import { SafeAuthProvider } from "@/components/SafeAuthProvider";
import { CompanyFilterProvider } from "@/hooks/use-company-filter";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
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
                <Route>
                  {() => (
                    <div className="p-8">
                      <h1 className="text-2xl font-bold">Test - Paso 5</h1>
                      <p>Router + Login agregados</p>
                      <a href="/login" className="text-blue-500 underline">Ir a Login</a>
                    </div>
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
