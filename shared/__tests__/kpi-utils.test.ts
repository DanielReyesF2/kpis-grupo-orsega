/**
 * Tests para validar consistencia de funciones centralizadas de KPIs
 */

import { describe, it, expect } from 'vitest';
import { 
  calculateKpiStatus, 
  calculateCompliance, 
  isLowerBetterKPI,
  normalizeStatus,
  parseNumericValue
} from '../kpi-utils';

describe('KPI Utils - Funciones Centralizadas', () => {
  describe('parseNumericValue', () => {
    it('debe parsear números simples', () => {
      expect(parseNumericValue('100')).toBe(100);
      expect(parseNumericValue('50.5')).toBe(50.5);
    });

    it('debe parsear strings con formato', () => {
      expect(parseNumericValue('1,000')).toBe(1000);
      expect(parseNumericValue('$500')).toBe(500);
      expect(parseNumericValue('100 KG')).toBe(100);
    });

    it('debe manejar null/undefined', () => {
      expect(parseNumericValue(null)).toBeNaN();
      expect(parseNumericValue(undefined)).toBeNaN();
    });

    it('debe manejar números directamente', () => {
      expect(parseNumericValue(100)).toBe(100);
      expect(parseNumericValue(50.5)).toBe(50.5);
    });
  });

  describe('isLowerBetterKPI', () => {
    it('debe identificar KPIs donde menor es mejor', () => {
      expect(isLowerBetterKPI('Días de cobro')).toBe(true);
      expect(isLowerBetterKPI('Tiempo de entrega')).toBe(true);
      expect(isLowerBetterKPI('Costos operativos')).toBe(true);
      expect(isLowerBetterKPI('Huella de carbono')).toBe(true);
    });

    it('debe identificar KPIs donde mayor es mejor', () => {
      expect(isLowerBetterKPI('Volumen de ventas')).toBe(false);
      expect(isLowerBetterKPI('Satisfacción del cliente')).toBe(false);
      expect(isLowerBetterKPI('Productividad')).toBe(false);
    });
  });

  describe('calculateKpiStatus', () => {
    describe('Higher is better (mayor es mejor)', () => {
      it('debe retornar complies cuando el valor es mayor o igual al objetivo', () => {
        expect(calculateKpiStatus('100', '100', 'Ventas')).toBe('complies');
        expect(calculateKpiStatus('150', '100', 'Ventas')).toBe('complies');
        expect(calculateKpiStatus(100, 100, 'Ventas')).toBe('complies');
      });

      it('debe retornar alert cuando el valor está entre 90% y 100% del objetivo', () => {
        expect(calculateKpiStatus('95', '100', 'Ventas')).toBe('alert');
        expect(calculateKpiStatus('90', '100', 'Ventas')).toBe('alert');
      });

      it('debe retornar not_compliant cuando el valor es menor al 90% del objetivo', () => {
        expect(calculateKpiStatus('80', '100', 'Ventas')).toBe('not_compliant');
        expect(calculateKpiStatus('50', '100', 'Ventas')).toBe('not_compliant');
      });
    });

    describe('Lower is better (menor es mejor)', () => {
      it('debe retornar complies cuando el valor es menor o igual al objetivo', () => {
        expect(calculateKpiStatus('100', '100', 'Días de cobro')).toBe('complies');
        expect(calculateKpiStatus('80', '100', 'Días de cobro')).toBe('complies');
      });

      it('debe retornar alert cuando el valor está entre 100% y 110% del objetivo', () => {
        expect(calculateKpiStatus('105', '100', 'Días de cobro')).toBe('alert');
        expect(calculateKpiStatus('110', '100', 'Días de cobro')).toBe('alert');
      });

      it('debe retornar not_compliant cuando el valor es mayor al 110% del objetivo', () => {
        expect(calculateKpiStatus('120', '100', 'Días de cobro')).toBe('not_compliant');
        expect(calculateKpiStatus('150', '100', 'Días de cobro')).toBe('not_compliant');
      });
    });

    it('debe retornar alert cuando no se pueden parsear los valores pero hay un valor actual', () => {
      expect(calculateKpiStatus('abc', '100', 'Ventas')).toBe('alert');
      expect(calculateKpiStatus('100', 'abc', 'Ventas')).toBe('alert');
    });

    it('debe retornar not_compliant cuando no hay valores', () => {
      expect(calculateKpiStatus(null, '100', 'Ventas')).toBe('not_compliant');
      expect(calculateKpiStatus('100', null, 'Ventas')).toBe('not_compliant');
    });
  });

  describe('calculateCompliance', () => {
    describe('Higher is better', () => {
      it('debe calcular compliance correctamente', () => {
        expect(calculateCompliance('100', '100', 'Ventas')).toBe('100.0%');
        expect(calculateCompliance('150', '100', 'Ventas')).toBe('150.0%');
        expect(calculateCompliance('50', '100', 'Ventas')).toBe('50.0%');
      });

      it('debe manejar valores con formato', () => {
        expect(calculateCompliance('1,000', '500', 'Ventas')).toBe('200.0%');
      });
    });

    describe('Lower is better', () => {
      it('debe calcular compliance correctamente (inverso)', () => {
        expect(calculateCompliance('100', '100', 'Días de cobro')).toBe('100.0%');
        expect(calculateCompliance('50', '100', 'Días de cobro')).toBe('200.0%');
        expect(calculateCompliance('150', '100', 'Días de cobro')).toBe('66.7%');
      });

      it('debe manejar valor 0 como caso especial', () => {
        expect(calculateCompliance('0', '100', 'Días de cobro')).toBe('200.0%');
      });
    });

    it('debe retornar 0.0% cuando no se pueden parsear valores', () => {
      expect(calculateCompliance('abc', '100', 'Ventas')).toBe('0.0%');
      expect(calculateCompliance('100', 'abc', 'Ventas')).toBe('0.0%');
      expect(calculateCompliance(null, '100', 'Ventas')).toBe('0.0%');
    });
  });

  describe('normalizeStatus', () => {
    it('debe normalizar diferentes formatos de status', () => {
      expect(normalizeStatus('compliant')).toBe('complies');
      expect(normalizeStatus('non-compliant')).toBe('not_compliant');
      expect(normalizeStatus('alert')).toBe('alert');
      expect(normalizeStatus('complies')).toBe('complies');
      expect(normalizeStatus('not_compliant')).toBe('not_compliant');
    });

    it('debe retornar not_compliant para valores desconocidos', () => {
      expect(normalizeStatus('unknown')).toBe('not_compliant');
      expect(normalizeStatus(null)).toBe('not_compliant');
      expect(normalizeStatus(undefined)).toBe('not_compliant');
    });
  });

  describe('Consistencia entre funciones', () => {
    it('debe calcular status y compliance de manera consistente', () => {
      const value = '95';
      const target = '100';
      const kpiName = 'Ventas';
      
      const status = calculateKpiStatus(value, target, kpiName);
      const compliance = calculateCompliance(value, target, kpiName);
      
      // Si el status es alert, el compliance debería estar entre 90% y 100%
      if (status === 'alert') {
        const complianceNum = parseFloat(compliance.replace('%', ''));
        expect(complianceNum).toBeGreaterThanOrEqual(90);
        expect(complianceNum).toBeLessThan(100);
      }
    });

    it('debe usar la misma lógica para determinar lower is better', () => {
      const kpiName = 'Días de cobro';
      const isLower = isLowerBetterKPI(kpiName);
      
      // Si es lower better, un valor menor debería dar mejor status
      const statusLower = calculateKpiStatus('50', '100', kpiName);
      const statusHigher = calculateKpiStatus('150', '100', kpiName);
      
      expect(isLower).toBe(true);
      expect(statusLower).toBe('complies');
      expect(statusHigher).toBe('not_compliant');
    });
  });
});




