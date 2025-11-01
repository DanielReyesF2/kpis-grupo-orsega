import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { OrsegaTitle } from "@/components/ui/OrsegaTitle";

export function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();


  const handleProfileClick = () => {
    navigate('/mi-perfil');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  // Generar iniciales del usuario
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  return (
    <header className="border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-4">
        </div>
        
        <div className="flex items-center space-x-3">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-blue-600 text-white">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">
                    {user.name.split(' ')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}