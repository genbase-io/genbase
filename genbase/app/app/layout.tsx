import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { FeatureFlagProvider } from "@/lib/feature-flags";

import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Genbase - Infrastructure as Code Management",
  description: "Infrastructure as Code Management Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <FeatureFlagProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </FeatureFlagProvider>
      </body>
    </html>
  );
}