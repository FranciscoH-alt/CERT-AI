/**
 * Authentication guard component.
 * Wraps the app layout and redirects unauthenticated users to /login.
 * Listens for Supabase auth state changes and syncs with Zustand store.
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store";
import { getUserProfile } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setAuth, setProfile, setLoading, user, isLoading } = useAuthStore();

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setAuth(session.user, session);
          // Fetch user profile from backend
          try {
            const profile = await getUserProfile();
            setProfile(profile.display_name, profile.global_skill);
          } catch {
            // Profile fetch failed — still authenticated
          }
        } else if (pathname !== "/login") {
          router.push("/login");
        }
      } catch {
        // Session check failed — redirect to login
        if (pathname !== "/login") {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setAuth(session.user, session);
        try {
          const profile = await getUserProfile();
          setProfile(profile.display_name, profile.global_skill);
        } catch {
          // Silent fail
        }
      } else {
        setAuth(null, null);
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, setAuth, setProfile, setLoading]);

  // Show loading state
  if (isLoading && pathname !== "/login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated (except login page)
  if (!user && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
