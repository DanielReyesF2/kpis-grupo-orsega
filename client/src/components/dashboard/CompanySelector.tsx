/**
 * Company Selector - Selector elegante tipo toggle para cambio de empresa
 * Diseño moderno estilo segmented control
 */

import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanySelectorProps {
  selectedCompany: number;
  onChange: (companyId: number) => void;
}

export function CompanySelector({ selectedCompany, onChange }: CompanySelectorProps) {
  const companies = [
    { id: 1, name: "DURA", logo: "/logodura.jpg", color: "green" },
    { id: 2, name: "ORSEGA", logo: "/logo orsega.jpg", color: "purple" },
  ];

  return (
    <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/50 border border-border/60 backdrop-blur-sm">
      {companies.map((company) => {
        const isActive = selectedCompany === company.id;
        const isGreen = company.color === "green";

        return (
          <motion.button
            key={company.id}
            onClick={() => onChange(company.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              isActive
                ? isGreen
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-purple-600 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            aria-label={`Seleccionar ${company.name}`}
            aria-pressed={isActive}
          >
            {/* Logo pequeño */}
            <img
              src={company.logo}
              alt={company.name}
              className="h-5 w-auto object-contain opacity-90"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            <span className="font-semibold">{company.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
