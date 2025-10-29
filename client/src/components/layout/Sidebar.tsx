import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { OrsegaTitle } from "@/components/ui/OrsegaTitle";
import { LogoOrsega } from "@/components/ui/LogoOrsega";
import {
  Building,
  LayoutDashboard,
  Menu,
  LogOut,
  Truck,
  TrendingUp,
  BarChart2,
  Crown,
  Users,
  Settings,
  Bell,
  User,
  Wallet
} from "lucide-react";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem = ({
  href,
  icon,
  children,
  className,
  active,
  onClick
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
        "flex items-center px-4 py-3 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200 group",
        active
          ? "bg-gradient-to-r from-[#b5e951]/20 to-[#b5e951]/10 text-white shadow-lg border-l-4 border-[#b5e951] scale-105"
          : "text-white/80 hover:bg-gradient-to-r hover:from-[#3a4d5d] hover:to-[#3a4d5d]/80 hover:text-white hover:scale-105 hover:shadow-md",
        className
      )}
    >
      {icon}
      <span className="transition-all duration-200">{children}</span>
    </div>
  );
};

function Sidebar() {
  const [location] = useLocation();
  const { user, isAdmin, isMarioOrAdmin, hasLogisticsAccess, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);


  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleLogout = () => {
    logout();
  };

  // Función para cerrar menú al navegar
  const closeMenu = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-2 left-2 z-[1000]">
        <Button
          variant="ghost"
          size="sm"
          className="p-2 text-primary bg-white dark:bg-primary-950 dark:text-white border shadow-sm hover:bg-secondary-50 dark:hover:bg-primary-900"
          onClick={toggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      {/* Sidebar */}
      <aside 
        className={cn(
          "lg:flex lg:flex-col w-64 bg-gradient-to-b from-[#1e3a5f] via-[#2a4a6f] to-[#1e3a5f] shadow-2xl z-[1001] h-screen overflow-y-auto transition-all duration-300",
          isMobileOpen ? "fixed inset-y-0 left-0 transform translate-x-0" : "fixed inset-y-0 left-0 transform -translate-x-full lg:translate-x-0"
        )}
        style={{ width: "250px" }}
      >
        {/* Botón para cerrar en móviles */}
        {isMobileOpen && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 text-white hover:bg-[#3a5a7f] lg:hidden"
            onClick={closeMenu}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </Button>
        )}

        <div className="px-4 py-6 border-b border-[#3a5a7f]/60 flex items-center justify-center from-[#0080ff]/10 to-[#0080ff]/5 backdrop-blur-sm bg-[#1e3a5f]">
          <div className="flex flex-shrink-0 items-center">
            <LogoOrsega height={55} showText={false} />
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          <div className="pb-3">
            <p className="px-4 text-xs uppercase tracking-wider text-white/60 font-semibold">
              Acciones Principales
            </p>
          </div>
          
          <NavItem
            href="/"
            icon={<LayoutDashboard className="mr-3 h-5 w-5 text-[#b5e951] group-hover:scale-110 transition-transform duration-200" />}
            active={location === "/"}
            onClick={closeMenu}
          >
            Dashboard
          </NavItem>

          <NavItem
            href="/kpi-control"
            icon={<TrendingUp className="mr-3 h-5 w-5 text-orange-400 group-hover:scale-110 transition-transform duration-200" />}
            active={location === "/kpi-control"}
            onClick={closeMenu}
            className="border border-orange-400/20 bg-gradient-to-r from-orange-400/10 to-yellow-400/10"
          >
            Centro de Control KPIs
          </NavItem>


          {/* Módulo de Logística - Solo para Mario, admin y Thalia (logística) */}
          {hasLogisticsAccess && (
            <NavItem
              href="/logistics"
              icon={<Truck className="mr-3 h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />}
              active={location === "/logistics" || location.includes("/logistics/")}
              onClick={closeMenu}
            >
              Módulo de Logística
            </NavItem>
          )}

          {/* Tesorería */}
          <NavItem
            href="/treasury"
            icon={<Wallet className="mr-3 h-5 w-5 text-yellow-400 group-hover:scale-110 transition-transform duration-200" />}
            active={location === "/treasury"}
            onClick={closeMenu}
          >
            Tesorería
          </NavItem>





        </nav>


      </aside>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 z-0 lg:hidden" 
          onClick={toggleMobileMenu}
        />
      )}
    </>
  );
}

export default Sidebar;
