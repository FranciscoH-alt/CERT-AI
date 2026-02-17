/**
 * Mobile bottom navigation bar.
 * Shows on screens < 768px.
 * Fixed to bottom, native app feel with large tap targets.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, User, ClipboardCheck } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/simulate", label: "Simulate", icon: ClipboardCheck },
  { href: "/user", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200 ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
