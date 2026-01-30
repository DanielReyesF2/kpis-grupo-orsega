/**
 * usePageContext — Maps the current pathname to a page identifier for Nova AI.
 */

import { useLocation } from 'wouter';

const PATH_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/sales': 'sales',
  '/ventas': 'sales',
  '/treasury': 'treasury',
  '/tesoreria': 'treasury',
  '/logistics': 'logistics',
  '/logistica': 'logistics',
  '/trends': 'trends-analysis',
  '/trends-analysis': 'trends-analysis',
  '/analisis': 'trends-analysis',
  '/invoices': 'invoices',
  '/facturas': 'invoices',
  '/quality': 'quality',
  '/calidad': 'quality',
};

export function usePageContext(): { page: string } {
  const [location] = useLocation();

  // Direct match
  if (PATH_MAP[location]) {
    return { page: PATH_MAP[location] };
  }

  // Prefix match (e.g. /sales/upload -> sales)
  for (const [path, ctx] of Object.entries(PATH_MAP)) {
    if (path !== '/' && location.startsWith(path)) {
      return { page: ctx };
    }
  }

  return { page: 'dashboard' };
}
