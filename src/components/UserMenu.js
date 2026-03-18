import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronDown, LogOut, Shield } from 'lucide-react';

const UserMenu = ({ onOpenAdmin }) => {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const handleAdminClick = () => {
    onOpenAdmin();
  };

  const initials = user?.username?.charAt(0).toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[100px] truncate font-medium">{user?.username}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground">{user?.username}</p>
          <p className="text-xs text-muted-foreground">
            {user?.role === 'admin' ? 'Administrator' : 'Employee'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        {isAdmin() && (
          <DropdownMenuItem onClick={handleAdminClick} className="gap-2 cursor-pointer">
            <Shield className="h-4 w-4" />
            Admin Panel
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={handleLogout}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
