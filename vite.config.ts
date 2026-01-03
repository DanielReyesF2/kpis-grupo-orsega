import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  server: {
    // En desarrollo, Vite se maneja a través del servidor Express
    // La configuración de HMR se maneja en server/vite.ts
    // No configuramos HMR aquí para evitar conflictos
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Desactivar sourcemaps para build release estable
    sourcemap: false,
    rollupOptions: {
      output: {
        // Code splitting optimizado por rutas
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'vendor-charts': ['recharts'],
          'vendor-query': ['@tanstack/react-query'],
          'salesforce-components': [
            './client/src/components/salesforce/charts/GaugeChart',
            './client/src/components/salesforce/charts/FunnelChart',
            './client/src/components/salesforce/charts/EnhancedDonutChart',
            './client/src/components/salesforce/layout/PageHeader',
            './client/src/components/salesforce/layout/FilterBar',
            './client/src/components/salesforce/layout/ChartCard',
          ],
        },
      },
      onwarn(warning, warn) {
        // Reduce ruido de warnings no críticos en build
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      },
    },
    // Mantener nombres para stacks más legibles en errores en producción
    minify: 'esbuild',
    esbuild: {
      keepNames: false,
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
});
