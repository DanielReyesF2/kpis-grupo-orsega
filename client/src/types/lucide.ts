import type { SVGProps } from "react";

/** Tipo para iconos de lucide-react cuando el paquete no expone tipos. */
export type LucideIcon = React.ComponentType<
  SVGProps<SVGSVGElement> & { size?: number; color?: string; strokeWidth?: number }
>;
