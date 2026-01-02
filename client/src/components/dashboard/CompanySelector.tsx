/**
 * Company Selector - Selector premium tipo toggle para cambio de empresa
 * Diseño moderno con indicador animado y mejor UX
 */

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanySelectorProps {
  selectedCompany: number;
  onChange: (companyId: number) => void;
}

export function CompanySelector({ selectedCompany, onChange }: CompanySelectorProps) {
  const companies = [
    { 
      id: 1, 
      name: "DURA", 
      fullName: "Dura International",
      logo: "/logodura.jpg", 
      color: "green",
      gradient: "from-emerald-500 to-green-600",
      bgGradient: "from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20",
      borderColor: "border-emerald-500",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
    { 
      id: 2, 
      name: "ORSEGA", 
      fullName: "Grupo Orsega",
      logo: "/logo orsega.jpg", 
      color: "purple",
      gradient: "from-purple-500 to-violet-600",
      bgGradient: "from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20",
      borderColor: "border-purple-500",
      textColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  const activeCompany = companies.find(c => c.id === selectedCompany);
  const activeIndex = companies.findIndex(c => c.id === selectedCompany);

  return (
    <div className="relative inline-flex items-center gap-1 p-1.5 rounded-xl bg-card border-2 border-border/60 shadow-lg backdrop-blur-sm">
      {/* Indicador animado de fondo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCompany}
          initial={false}
          animate={{
            x: activeIndex * 100 + '%',
            width: 'calc(50% - 4px)',
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          className={cn(
            "absolute top-1.5 bottom-1.5 rounded-lg",
            `bg-gradient-to-r ${activeCompany?.gradient}`,
            "shadow-md"
          )}
          style={{
            left: '4px',
          }}
        />
      </AnimatePresence>

      {companies.map((company, index) => {
        const isActive = selectedCompany === company.id;

        return (
          <motion.button
            key={company.id}
            onClick={() => onChange(company.id)}
            className={cn(
              "relative z-10 flex items-center gap-2.5 px-5 py-2.5 rounded-lg",
              "text-sm font-semibold transition-all duration-300",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "min-w-[120px] justify-center",
              isActive
                ? "text-white shadow-sm"
                : cn(
                    "text-muted-foreground",
                    "hover:text-foreground hover:bg-muted/40",
                    "active:scale-95"
                  )
            )}
            whileHover={!isActive ? { scale: 1.05 } : {}}
            whileTap={{ scale: 0.95 }}
            aria-label={`Seleccionar ${company.name}`}
            aria-pressed={isActive}
          >
            {/* Logo con mejor presentación */}
            <div className={cn(
              "relative flex items-center justify-center",
              isActive ? "opacity-100" : "opacity-60"
            )}>
              <img
                src={company.logo}
                alt={company.name}
                className="h-6 w-auto object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
              {!document.querySelector(`img[alt="${company.name}"]`) && (
                <div className={cn(
                  "h-6 w-6 rounded flex items-center justify-center text-xs font-bold",
                  isActive ? "bg-white/20" : company.bgGradient
                )}>
                  {company.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Nombre de la empresa */}
            <span className="font-semibold tracking-tight">
              {company.name}
            </span>

            {/* Checkmark cuando está activo */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  className="ml-0.5"
                >
                  <Check className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
