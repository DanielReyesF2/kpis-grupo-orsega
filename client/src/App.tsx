// VERSIÓN MÍNIMA PARA DIAGNÓSTICO - Error React #31
// Vamos agregando componentes uno por uno para encontrar la causa

import ErrorBoundary from "@/components/ErrorBoundary";

// PASO 1: Solo ErrorBoundary + div
// Si esto falla, el problema está en ErrorBoundary

function App() {
  return (
    <ErrorBoundary>
      <div className="p-8">
        <h1 className="text-2xl font-bold">Test Mínimo - Si ves esto, funciona</h1>
        <p>Paso 1: ErrorBoundary + div simple</p>
      </div>
    </ErrorBoundary>
  );
}

export default App;
