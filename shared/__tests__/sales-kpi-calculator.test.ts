/**
 * Tests para funciones puras del calculador de KPIs de ventas
 * Solo testea identifySalesKpiType (función pura sin dependencia de DB)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock neon before importing the module (sales-kpi-calculator imports sales-metrics which calls neon() at module level)
vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
}));

vi.mock('ws', () => ({ default: class {} }));

import { identifySalesKpiType } from '../../server/sales-kpi-calculator';

describe('Sales KPI Calculator - identifySalesKpiType', () => {
  // ==========================================================================
  // Volumen de ventas
  // ==========================================================================
  describe('volume', () => {
    it('detecta "Volumen de ventas"', () => {
      expect(identifySalesKpiType('Volumen de ventas')).toBe('volume');
    });

    it('detecta "Volumen de venta"', () => {
      expect(identifySalesKpiType('Volumen de venta')).toBe('volume');
    });

    it('detecta "Sales volume"', () => {
      expect(identifySalesKpiType('Sales volume')).toBe('volume');
    });

    it('detecta variantes con case-insensitivity', () => {
      expect(identifySalesKpiType('VOLUMEN DE VENTAS')).toBe('volume');
      expect(identifySalesKpiType('volumen de ventas')).toBe('volume');
      expect(identifySalesKpiType('Volumen De Ventas')).toBe('volume');
    });

    it('detecta con whitespace extra', () => {
      expect(identifySalesKpiType('  Volumen de ventas  ')).toBe('volume');
    });

    it('no detecta "volumen" solo sin "ventas/venta"', () => {
      expect(identifySalesKpiType('  volumen  ')).not.toBe('volume');
    });
  });

  // ==========================================================================
  // Clientes activos
  // ==========================================================================
  describe('active_clients', () => {
    it('detecta "Clientes activos"', () => {
      expect(identifySalesKpiType('Clientes activos')).toBe('active_clients');
    });

    it('detecta "Active clients"', () => {
      expect(identifySalesKpiType('Active clients')).toBe('active_clients');
    });

    it('detecta variantes case-insensitive', () => {
      expect(identifySalesKpiType('CLIENTES ACTIVOS')).toBe('active_clients');
      expect(identifySalesKpiType('clientes activos')).toBe('active_clients');
    });

    it('detecta con whitespace extra', () => {
      expect(identifySalesKpiType('  Clientes activos  ')).toBe('active_clients');
    });
  });

  // ==========================================================================
  // Crecimiento
  // ==========================================================================
  describe('growth', () => {
    it('detecta "Crecimiento YoY"', () => {
      expect(identifySalesKpiType('Crecimiento YoY')).toBe('growth');
    });

    it('detecta "Crecimiento"', () => {
      expect(identifySalesKpiType('Crecimiento')).toBe('growth');
    });

    it('detecta "Growth"', () => {
      expect(identifySalesKpiType('Growth')).toBe('growth');
    });

    it('detecta "Incremento"', () => {
      expect(identifySalesKpiType('Incremento')).toBe('growth');
    });

    it('detecta variantes case-insensitive', () => {
      expect(identifySalesKpiType('CRECIMIENTO')).toBe('growth');
      expect(identifySalesKpiType('incremento mensual')).toBe('growth');
    });
  });

  // ==========================================================================
  // Churn
  // ==========================================================================
  describe('churn', () => {
    it('detecta "Churn de clientes"', () => {
      expect(identifySalesKpiType('Churn de clientes')).toBe('churn');
    });

    it('detecta "Churn" solo', () => {
      expect(identifySalesKpiType('Churn')).toBe('churn');
    });

    it('detecta "Abandono"', () => {
      expect(identifySalesKpiType('Abandono')).toBe('churn');
    });

    it('detecta variantes case-insensitive', () => {
      expect(identifySalesKpiType('CHURN')).toBe('churn');
      expect(identifySalesKpiType('churn rate')).toBe('churn');
    });
  });

  // ==========================================================================
  // Retención
  // ==========================================================================
  describe('retention', () => {
    it('detecta "Retención"', () => {
      expect(identifySalesKpiType('Retención')).toBe('retention');
    });

    it('detecta "Retention"', () => {
      expect(identifySalesKpiType('Retention')).toBe('retention');
    });

    it('detecta "Retencion" sin acento', () => {
      expect(identifySalesKpiType('Retencion')).toBe('retention');
    });

    it('detecta variantes case-insensitive', () => {
      expect(identifySalesKpiType('RETENCIÓN DE CLIENTES')).toBe('retention');
      expect(identifySalesKpiType('retention rate')).toBe('retention');
    });
  });

  // ==========================================================================
  // Nuevos clientes
  // ==========================================================================
  describe('new_clients', () => {
    it('detecta "Nuevos clientes"', () => {
      expect(identifySalesKpiType('Nuevos clientes')).toBe('new_clients');
    });

    it('detecta "New clients"', () => {
      expect(identifySalesKpiType('New clients')).toBe('new_clients');
    });

    it('detecta variantes case-insensitive', () => {
      expect(identifySalesKpiType('NUEVOS CLIENTES')).toBe('new_clients');
      expect(identifySalesKpiType('nuevos clientes mensuales')).toBe('new_clients');
    });
  });

  // ==========================================================================
  // Valor promedio por orden
  // ==========================================================================
  describe('avg_order_value', () => {
    it('detecta "Valor promedio"', () => {
      expect(identifySalesKpiType('Valor promedio')).toBe('avg_order_value');
    });

    it('detecta "Average order"', () => {
      expect(identifySalesKpiType('Average order')).toBe('avg_order_value');
    });

    it('detecta "Ticket promedio"', () => {
      expect(identifySalesKpiType('Ticket promedio')).toBe('avg_order_value');
    });

    it('detecta "Avg order"', () => {
      expect(identifySalesKpiType('Avg order')).toBe('avg_order_value');
    });

    it('detecta variantes case-insensitive', () => {
      expect(identifySalesKpiType('VALOR PROMEDIO POR ORDEN')).toBe('avg_order_value');
      expect(identifySalesKpiType('ticket promedio mensual')).toBe('avg_order_value');
    });
  });

  // ==========================================================================
  // Unknown (no es KPI de ventas)
  // ==========================================================================
  describe('unknown', () => {
    it('retorna unknown para KPIs no de ventas', () => {
      expect(identifySalesKpiType('Productividad')).toBe('unknown');
      expect(identifySalesKpiType('Satisfacción del cliente')).toBe('unknown');
      expect(identifySalesKpiType('Margen de utilidad')).toBe('unknown');
      expect(identifySalesKpiType('Días de cobro')).toBe('unknown');
      expect(identifySalesKpiType('Costos operativos')).toBe('unknown');
    });

    it('retorna unknown para strings vacíos o genéricos', () => {
      expect(identifySalesKpiType('')).toBe('unknown');
      expect(identifySalesKpiType('   ')).toBe('unknown');
      expect(identifySalesKpiType('KPI General')).toBe('unknown');
    });

    it('no confunde "volumen" solo sin "ventas/venta"', () => {
      expect(identifySalesKpiType('Volumen de producción')).toBe('unknown');
      expect(identifySalesKpiType('Volumen de agua')).toBe('unknown');
    });

    it('no confunde "clientes" sin "activos"', () => {
      expect(identifySalesKpiType('Clientes totales')).toBe('unknown');
    });

    it('"Clientes nuevos" se detecta como new_clients', () => {
      expect(identifySalesKpiType('Clientes nuevos')).toBe('new_clients');
    });
  });

  // ==========================================================================
  // Prioridad de detección
  // ==========================================================================
  describe('prioridad de detección', () => {
    it('detecta volumen antes que otros KPIs cuando tiene ambas keywords', () => {
      expect(identifySalesKpiType('Volumen de ventas con crecimiento')).toBe('volume');
    });

    it('detecta el primer match en orden del switch', () => {
      const categories = [
        { name: 'Volumen de ventas', expected: 'volume' },
        { name: 'Clientes activos', expected: 'active_clients' },
        { name: 'Crecimiento', expected: 'growth' },
        { name: 'Churn', expected: 'churn' },
        { name: 'Retención', expected: 'retention' },
        { name: 'Nuevos clientes', expected: 'new_clients' },
        { name: 'Valor promedio', expected: 'avg_order_value' },
      ];

      for (const { name, expected } of categories) {
        expect(identifySalesKpiType(name)).toBe(expected);
      }
    });
  });
});
