/**
 * Módulo de métricas de rentabilidad
 * Calcula rentabilidad real basada en datos de sales_data
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;
const sql = neon(process.env.DATABASE_URL!);

export interface ProductProfitability {
  productName: string;
  productId: number | null;
  totalRevenue: number;
  totalQuantity: number;
  avgUnitPrice: number;
  transactionCount: number;
  profitability: number; // Margen estimado basado en precio promedio
}

export interface ClientProfitability {
  clientName: string;
  clientId: number | null;
  totalRevenue: number;
  transactionCount: number;
  avgOrderValue: number;
  lastPurchaseDate: string;
}

export interface ShipmentProfitability {
  invoiceNumber: string;
  folio: string | null;
  saleDate: string;
  clientName: string;
  totalAmount: number;
  itemCount: number;
  products: string[];
}

export interface ProfitabilityMetrics {
  overallProfitability: number;
  totalRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
  topProducts: ProductProfitability[];
  topClients: ClientProfitability[];
  topShipments: ShipmentProfitability[];
}

/**
 * Calcula rentabilidad real basada en datos de la base de datos
 * Usa unit_price y total_amount para calcular margen estimado
 */
export async function calculateRealProfitability(
  companyId: number,
  year?: number
): Promise<ProfitabilityMetrics> {
  const targetYear = year || new Date().getFullYear();

  // 1. Calcular rentabilidad general
  const profitabilityQuery = `
    SELECT 
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT invoice_number) as total_transactions,
      COUNT(*) as total_items,
      AVG(total_amount) as avg_transaction_value,
      AVG(unit_price) as avg_unit_price
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND total_amount IS NOT NULL
      AND total_amount > 0
  `;

  const profitabilityData = await sql(profitabilityQuery, [companyId, targetYear]);
  const totalRevenue = parseFloat(profitabilityData[0]?.total_revenue || '0');
  const totalTransactions = parseInt(profitabilityData[0]?.total_transactions || '0');
  const avgTransactionValue = parseFloat(profitabilityData[0]?.avg_transaction_value || '0');
  const avgUnitPrice = parseFloat(profitabilityData[0]?.avg_unit_price || '0');

  // Calcular rentabilidad estimada basada en precio promedio
  // Si tenemos precio unitario, podemos estimar un margen
  // Para distribución: margen típico 15-25%, usamos 18% como base pero ajustamos según precio
  let overallProfitability = 18.0;
  
  if (avgUnitPrice > 0) {
    // Ajustar margen según precio promedio (productos más caros suelen tener mejor margen)
    if (avgUnitPrice > 100) {
      overallProfitability = 22.0; // Productos premium
    } else if (avgUnitPrice > 50) {
      overallProfitability = 20.0; // Productos medios
    } else {
      overallProfitability = 18.0; // Productos estándar
    }
  }

  // 2. Top productos por rentabilidad (por revenue total)
  const topProductsQuery = `
    SELECT 
      product_name,
      product_id,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(quantity), 0) as total_quantity,
      AVG(unit_price) as avg_unit_price,
      COUNT(*) as transaction_count
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND total_amount IS NOT NULL
      AND total_amount > 0
      AND product_name IS NOT NULL
    GROUP BY product_name, product_id
    ORDER BY total_revenue DESC
    LIMIT 20
  `;

  const topProductsData = await sql(topProductsQuery, [companyId, targetYear]);
  const topProducts: ProductProfitability[] = topProductsData.map((row: any) => {
    const revenue = parseFloat(row.total_revenue || '0');
    const quantity = parseFloat(row.total_quantity || '0');
    const avgPrice = parseFloat(row.avg_unit_price || '0');
    
    // Calcular rentabilidad estimada por producto
    let productProfitability = 18.0;
    if (avgPrice > 100) {
      productProfitability = 22.0;
    } else if (avgPrice > 50) {
      productProfitability = 20.0;
    }

    return {
      productName: row.product_name,
      productId: row.product_id ? parseInt(row.product_id) : null,
      totalRevenue: revenue,
      totalQuantity: quantity,
      avgUnitPrice: avgPrice,
      transactionCount: parseInt(row.transaction_count || '0'),
      profitability: productProfitability
    };
  });

  // 3. Top clientes por rentabilidad (por revenue total)
  const topClientsQuery = `
    SELECT 
      client_name,
      client_id,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT invoice_number) as transaction_count,
      AVG(total_amount) as avg_order_value,
      MAX(sale_date) as last_purchase_date
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND total_amount IS NOT NULL
      AND total_amount > 0
      AND client_name IS NOT NULL
      AND client_name <> ''
    GROUP BY client_name, client_id
    ORDER BY total_revenue DESC
    LIMIT 20
  `;

  const topClientsData = await sql(topClientsQuery, [companyId, targetYear]);
  const topClients: ClientProfitability[] = topClientsData.map((row: any) => ({
    clientName: row.client_name,
    clientId: row.client_id ? parseInt(row.client_id) : null,
    totalRevenue: parseFloat(row.total_revenue || '0'),
    transactionCount: parseInt(row.transaction_count || '0'),
    avgOrderValue: parseFloat(row.avg_order_value || '0'),
    lastPurchaseDate: row.last_purchase_date ? new Date(row.last_purchase_date).toISOString().split('T')[0] : ''
  }));

  // 4. Top envíos/transacciones por monto
  const topShipmentsQuery = `
    SELECT 
      invoice_number,
      folio,
      sale_date,
      client_name,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COUNT(*) as item_count,
      STRING_AGG(DISTINCT product_name, ', ') as products
    FROM sales_data
    WHERE company_id = $1
      AND sale_year = $2
      AND total_amount IS NOT NULL
      AND total_amount > 0
      AND invoice_number IS NOT NULL
    GROUP BY invoice_number, folio, sale_date, client_name
    ORDER BY total_amount DESC
    LIMIT 20
  `;

  const topShipmentsData = await sql(topShipmentsQuery, [companyId, targetYear]);
  const topShipments: ShipmentProfitability[] = topShipmentsData.map((row: any) => ({
    invoiceNumber: row.invoice_number,
    folio: row.folio || null,
    saleDate: row.sale_date ? new Date(row.sale_date).toISOString().split('T')[0] : '',
    clientName: row.client_name,
    totalAmount: parseFloat(row.total_amount || '0'),
    itemCount: parseInt(row.item_count || '0'),
    products: row.products ? row.products.split(', ').slice(0, 3) : [] // Primeros 3 productos
  }));

  return {
    overallProfitability,
    totalRevenue,
    totalTransactions,
    avgTransactionValue,
    topProducts,
    topClients,
    topShipments
  };
}

