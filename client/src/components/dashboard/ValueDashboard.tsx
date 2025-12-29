import { devLog } from "@/lib/logger";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ValueMetrics {
  kpisGenerated: number;
  shipmentsProcessed: number;
  paymentsAutomated: number;
  estimatedTimeSaved: {
    kpis: number;
    shipments: number;
    payments: number;
  };
  monthlyValue: {
    timeSavings: number;
    errorReduction: number;
    fasterDecisions: number;
    total: number;
  };
  roi: {
    monthly: number;
    yearly: number;
    paybackPeriod: string;
  };
  systemHealth: string;
  uptime: number;
}

export function ValueDashboard() {
  const [metrics, setMetrics] = useState<ValueMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchValueMetrics();
  }, []);

  const fetchValueMetrics = async () => {
    try {
      const response = await fetch('/api/metrics/value');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      devLog.error('Error fetching value metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando métricas de valor...</div>;
  if (!metrics) return <div>Error al cargar métricas</div>;

  const totalHoursSaved = Object.values(metrics.estimatedTimeSaved)
    .reduce((sum, hours) => sum + hours, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ROI Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">💰 ROI Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${metrics.monthlyValue.total.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              Valor generado este mes
            </p>
            <div className="mt-2">
              <Badge variant="outline" className="text-green-600">
                ROI: {metrics.roi.paybackPeriod}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Time Savings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">⏰ Tiempo Ahorrado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {totalHoursSaved.toFixed(1)}h
            </div>
            <p className="text-sm text-muted-foreground">
              Horas automatizadas este mes
            </p>
            <div className="mt-2">
              <Progress value={(totalHoursSaved / 160) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Equivalente a {Math.round(totalHoursSaved / 8)} días laborales
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Health Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">🏥 Salud del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {metrics.uptime.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">
              Disponibilidad del sistema
            </p>
            <div className="mt-2">
              <Badge 
                variant={metrics.systemHealth === 'Excellent' ? 'default' : 'secondary'}
                className={
                  metrics.systemHealth === 'Excellent' ? 'bg-green-500' : 
                  metrics.systemHealth === 'Good' ? 'bg-yellow-500' : 'bg-red-500'
                }
              >
                {metrics.systemHealth}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>📊 Procesos Automatizados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>KPIs Generados:</span>
              <span className="font-semibold">{metrics.kpisGenerated}</span>
            </div>
            <div className="flex justify-between">
              <span>Envíos Procesados:</span>
              <span className="font-semibold">{metrics.shipmentsProcessed}</span>
            </div>
            <div className="flex justify-between">
              <span>Pagos Automatizados:</span>
              <span className="font-semibold">{metrics.paymentsAutomated}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💵 Desglose de Valor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Ahorro de Tiempo:</span>
              <span className="font-semibold">${metrics.monthlyValue.timeSavings.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Reducción de Errores:</span>
              <span className="font-semibold">${metrics.monthlyValue.errorReduction.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Decisiones Más Rápidas:</span>
              <span className="font-semibold">${metrics.monthlyValue.fasterDecisions.toLocaleString()}</span>
            </div>
            <hr />
            <div className="flex justify-between font-bold text-lg">
              <span>Total Mensual:</span>
              <span className="text-green-600">${metrics.monthlyValue.total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
