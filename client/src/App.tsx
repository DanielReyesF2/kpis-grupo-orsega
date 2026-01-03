// DIAGNÓSTICO Error React #31 - PASO 3
// Agregando: SafeAuthProvider + CompanyFilterProvider

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "next-themes";
import { SafeAuthProvider } from "@/components/SafeAuthProvider";
import { CompanyFilterProvider } from "@/hooks/use-company-filter";
import ErrorBoundary from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <SafeAuthProvider>
            <CompanyFilterProvider>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Test - Paso 3</h1>
                <p>SafeAuthProvider + CompanyFilterProvider agregados</p>
              </div>
            </CompanyFilterProvider>
          </SafeAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
