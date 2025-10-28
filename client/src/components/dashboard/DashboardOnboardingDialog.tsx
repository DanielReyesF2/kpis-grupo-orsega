import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Building2, TrendingUp, Clock, DollarSign, ArrowRight, X } from 'lucide-react';

interface DashboardOnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const onboardingSteps = [
  {
    id: 1,
    title: 'Bienvenido al Panel de Control',
    description: 'Este es tu centro de mando donde verás las métricas más importantes de tu negocio en tiempo real.',
    icon: Building2,
    highlight: null,
  },
  {
    id: 2,
    title: 'Tipos de Cambio',
    description: 'Aquí encontrarás las cotizaciones actualizadas de Santander, MONEX y DOF. Estos datos se actualizan automáticamente y son fundamentales para tus decisiones financieras.',
    icon: DollarSign,
    highlight: 'exchange-rates',
  },
  {
    id: 3,
    title: 'KPIs y Métricas',
    description: 'Observa el cumplimiento de tus objetivos clave. Puedes filtrar por empresa, área o estado para ver exactamente lo que necesitas.',
    icon: TrendingUp,
    highlight: 'kpi-stats',
  },
  {
    id: 4,
    title: 'Reporte de Ventas',
    description: 'Visualiza el desempeño de ventas con gráficos interactivos y datos detallados. Puedes cambiar entre empresas usando el selector superior.',
    icon: Clock,
    highlight: 'sales-report',
  },
];

export function DashboardOnboardingDialog({ isOpen, onClose }: DashboardOnboardingDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = onboardingSteps.length;

  // Limpiar highlight cuando cambia el paso
  useEffect(() => {
    // Remover highlights previos
    document.querySelectorAll('[data-onboarding-highlight]').forEach((el) => {
      el.classList.remove('onboarding-highlight');
    });

    // Agregar highlight al elemento correspondiente
    const currentStepData = onboardingSteps.find((s) => s.id === currentStep);
    if (currentStepData?.highlight) {
      const targetElement = document.querySelector(`[data-onboarding="${currentStepData.highlight}"]`);
      if (targetElement) {
        targetElement.classList.add('onboarding-highlight');
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('dashboard_onboarding_completed', 'true');
    // Remover highlight
    document.querySelectorAll('[data-onboarding-highlight]').forEach((el) => {
      el.classList.remove('onboarding-highlight');
    });
    onClose();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const currentStepData = onboardingSteps.find((s) => s.id === currentStep);
  const Icon = currentStepData?.icon || Building2;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleComplete()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-xl font-bold">
              {currentStepData?.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-base">
            {currentStepData?.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 mb-4">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-[#273949] to-[#1a2a36] text-white">
              <Icon className="h-6 w-6" />
            </div>
          </div>
          
          <Progress value={(currentStep / totalSteps) * 100} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Paso {currentStep} de {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex-1"
          >
            Anterior
          </Button>
          {currentStep < totalSteps ? (
            <Button
              onClick={handleNext}
              className="flex-1 bg-[#273949] hover:bg-[#1a2a36]"
            >
              Siguiente
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              className="flex-1 bg-[#273949] hover:bg-[#1a2a36]"
            >
              Comenzar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


