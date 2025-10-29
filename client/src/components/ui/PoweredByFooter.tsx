import { LogoEconova } from "@/components/ui/LogoEconova";

interface PoweredByFooterProps {
  className?: string;
}

export function PoweredByFooter({ className = "" }: PoweredByFooterProps) {
  return (
    <div className={`flex items-center justify-center space-x-2 text-xs text-gray-400 py-2 ${className}`}>
      <span>Powered by</span>
      <LogoEconova height={16} />
    </div>
  );
}
