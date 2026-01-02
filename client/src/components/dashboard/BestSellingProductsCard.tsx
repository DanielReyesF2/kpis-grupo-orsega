/**
 * Best Selling Products Card - Similar a Best Selling Product
 * Muestra productos destacados con imágenes y precios
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { ShoppingCart, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useState } from "react";

interface BestSellingProductsCardProps {
  companyId: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function BestSellingProductsCard({ companyId }: BestSellingProductsCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["/api/sales-top-products", companyId, "year"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales-top-products?companyId=${companyId}&period=year&limit=10`);
      return await res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const products = (topProducts || []).slice(0, 6).map((product: any, index: number) => ({
    name: product.name,
    volume: product.volume,
    originalPrice: product.volume * 15,
    discountedPrice: product.volume * 10,
    rating: 4,
    onSale: index < 2,
  }));

  const currentProduct = products[currentIndex];
  const nextProduct = () => setCurrentIndex((prev) => (prev + 1) % products.length);
  const prevProduct = () => setCurrentIndex((prev) => (prev - 1 + products.length) % products.length);

  if (!currentProduct) return null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Productos Más Vendidos</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={prevProduct}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={nextProduct}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Card */}
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-3"
        >
          {/* Product Image Placeholder */}
          <div className="relative h-40 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center">
            {currentProduct.onSale && (
              <Badge className="absolute top-2 right-2 bg-emerald-500">
                Oferta
              </Badge>
            )}
            <Package className="w-16 h-16 text-purple-600 dark:text-purple-400 opacity-50" />
          </div>

          {/* Product Info */}
          <div>
            <h3 className="font-semibold text-sm mb-2 line-clamp-2">
              {currentProduct.name}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(currentProduct.originalPrice)}
              </span>
              <span className="text-lg font-bold">
                {formatCurrency(currentProduct.discountedPrice)}
              </span>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < currentProduct.rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground"
                  )}
                />
              ))}
            </div>
            <Button className="w-full" size="sm">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Ver Detalles
            </Button>
          </div>
        </motion.div>

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1">
          {products.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

