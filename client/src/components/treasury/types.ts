/**
 * Tipos compartidos del módulo de Tesorería.
 * Centraliza interfaces que antes estaban duplicadas en 5+ componentes.
 *
 * Los endpoints de suppliers usan raw SQL (snake_case) con alias SQL
 * (ej: s.moneda as currency). El tipo incluye ambas variantes para
 * compatibilidad durante la transición.
 */

/** Proveedor — respuesta del API GET /api/suppliers */
export interface SupplierAPI {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
  location?: string;
  currency?: string;
  requires_rep?: boolean;
  rep_frequency?: number;
  company_id?: number;
  company_name?: string;
  is_active?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Campos extendidos (importados del catálogo de clientes, presentes en BD)
  code?: string;
  rfc?: string;
  razon_social?: string;
  street_address?: string;
  colonia?: string;
  municipality?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  num_exterior?: string;
  num_interior?: string;
  entre_calle?: string;
  phone?: string;
  contact_name?: string;
  condicion_dias?: string;
  moneda?: string;
  tipo_proveedor?: string;
  es_nacional?: boolean;
}
