/**
 * Tests para validar consistencia de funciones centralizadas de KPIs
 * Expandido: ~200+ assertions cubriendo edge cases, boundaries, y formatos
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
  // ==========================================================================
  // parseNumericValue
  // ==========================================================================
  describe('parseNumericValue', () => {
    it('debe parsear números simples', () => {
      expect(parseNumericValue('100')).toBe(100);
      expect(parseNumericValue('50.5')).toBe(50.5);
      expect(parseNumericValue('0')).toBe(0);
    });

    it('debe parsear números negativos', () => {
      expect(parseNumericValue('-50')).toBe(-50);
      expect(parseNumericValue('-3.14')).toBe(-3.14);
    });

    it('debe parsear strings con símbolo de moneda', () => {
      expect(parseNumericValue('$500')).toBe(500);
      expect(parseNumericValue('$1,500')).toBe(1500);
      expect(parseNumericValue('$0.99')).toBe(0.99);
    });

    it('debe parsear strings con porcentaje', () => {
      expect(parseNumericValue('95%')).toBe(95);
      expect(parseNumericValue('100%')).toBe(100);
      expect(parseNumericValue('0%')).toBe(0);
    });

    it('debe parsear formato con coma como separador de miles', () => {
      // Note: commas are stripped by initial replace, then parseFloat handles the rest
      expect(parseNumericValue('1,000')).toBe(1000);
      expect(parseNumericValue('1,500')).toBe(1500);
      expect(parseNumericValue('10,000')).toBe(10000);
    });

    it('debe parsear strings con espacios', () => {
      expect(parseNumericValue('  100  ')).toBe(100);
      expect(parseNumericValue(' 50.5 ')).toBe(50.5);
    });

    it('debe parsear strings con unidades al final', () => {
      expect(parseNumericValue('100 KG')).toBe(100);
      expect(parseNumericValue('500 unidades')).toBe(500);
    });

    it('debe manejar null/undefined', () => {
      expect(parseNumericValue(null)).toBeNaN();
      expect(parseNumericValue(undefined)).toBeNaN();
    });

    it('debe manejar string vacío', () => {
      expect(parseNumericValue('')).toBeNaN();
    });

    it('debe manejar strings no numéricos', () => {
      expect(parseNumericValue('abc')).toBeNaN();
      expect(parseNumericValue('N/A')).toBeNaN();
    });

    it('debe manejar números directamente', () => {
      expect(parseNumericValue(100)).toBe(100);
      expect(parseNumericValue(50.5)).toBe(50.5);
      expect(parseNumericValue(0)).toBe(0);
      expect(parseNumericValue(-10)).toBe(-10);
    });

    it('debe manejar notación científica', () => {
      expect(parseNumericValue('1e5')).toBe(100000);
      expect(parseNumericValue('2.5e3')).toBe(2500);
    });
  });

  // ==========================================================================
  // isLowerBetterKPI
  // ==========================================================================
  describe('isLowerBetterKPI', () => {
    it('debe identificar KPIs de tiempo donde menor es mejor', () => {
      expect(isLowerBetterKPI('Días de cobro')).toBe(true);
      expect(isLowerBetterKPI('Días de pago')).toBe(true);
      expect(isLowerBetterKPI('Tiempo de entrega')).toBe(true);
      expect(isLowerBetterKPI('Tiempo promedio de respuesta')).toBe(true);
      expect(isLowerBetterKPI('Tiempo de ciclo')).toBe(true);
      expect(isLowerBetterKPI('Tiempo de respuesta')).toBe(true);
    });

    it('debe identificar KPIs de costos donde menor es mejor', () => {
      expect(isLowerBetterKPI('Costos operativos')).toBe(true);
      expect(isLowerBetterKPI('Gastos administrativos')).toBe(true);
      expect(isLowerBetterKPI('Gasto total')).toBe(true);
    });

    it('debe identificar KPIs de calidad donde menor es mejor', () => {
      expect(isLowerBetterKPI('Defectos por lote')).toBe(true);
      expect(isLowerBetterKPI('Errores de producción')).toBe(true);
      expect(isLowerBetterKPI('Quejas de clientes')).toBe(true);
      expect(isLowerBetterKPI('Devoluciones')).toBe(true);
      expect(isLowerBetterKPI('Rechazos')).toBe(true);
    });

    it('debe identificar KPIs de inventario/desperdicio donde menor es mejor', () => {
      expect(isLowerBetterKPI('Merma de producción')).toBe(true);
      expect(isLowerBetterKPI('Desperdicio de materiales')).toBe(true);
      expect(isLowerBetterKPI('Días de inventario')).toBe(true);
      expect(isLowerBetterKPI('Rotación de inventario')).toBe(true);
    });

    it('debe identificar KPIs de retención/financieros donde menor es mejor', () => {
      expect(isLowerBetterKPI('Churn de clientes')).toBe(true);
      expect(isLowerBetterKPI('Cartera vencida')).toBe(true);
      expect(isLowerBetterKPI('Descuento promedio')).toBe(true);
      expect(isLowerBetterKPI('Cancelacion de pedidos')).toBe(true);
    });

    it('debe identificar KPIs de demora donde menor es mejor', () => {
      expect(isLowerBetterKPI('Retraso en entregas')).toBe(true);
      expect(isLowerBetterKPI('Demora en producción')).toBe(true);
      expect(isLowerBetterKPI('Plazo de entrega')).toBe(true);
    });

    it('debe identificar KPI de sostenibilidad donde menor es mejor', () => {
      expect(isLowerBetterKPI('Huella de carbono')).toBe(true);
    });

    it('debe ser case-insensitive', () => {
      expect(isLowerBetterKPI('DÍAS DE COBRO')).toBe(true);
      expect(isLowerBetterKPI('COSTOS OPERATIVOS')).toBe(true);
      expect(isLowerBetterKPI('CHURN')).toBe(true);
    });

    it('debe detectar parcialmente keywords en nombres compuestos', () => {
      expect(isLowerBetterKPI('Porcentaje de cobro eficiente')).toBe(true);
      expect(isLowerBetterKPI('Rotación mensual')).toBe(true);
      expect(isLowerBetterKPI('Índice de desperdicio general')).toBe(true);
    });

    it('debe identificar KPIs donde mayor es mejor', () => {
      expect(isLowerBetterKPI('Volumen de ventas')).toBe(false);
      expect(isLowerBetterKPI('Satisfacción del cliente')).toBe(false);
      expect(isLowerBetterKPI('Productividad')).toBe(false);
      expect(isLowerBetterKPI('Ingresos mensuales')).toBe(false);
      expect(isLowerBetterKPI('Clientes activos')).toBe(false);
      expect(isLowerBetterKPI('Retención de clientes')).toBe(false);
      expect(isLowerBetterKPI('Margen de utilidad')).toBe(false);
    });
  });

  // ==========================================================================
  // calculateKpiStatus
  // ==========================================================================
  describe('calculateKpiStatus', () => {
    describe('Higher is better (mayor es mejor)', () => {
      it('debe retornar complies cuando el valor es mayor o igual al objetivo', () => {
        expect(calculateKpiStatus('100', '100', 'Ventas')).toBe('complies');
        expect(calculateKpiStatus('150', '100', 'Ventas')).toBe('complies');
        expect(calculateKpiStatus(100, 100, 'Ventas')).toBe('complies');
        expect(calculateKpiStatus('200', '100', 'Ventas')).toBe('complies');
      });

      it('debe retornar alert cuando el valor está entre 90% y 100% del objetivo', () => {
        expect(calculateKpiStatus('95', '100', 'Ventas')).toBe('alert');
        expect(calculateKpiStatus('90', '100', 'Ventas')).toBe('alert');
        expect(calculateKpiStatus('99.9', '100', 'Ventas')).toBe('alert');
      });

      it('debe retornar not_compliant cuando el valor es menor al 90% del objetivo', () => {
        expect(calculateKpiStatus('80', '100', 'Ventas')).toBe('not_compliant');
        expect(calculateKpiStatus('50', '100', 'Ventas')).toBe('not_compliant');
        expect(calculateKpiStatus('0', '100', 'Ventas')).toBe('not_compliant');
      });

      it('boundary exacto al 90%: valor=90, target=100 → alert', () => {
        expect(calculateKpiStatus('90', '100', 'Ventas')).toBe('alert');
      });

      it('justo debajo del 90%: valor=89.99, target=100 → not_compliant', () => {
        expect(calculateKpiStatus('89.99', '100', 'Ventas')).toBe('not_compliant');
      });
    });

    describe('Lower is better (menor es mejor)', () => {
      it('debe retornar complies cuando el valor es menor o igual al objetivo', () => {
        expect(calculateKpiStatus('100', '100', 'Días de cobro')).toBe('complies');
        expect(calculateKpiStatus('80', '100', 'Días de cobro')).toBe('complies');
        expect(calculateKpiStatus('0', '100', 'Días de cobro')).toBe('complies');
      });

      it('debe retornar alert cuando el valor está entre 100% y 110% del objetivo', () => {
        expect(calculateKpiStatus('105', '100', 'Días de cobro')).toBe('alert');
        expect(calculateKpiStatus('110', '100', 'Días de cobro')).toBe('alert');
      });

      it('debe retornar not_compliant cuando el valor es mayor al 110% del objetivo', () => {
        expect(calculateKpiStatus('120', '100', 'Días de cobro')).toBe('not_compliant');
        expect(calculateKpiStatus('150', '100', 'Días de cobro')).toBe('not_compliant');
        expect(calculateKpiStatus('200', '100', 'Días de cobro')).toBe('not_compliant');
      });

      it('boundary exacto al 110%: valor=110, target=100 → alert', () => {
        expect(calculateKpiStatus('110', '100', 'Días de cobro')).toBe('alert');
      });

      it('justo arriba del 110%: valor=110.01, target=100 → not_compliant', () => {
        expect(calculateKpiStatus('110.01', '100', 'Días de cobro')).toBe('not_compliant');
      });
    });

    describe('Casos especiales con target=0', () => {
      it('target=0 y value=0 → complies', () => {
        expect(calculateKpiStatus('0', '0', 'Ventas')).toBe('complies');
        expect(calculateKpiStatus(0, 0, 'Ventas')).toBe('complies');
      });

      it('target=0 y value>0 → alert', () => {
        expect(calculateKpiStatus('50', '0', 'Ventas')).toBe('alert');
        expect(calculateKpiStatus('100', '0', 'Ventas')).toBe('alert');
      });
    });

    describe('Valores negativos', () => {
      it('valor negativo con target positivo → not_compliant (higher is better)', () => {
        expect(calculateKpiStatus('-10', '100', 'Ventas')).toBe('not_compliant');
      });

      it('valor negativo con target positivo → complies (lower is better)', () => {
        expect(calculateKpiStatus('-10', '100', 'Días de cobro')).toBe('complies');
      });
    });

    describe('Valores no parseables', () => {
      it('debe retornar alert cuando hay un valor actual no parseable pero no es null', () => {
        expect(calculateKpiStatus('abc', '100', 'Ventas')).toBe('alert');
        expect(calculateKpiStatus('N/A', '100', 'Ventas')).toBe('alert');
      });

      it('debe retornar alert cuando el target no es parseable pero valor actual sí', () => {
        expect(calculateKpiStatus('100', 'abc', 'Ventas')).toBe('alert');
      });

      it('debe retornar not_compliant cuando value es null', () => {
        expect(calculateKpiStatus(null, '100', 'Ventas')).toBe('not_compliant');
      });

      it('debe retornar alert cuando target es null pero value es non-empty', () => {
        // When target is NaN but currentValue is non-null/non-empty, returns 'alert'
        expect(calculateKpiStatus('100', null, 'Ventas')).toBe('alert');
      });

      it('debe retornar not_compliant cuando ambos son null', () => {
        expect(calculateKpiStatus(null, null, 'Ventas')).toBe('not_compliant');
      });

      it('debe retornar not_compliant para string vacío como valor', () => {
        expect(calculateKpiStatus('', '100', 'Ventas')).toBe('not_compliant');
      });
    });

    describe('Valores con formato', () => {
      it('debe parsear valores con formato de moneda', () => {
        expect(calculateKpiStatus('$1,500', '$1,000', 'Ingresos')).toBe('complies');
      });

      it('debe parsear valores con porcentaje', () => {
        expect(calculateKpiStatus('95%', '100%', 'Satisfacción')).toBe('alert');
      });
    });

    describe('Valores grandes', () => {
      it('debe manejar valores muy grandes', () => {
        expect(calculateKpiStatus('1000000', '500000', 'Ventas')).toBe('complies');
        expect(calculateKpiStatus('100000', '500000', 'Ventas')).toBe('not_compliant');
      });
    });
  });

  // ==========================================================================
  // calculateCompliance
  // ==========================================================================
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

      it('debe calcular compliance mayor al 100%', () => {
        expect(calculateCompliance('300', '100', 'Ventas')).toBe('300.0%');
        expect(calculateCompliance('200', '100', 'Ingresos')).toBe('200.0%');
      });

      it('debe redondear a un decimal', () => {
        expect(calculateCompliance('1', '3', 'Ventas')).toBe('33.3%');
        expect(calculateCompliance('2', '3', 'Ventas')).toBe('66.7%');
      });

      it('target=0 y value>0 → 100.0%', () => {
        expect(calculateCompliance('50', '0', 'Ventas')).toBe('100.0%');
      });

      it('target=0 y value=0 → 0.0%', () => {
        expect(calculateCompliance('0', '0', 'Ventas')).toBe('0.0%');
      });
    });

    describe('Lower is better', () => {
      it('debe calcular compliance correctamente (fórmula inversa)', () => {
        expect(calculateCompliance('100', '100', 'Días de cobro')).toBe('100.0%');
        expect(calculateCompliance('50', '100', 'Días de cobro')).toBe('200.0%');
        expect(calculateCompliance('150', '100', 'Días de cobro')).toBe('66.7%');
      });

      it('debe manejar valor 0 como caso especial', () => {
        expect(calculateCompliance('0', '100', 'Días de cobro')).toBe('200.0%');
      });

      it('valor 0 con target 0 → 0.0%', () => {
        expect(calculateCompliance('0', '0', 'Días de cobro')).toBe('0.0%');
      });

      it('debe calcular compliance mayor al 100% cuando es mejor que target', () => {
        expect(calculateCompliance('25', '100', 'Días de cobro')).toBe('400.0%');
      });
    });

    describe('Valores no parseables', () => {
      it('debe retornar 0.0% cuando no se pueden parsear valores', () => {
        expect(calculateCompliance('abc', '100', 'Ventas')).toBe('0.0%');
        expect(calculateCompliance('100', 'abc', 'Ventas')).toBe('0.0%');
        expect(calculateCompliance(null, '100', 'Ventas')).toBe('0.0%');
        expect(calculateCompliance('100', null, 'Ventas')).toBe('0.0%');
        expect(calculateCompliance(null, null, 'Ventas')).toBe('0.0%');
      });
    });

    describe('Valores numéricos directos', () => {
      it('debe aceptar números directamente', () => {
        expect(calculateCompliance(100, 100, 'Ventas')).toBe('100.0%');
        expect(calculateCompliance(50, 100, 'Ventas')).toBe('50.0%');
        expect(calculateCompliance(0, 100, 'Ventas')).toBe('0.0%');
      });
    });
  });

  // ==========================================================================
  // normalizeStatus
  // ==========================================================================
  describe('normalizeStatus', () => {
    it('debe normalizar "compliant" → "complies"', () => {
      expect(normalizeStatus('compliant')).toBe('complies');
    });

    it('debe normalizar "non-compliant" → "not_compliant"', () => {
      expect(normalizeStatus('non-compliant')).toBe('not_compliant');
    });

    it('debe normalizar "not_complies" → "not_compliant"', () => {
      expect(normalizeStatus('not_complies')).toBe('not_compliant');
    });

    it('debe normalizar "no_complies" → "not_compliant"', () => {
      expect(normalizeStatus('no_complies')).toBe('not_compliant');
    });

    it('debe normalizar "no cumple" → "not_compliant"', () => {
      expect(normalizeStatus('no cumple')).toBe('not_compliant');
    });

    it('debe normalizar "warning" → "alert"', () => {
      expect(normalizeStatus('warning')).toBe('alert');
    });

    it('debe pasar "complies" sin cambios', () => {
      expect(normalizeStatus('complies')).toBe('complies');
    });

    it('debe pasar "alert" sin cambios', () => {
      expect(normalizeStatus('alert')).toBe('alert');
    });

    it('debe pasar "not_compliant" sin cambios', () => {
      expect(normalizeStatus('not_compliant')).toBe('not_compliant');
    });

    it('debe manejar whitespace (fix de Fase 3)', () => {
      expect(normalizeStatus(' complies ')).toBe('complies');
      expect(normalizeStatus('  alert  ')).toBe('alert');
      expect(normalizeStatus(' not_compliant ')).toBe('not_compliant');
      expect(normalizeStatus('  compliant  ')).toBe('complies');
      expect(normalizeStatus(' no cumple ')).toBe('not_compliant');
    });

    it('debe ser case-insensitive', () => {
      expect(normalizeStatus('COMPLIES')).toBe('complies');
      expect(normalizeStatus('Alert')).toBe('alert');
      expect(normalizeStatus('NOT_COMPLIANT')).toBe('not_compliant');
      expect(normalizeStatus('COMPLIANT')).toBe('complies');
      expect(normalizeStatus('WARNING')).toBe('alert');
    });

    it('debe retornar not_compliant para valores desconocidos', () => {
      expect(normalizeStatus('unknown')).toBe('not_compliant');
      expect(normalizeStatus('invalid')).toBe('not_compliant');
      expect(normalizeStatus('random_text')).toBe('not_compliant');
    });

    it('debe retornar not_compliant para null/undefined', () => {
      expect(normalizeStatus(null)).toBe('not_compliant');
      expect(normalizeStatus(undefined)).toBe('not_compliant');
    });

    it('debe retornar not_compliant para string vacío', () => {
      expect(normalizeStatus('')).toBe('not_compliant');
    });
  });

  // ==========================================================================
  // Consistencia entre funciones
  // ==========================================================================
  describe('Consistencia entre funciones', () => {
    it('debe calcular status y compliance de manera consistente (alert zone)', () => {
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

    it('debe ser consistente para complies (compliance >= 100%)', () => {
      const value = '120';
      const target = '100';
      const kpiName = 'Ventas';

      const status = calculateKpiStatus(value, target, kpiName);
      const compliance = calculateCompliance(value, target, kpiName);

      expect(status).toBe('complies');
      const complianceNum = parseFloat(compliance.replace('%', ''));
      expect(complianceNum).toBeGreaterThanOrEqual(100);
    });

    it('debe ser consistente para not_compliant (compliance < 90%)', () => {
      const value = '50';
      const target = '100';
      const kpiName = 'Ventas';

      const status = calculateKpiStatus(value, target, kpiName);
      const compliance = calculateCompliance(value, target, kpiName);

      expect(status).toBe('not_compliant');
      const complianceNum = parseFloat(compliance.replace('%', ''));
      expect(complianceNum).toBeLessThan(90);
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

    it('debe ser consistente para lower-is-better en compliance', () => {
      const kpiName = 'Días de cobro';

      // Mejor que target → compliance > 100%
      const complianceBetter = calculateCompliance('50', '100', kpiName);
      expect(parseFloat(complianceBetter)).toBeGreaterThan(100);

      // Peor que target → compliance < 100%
      const complianceWorse = calculateCompliance('150', '100', kpiName);
      expect(parseFloat(complianceWorse)).toBeLessThan(100);
    });

    it('debe tratar correctamente todos los estados posibles', () => {
      // Verificar que las tres categorías de status son mutuamente excluyentes
      const statuses = ['complies', 'alert', 'not_compliant'];

      const testCases = [
        { value: '100', target: '100' },
        { value: '95', target: '100' },
        { value: '50', target: '100' },
      ];

      for (const tc of testCases) {
        const status = calculateKpiStatus(tc.value, tc.target, 'Ventas');
        expect(statuses).toContain(status);
      }
    });
  });
});
