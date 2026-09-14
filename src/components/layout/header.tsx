"use client";

import { Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/actions/auth";
import type { SessionUser } from "@/types";
import Link from "next/link";
import { MobileSidebar } from "./mobile-sidebar";

interface HeaderProps {
  user: SessionUser;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3 sticky top-0 z-30">
      <MobileSidebar />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications — placeholder */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-8 px-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                {user.name ?? user.email}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium truncate">{user.name ?? user.email}</span>
                <span className="text-xs text-muted-foreground font-normal truncate">{user.email}</span>
                <span className="text-xs text-muted-foreground font-normal mt-0.5">{user.companyName}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => logoutAction()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
