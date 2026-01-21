/**
 * Sidebar - Estilo Notion
 * Minimalista, limpio, con buscador inteligente integrado
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
// AIAssistant removed - using EcoNovaAssistant from App.tsx instead
import {
  LayoutDashboard,
  Menu,
  LogOut,
  Truck,
  TrendingUp,
  Settings,
  Wallet,
  ChevronDown,
  ChevronRight,
  Receipt,
  DollarSign,
  ShoppingCart,
  Building,
  Search,
  X,
  Sparkles
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
  indent?: boolean;
}

const NavItem = ({
  href,
  icon,
  children,
  className,
  active,
  onClick,
  indent = false
}: NavItemProps) => {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation(href);
    if (onClick) onClick();
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-all duration-150",
        indent && "ml-4",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
};

function Sidebar() {
  const [location] = useLocation();
  const { user, isAdmin, hasLogisticsAccess, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<number>(() => {
    const storedCompany = localStorage.getItem('selectedCompanyId');
    return storedCompany ? Number(storedCompany) : 1;
  });
  const [isTreasuryOpen, setIsTreasuryOpen] = useState(
    location === "/treasury" || location.startsWith("/treasury/")
  );
  const [isSalesOpen, setIsSalesOpen] = useState(
    location === "/sales" || location.startsWith("/sales/")
  );

  // Auto-expandir cuando se navega a una ruta
  useEffect(() => {
    if (location === "/treasury" || location.startsWith("/treasury/")) {
      setIsTreasuryOpen(true);
    }
    if (location === "/sales" || location.startsWith("/sales/")) {
      setIsSalesOpen(true);
    }
  }, [location]);

  // Keyboard shortcut (Cmd+K) handled by EcoNovaAssistant

  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleLogout = () => {
    logout();
  };

  const closeMenu = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-3 left-3 z-[1000]">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 bg-background border shadow-sm"
          onClick={toggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col w-60 bg-background border-r border-border z-[1001] h-screen transition-transform duration-200",
          isMobileOpen
            ? "fixed inset-y-0 left-0 translate-x-0"
            : "fixed inset-y-0 left-0 -translate-x-full lg:translate-x-0"
        )}
      >
        {/* Close button for mobile */}
        {isMobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 lg:hidden"
            onClick={closeMenu}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Search Button - Notion style */}
        <div className="p-3 border-b border-border">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-econova'))}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground rounded-md border border-border/50 bg-muted/30 hover:bg-muted hover:text-foreground transition-all"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <p className="text-[11px] text-muted-foreground/70 mt-2 px-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Pregunta lo que quieras sobre tus datos
          </p>
        </div>

        {/* Company Selector compacto */}
        <div className="px-3 py-3 border-b border-border">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-1">
              Empresa
            </p>
            <div className="flex gap-1.5 p-1 rounded-lg bg-muted/30 border border-border/60">
              <button
                onClick={() => {
                  const companyId = 1;
                  localStorage.setItem('selectedCompanyId', String(companyId));
                  setSelectedCompany(companyId);
                  window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId } }));
                }}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all",
                  selectedCompany === 1
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                DURA
              </button>
              <button
                onClick={() => {
                  const companyId = 2;
                  localStorage.setItem('selectedCompanyId', String(companyId));
                  setSelectedCompany(companyId);
                  window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId } }));
                }}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all",
                  selectedCompany === 2
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                ORSEGA
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {/* Main Section */}
          <p className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            Principal
          </p>

          <NavItem
            href="/"
            icon={<LayoutDashboard className="h-4 w-4" />}
            active={location === "/"}
            onClick={closeMenu}
          >
            Dashboard
          </NavItem>

          {/* Ventas */}
          <Collapsible open={isSalesOpen} onOpenChange={setIsSalesOpen}>
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-all duration-150",
                  location.startsWith("/sales")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>Ventas</span>
                </div>
                {isSalesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              <NavItem
                href="/sales/dura"
                icon={<Building className={cn("h-4 w-4", location === "/sales/dura" && "text-green-500")} />}
                active={location === "/sales/dura"}
                onClick={closeMenu}
                indent
                className={location === "/sales/dura" ? "!bg-green-500/10 !text-green-600" : ""}
              >
                DURA International
              </NavItem>
              <NavItem
                href="/sales/orsega"
                icon={<Building className={cn("h-4 w-4", location === "/sales/orsega" && "text-purple-500")} />}
                active={location === "/sales/orsega"}
                onClick={closeMenu}
                indent
                className={location === "/sales/orsega" ? "!bg-purple-500/10 !text-purple-600" : ""}
              >
                Grupo ORSEGA
              </NavItem>
            </CollapsibleContent>
          </Collapsible>

          {/* Tesorería */}
          <Collapsible open={isTreasuryOpen} onOpenChange={setIsTreasuryOpen}>
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-all duration-150",
                  location.startsWith("/treasury")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span>Tesorería</span>
                </div>
                {isTreasuryOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              <NavItem
                href="/treasury/vouchers"
                icon={<Receipt className="h-4 w-4" />}
                active={location === "/treasury/vouchers" || location === "/treasury"}
                onClick={closeMenu}
                indent
              >
                Comprobantes
              </NavItem>
              <NavItem
                href="/treasury/exchange-rates"
                icon={<DollarSign className="h-4 w-4" />}
                active={location === "/treasury/exchange-rates"}
                onClick={closeMenu}
                indent
              >
                Tipos de Cambio
              </NavItem>
            </CollapsibleContent>
          </Collapsible>

          {/* Módulo de Logística */}
          {hasLogisticsAccess && (
            <NavItem
              href="/logistics"
              icon={<Truck className="h-4 w-4" />}
              active={location === "/logistics" || location.includes("/logistics/")}
              onClick={closeMenu}
            >
              Logística
            </NavItem>
          )}

          {/* Centro de Control */}
          <NavItem
            href="/kpi-control"
            icon={<TrendingUp className="h-4 w-4" />}
            active={location === "/kpi-control"}
            onClick={closeMenu}
          >
            Centro de Control
          </NavItem>

          {/* Admin */}
          {isAdmin && (
            <>
              <div className="my-3 border-t border-border" />
              <p className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                Sistema
              </p>
              <NavItem
                href="/system-admin"
                icon={<Settings className="h-4 w-4" />}
                active={location === "/system-admin"}
                onClick={closeMenu}
              >
                Administración
              </NavItem>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground rounded-md hover:bg-red-500/10 hover:text-red-600 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* AI Assistant handled by EcoNovaAssistant in App.tsx */}
    </>
  );
}

export default Sidebar;
