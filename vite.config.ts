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
  root: path.resolve(import.meta.dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      // Resolver date-fns explícitamente
      "date-fns": path.resolve(import.meta.dirname, "node_modules/date-fns"),
    },
    // Optimizar resolución de módulos
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['date-fns', 'date-fns/locale'],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    },
  },
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
    commonjsOptions: {
      include: [/date-fns/, /mermaid/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: (id) => {
        // Excluir mermaid del bundle - es una dependencia de streamdown pero no se usa directamente
        if (id === 'mermaid' || id.includes('mermaid/')) {
          return true;
        }
        return false;
      },
      // Temporalmente desactivar manualChunks para diagnosticar problema con date-fns
      // output: {
      //   manualChunks(id) {
      //     if (id.includes('node_modules')) {
      //       if (id.includes('react') || id.includes('react-dom')) {
      //         return 'vendor-react';
      //       }
      //       if (id.includes('@radix-ui')) {
      //         return 'vendor-ui';
      //       }
      //       if (id.includes('recharts')) {
      //         return 'vendor-charts';
      //       }
      //       if (id.includes('@tanstack/react-query')) {
      //         return 'vendor-query';
      //       }
      //       return 'vendor-other';
      //     }
      //   },
      // },
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
