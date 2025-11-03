import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart2, Award, ArrowUp } from 'lucide-react';

interface SalesMetricsCardsProps {
  companyId: number;
}

export function SalesMetricsCards({ companyId }: SalesMetricsCardsProps) {
  // Estado para los objetivos anuales (derivados del objetivo mensual del KPI)
  const [annualTargets, setAnnualTargets] = useState({
    dura: 667449, // fallback: 55,620 * 12
    orsega: 10300476 // fallback: 858,373 * 12
  });

  // Buscar el KPI de Volumen de Ventas por nombre
  const { data: allKpis } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId }],
    staleTime: 5 * 60 * 1000,
  });

  const salesKpi = allKpis?.find((kpi: any) => {
    const name = (kpi.kpiName || kpi.name || '').toLowerCase();
    return (name.includes('volumen') && name.includes('ventas')) || 
           name.includes('ventas') || 
           name.includes('sales');
  });
  
  // Cuando llegue la metadata del KPI, derivar el objetivo anual desde "goal" (objetivo mensual)
  useEffect(() => {
    // Si hay KPI y trae goal numérico, usamos goal * 12; fallback a valores por defecto
    const monthlyGoal = salesKpi?.goal != null
      ? parseFloat(String(salesKpi.goal).toString().replace(/[^0-9.-]+/g, ''))
      : undefined;

    if (!isNaN(monthlyGoal as number) && monthlyGoal! > 0) {
      setAnnualTargets(prev => ({
        ...prev,
        [companyId === 1 ? 'dura' : 'orsega']: Math.round((monthlyGoal as number) * 12)
      }));
    }
  }, [salesKpi, companyId]);

  const kpiId = salesKpi?.id || (companyId === 1 ? 39 : 1);

  // Cargar datos históricos
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12 }],
    refetchInterval: 30000,
    enabled: !!kpiId && kpiId > 0,
  });

  // Procesar datos (YTD: solo meses del año en curso)
  const salesData = useMemo(() => {
    if (!kpiHistory || kpiHistory.length === 0) {
      console.log(`[SalesMetricsCards] KPI History vacío para Company ${companyId}`);
      return [];
    }
    
    console.log(`[SalesMetricsCards] Procesando ${kpiHistory.length} registros de historial para Company ${companyId}`);
    
    // Aceptar mayúsculas y minúsculas en nombres de meses (igual que en la gráfica)
    const monthOrder: { [key: string]: number } = {
      'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
      'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
      'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12,
      'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
      'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
      'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    };
    
    const currentYear = new Date().getFullYear();

    const filtered = kpiHistory.filter((item: any) => {
      // Intentar obtener el año de distintas formas
      const period = String(item.period || '');
      const parts = period.split(' ');
      let year = parseInt(parts[1], 10);

      if (isNaN(year)) {
        const match = period.match(/(20\d{2})/);
        if (match) year = parseInt(match[1], 10);
      }
      if (isNaN(year) && item.year) {
        year = parseInt(String(item.year), 10);
      }
      if (isNaN(year) && item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) year = d.getFullYear();
      }

      return !isNaN(year) && year === currentYear;
    });
    
    console.log(`[SalesMetricsCards] Filtrados por año ${currentYear}: ${filtered.length} registros`);

    const sortedHistory = [...filtered].sort((a: any, b: any) => {
      const monthA = (a.period || '').split(' ')[0];
      const monthB = (b.period || '').split(' ')[0];
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });
    
    const processed = sortedHistory.map((item: any) => {
      const rawValue = String(item.value);
      const parsed = parseFloat(rawValue.replace(/[^0-9.-]+/g, '')) || 0;
      
      // Log para debugging de valores sospechosos
      if (parsed > 1000000) {
        console.warn(`[SalesMetricsCards] ⚠️ Valor sospechosamente alto detectado:`, {
          raw: rawValue,
          parsed,
          period: item.period,
          kpiId: item.kpiId
        });
      }
      
      return { sales: parsed, period: item.period };
    });
    
    return processed;
  }, [kpiHistory]);

  // Volumen total del año (YTD)
  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  
  // Log del total calculado para debugging
  console.log(`[SalesMetricsCards] Company ${companyId}: Total YTD = ${totalSales.toLocaleString()}, Registros procesados = ${salesData.length}`);

  // Objetivo anual derivado desde DB (goal mensual * 12) con fallback
  const monthlyGoalFromDb = salesKpi?.goal != null
    ? parseFloat(String(salesKpi.goal).toString().replace(/[^0-9.-]+/g, ''))
    : undefined;

  const derivedAnnualTarget = !isNaN(monthlyGoalFromDb as number) && monthlyGoalFromDb! > 0
    ? Math.round((monthlyGoalFromDb as number) * 12)
    : (companyId === 1 ? annualTargets.dura : annualTargets.orsega);

  const totalTarget = derivedAnnualTarget;
  const compliancePercentage = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 100) : 0;

  const getGrowthRate = () => {
    if (salesData.length < 2) return '0.0';
    const lastMonth = salesData[salesData.length - 1].sales;
    const previousMonth = salesData[salesData.length - 2].sales;
    if (previousMonth === 0) return '0.0';
    const growthRate = ((lastMonth - previousMonth) / previousMonth) * 100;
    return growthRate.toFixed(1);
  };

  const growthRate = getGrowthRate();

  const formatNumber = (value: number) => {
    if (companyId === 1) {
      return new Intl.NumberFormat('es-MX').format(value) + " KG";
    } else {
      return new Intl.NumberFormat('es-MX').format(value) + " unidades";
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {/* Volumen Total */}
      <Card className="border border-border/60 bg-card shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1 font-medium">Volumen Total</p>
              <p className="text-lg font-bold mb-2 text-foreground">
                {formatNumber(totalSales)}
              </p>
              <div className="flex items-center text-success mb-3">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span className="text-xs font-medium">{growthRate}% vs mes anterior</span>
              </div>
              <div className="text-xs text-primary mb-2 flex justify-between">
                <span>Progreso</span>
                <span className="font-medium">{compliancePercentage}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                ></div>
              </div>
            </div>
            <div className="p-3 bg-primary/15 rounded-full ml-4 text-primary">
              <BarChart2 className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avance del Objetivo Anual */}
      <Card className="border border-border/60 bg-card shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1 font-medium">Avance del Objetivo Anual</p>
              <div className="flex items-center mb-2">
                <p className="text-lg font-bold text-foreground">
                  {compliancePercentage}%
                </p>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {compliancePercentage >= 100 ? '¡Meta cumplida!' : 
                   compliancePercentage >= 75 ? 'Buen progreso' :
                   compliancePercentage >= 50 ? 'Progreso medio' : 'Requiere atención'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                <span className="font-medium text-foreground">Ventas: {formatNumber(totalSales)}</span> / <span>{formatNumber(totalTarget)}</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    compliancePercentage >= 100 ? 'bg-green-400/60' : 'bg-amber-400/60'
                  } text-gray-700`}
                  style={{ width: `${compliancePercentage > 100 ? 100 : compliancePercentage}%` }}
                ></div>
              </div>
            </div>
            <div className="p-3 bg-amber-50/30 rounded-full ml-4 text-amber-600/70">
              <Award className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
