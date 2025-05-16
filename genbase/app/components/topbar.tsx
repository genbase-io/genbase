"use client";
import React from "react";
import { ProjectSwitcher } from "./project-switcher";
import { UserNav } from "./user-nav";
import { ModeToggle } from "./mode-toggle";
import Link from "next/link";
import Image from "next/image";
import { FeatureGate } from "@/lib/feature-flags";

export function Topbar() {
  return (
    <div className="border-b">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Image 
              src="/logo.png" 
              alt="Genbase Logo" 
              width={28} 
              height={28} 
              className="h-7 w-auto"
            />
            <span className="font-bold text-lg text-primary">Genbase</span>
          </Link>
          <div className="hidden md:flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link 
              href="https://docs.genbase.io" 
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </Link>
          </div>
        </div>
        <div className="ml-auto flex items-center space-x-3">
          <ProjectSwitcher />
          <ModeToggle />

          <FeatureGate feature="userAuthentication">
            <UserNav />
          </FeatureGate>
        </div>
      </div>
    </div>
  );
}