import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeProvider } from "@/components/layout/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent OS Dashboard",
  description: "Painel pessoal do Agent OS — memória, hub MCP, APIs OpenAPI e orquestração",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body 
        className="h-full bg-white dark:bg-black text-zinc-900 dark:text-white selection:bg-zinc-200 dark:selection:bg-zinc-800 transition-colors"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <ToastProvider>
            <AppLayout>{children}</AppLayout>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
