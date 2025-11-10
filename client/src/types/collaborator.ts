// Types for Collaborator Performance Data

export interface HistoricalComplianceData {
  month: string; // YYYY-MM format
  compliance: number | null; // Average compliance percentage for that month
}

export interface AdvancedTrend {
  direction: 'up' | 'down' | 'stable' | null;
  strength: number; // 0-100, how strong the trend is
  slope: number; // slope of the linear regression
  r2: number; // coefficient of determination (0-1)
}

export interface CollaboratorKpi {
  id: number;
  name: string;
  description?: string | null;
  unit?: string | null;
  frequency?: string | null;
  target?: string | null;
  goal?: string | null;
  responsible?: string | null;
  area?: string | null;
  companyId: number;
  latestValue: any;
  previousValue: any;
  compliance: number;
  complianceChange: number | null;
  trendDirection: 'up' | 'down' | 'stable' | null;
  status: 'complies' | 'alert' | 'not_compliant';
  lastUpdate: string | null;
}

export interface CollaboratorPerformance {
  name: string;
  score: number; // 0-100
  status: 'excellent' | 'good' | 'regular' | 'critical';
  averageCompliance: number;
  compliantKpis: number;
  alertKpis: number;
  notCompliantKpis: number;
  totalKpis: number;
  lastUpdate: string | null;
  scoreChange: number | null;
  scoreChangePeriod: string | null;
  trendDirection: 'up' | 'down' | 'stable' | null;
  kpis: CollaboratorKpi[];
  historicalCompliance: HistoricalComplianceData[];
  advancedTrend: AdvancedTrend;
}

export interface CollaboratorPerformanceResponse {
  collaborators: CollaboratorPerformance[];
  teamAverage: number;
  teamTrend: number | null;
  teamTrendDirection: 'up' | 'down' | 'stable' | null;
  teamTrendPeriod: string | null;
}
