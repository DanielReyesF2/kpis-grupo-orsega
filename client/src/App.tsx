// DIAGNÓSTICO Error React #31 - PASO 2
// Agregando: QueryClientProvider + ThemeProvider

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <div className="p-8">
            <h1 className="text-2xl font-bold">Test - Paso 2</h1>
            <p>QueryClientProvider + ThemeProvider agregados</p>
          </div>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
