"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Layers, 
  Settings, 
  Home,
  Terminal,
  FileCode,
  Database,
  LayoutDashboard
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  className?: string;
}

interface SidebarItem {
  name: string;
  icon: React.ReactNode;
  href: string;
  tooltip: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  
  const sidebarItems: SidebarItem[] = [
    {
      name: "Infrastructure",
      icon: <Layers className="h-5 w-5" />,
      href: "/dashboard",
      tooltip: "Infrastructure Groups",
    },
    {
      name: "Modules",
      icon: <FileCode className="h-5 w-5" />,
      href: "/modules",
      tooltip: "Terraform Modules",
    }
  ];
  
  return (
    <div className={cn("h-full w-[60px] border-r bg-background", className)}>
      <div className="flex flex-col items-center justify-between h-full py-4">
        <div className="flex flex-col items-center space-y-4">
          {sidebarItems.map((item) => (
            <TooltipProvider key={item.name} delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <Button 
                      variant={pathname === item.href ? "secondary" : "ghost"}
                      size="icon" 
                      className="h-10 w-10"
                    >
                      {item.icon}
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
        
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" asChild>
                <Link href="/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}