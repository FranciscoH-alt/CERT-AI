/**
 * App shell that wraps all pages with auth, theme, sidebar, and bottom nav.
 * Login page gets a clean layout without navigation.
 */

"use client";

import { usePathname } from "next/navigation";
import ThemeProvider from "./ThemeProvider";
import AuthGuard from "./AuthGuard";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import ServiceWorkerRegistration from "./ServiceWorker";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <ThemeProvider>
      <ServiceWorkerRegistration />
      <AuthGuard>
        {isLoginPage ? (
          // Clean layout for login — no nav
          <main className="min-h-screen">{children}</main>
        ) : (
          // App layout with sidebar + bottom nav
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
              {children}
            </main>
            <BottomNav />
          </div>
        )}
      </AuthGuard>
    </ThemeProvider>
  );
}
