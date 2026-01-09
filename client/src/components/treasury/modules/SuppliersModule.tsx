import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Building2, Plus } from "lucide-react";

interface Supplier {
  id: string | number;
  name: string;
  short_name?: string;
  requires_rep?: boolean;
  created_at?: string;
}

interface SuppliersModuleProps {
  suppliers?: Supplier[];
  isLoading?: boolean;
  onCreateSupplier?: () => void;
}

function SuppliersSkeleton() {
  return (
    <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
      <CardContent className="p-6 space-y-5">
        <Skeleton className="h-6 w-48 bg-surface-muted/70" />
        <Skeleton className="h-14 w-full bg-surface-muted/70 rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-8 w-24 rounded-full bg-surface-muted/70" />
          <Skeleton className="h-8 w-24 rounded-full bg-surface-muted/70" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-16 rounded-lg bg-surface-muted/70"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SuppliersModule({
  suppliers: injectedSuppliers,
  isLoading: injectedLoading,
  onCreateSupplier,
}: SuppliersModuleProps) {
  const { data, isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !injectedSuppliers,
  });

  const suppliers = injectedSuppliers ?? data ?? [];
  const loading = injectedLoading ?? isLoading;

  const stats = useMemo(() => {
    const repActive = suppliers.filter((supplier) => supplier.requires_rep).length;
    const repInactive = suppliers.length - repActive;
    const recent = [...suppliers]
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      )
      .slice(0, 5);

    return {
      total: suppliers.length,
      repActive,
      repInactive,
      recent,
    };
  }, [suppliers]);

  const handleNewSupplier = () => {
    if (onCreateSupplier) {
      onCreateSupplier();
    }
  };

  if (loading) {
    return <SuppliersSkeleton />;
  }

  if (!suppliers.length) {
    return (
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-4 text-center text-gray-900 dark:text-white">
          <div className="w-16 h-16 rounded-full bg-pastel-violet/20 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-pastel-violet" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Sin proveedores registrados</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Registra tus proveedores para activar recordatorios REP y seguimiento automático.
          </p>
          <Button
            className="bg-pastel-violet/80 text-white hover:bg-pastel-violet transition-colors"
            onClick={handleNewSupplier}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo proveedor
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
        <CardHeader className="flex flex-col gap-4 border-b border-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Red de proveedores
              </p>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">Proveedores</h3>
            </div>
            <Button
              size="sm"
              className="bg-pastel-violet/80 text-white hover:bg-pastel-violet transition-colors"
              onClick={handleNewSupplier}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo proveedor
            </Button>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-pastel-violet/15 via-transparent to-transparent p-4">
            <p className="text-sm text-gray-600 dark:text-white/80">Total registrados</p>
            <p className="text-4xl font-semibold text-gray-900 dark:text-white tracking-tight mt-2">
              {stats.total}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-pastel-green/80 text-white px-3 py-1.5 rounded-full">
              REP activo: {stats.repActive}
            </Badge>
            <Badge className="bg-surface-muted/80 text-white px-3 py-1.5 rounded-full">
              REP inactivo: {stats.repInactive}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Proveedores recientes
          </p>
          <div className="space-y-3">
            {stats.recent.map((supplier) => {
              const initials = supplier.name
                .split(" ")
                .map((word) => word.charAt(0))
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-muted/60 px-4 py-3 text-gray-900 dark:text-white"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 bg-pastel-violet/30 text-gray-900 dark:text-white">
                      <AvatarFallback className="bg-pastel-violet/40 text-gray-900 dark:text-white">
                        {initials || "PR"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{supplier.name}</p>
                      {supplier.short_name && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {supplier.short_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={
                      supplier.requires_rep
                        ? "bg-pastel-green/80 text-white"
                        : "bg-surface-muted/80 text-white"
                    }
                  >
                    {supplier.requires_rep ? "REP activo" : "REP inactivo"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

