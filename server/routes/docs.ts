import { Router } from 'express';
import { jwtAuthMiddleware } from '../auth';

const router = Router();

/**
 * GET /api/docs
 * Auto-generated API catalog — discovers all registered Express routes.
 * Requires JWT authentication.
 */
router.get('/api/docs', jwtAuthMiddleware, (req, res) => {
  const routes: Array<{ method: string; path: string }> = [];

  const app = req.app;

  // Walk the Express router stack to discover all registered routes
  function extractRoutes(stack: any[], prefix: string = '') {
    for (const layer of stack) {
      if (layer.route) {
        // Direct route on the app
        const methods = Object.keys(layer.route.methods)
          .filter(m => layer.route.methods[m])
          .map(m => m.toUpperCase());
        for (const method of methods) {
          routes.push({ method, path: prefix + layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Mounted sub-router
        const mountPath = layer.regexp?.source === '^\\/?$'
          ? ''
          : layer.keys?.length
            ? prefix // path has params, skip parsing
            : extractMountPath(layer.regexp);
        extractRoutes(layer.handle.stack, prefix + mountPath);
      }
    }
  }

  function extractMountPath(regexp: RegExp | undefined): string {
    if (!regexp) return '';
    const match = regexp.source
      .replace('^\\/','/')
      .replace('\\/?(?=\\/|$)', '')
      .replace(/\\\//g, '/')
      .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');
    // Clean up: remove regex anchors and optional trailing slash patterns
    return match
      .replace(/^\^/, '')
      .replace(/\$/, '')
      .replace(/\(\?:\/\)\?$/,'')
      .replace(/\\/g, '');
  }

  try {
    if (app._router?.stack) {
      extractRoutes(app._router.stack);
    }

    // Sort by path then method
    routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

    res.json({
      name: 'KPIs Grupo Orsega API',
      version: '1.0.0',
      totalEndpoints: routes.length,
      routes,
    });
  } catch (error) {
    console.error('[GET /api/docs] Error generating API catalog:', error);
    res.status(500).json({ message: 'Error generating API catalog' });
  }
});

export default router;
