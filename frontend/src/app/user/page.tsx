/**
 * User settings page.
 *
 * Sections:
 * - Light/Dark mode toggle
 * - Display name
 * - Email (read-only)
 * - Change password
 * - Payment placeholder (future)
 * - Logout
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore, useThemeStore } from "@/lib/store";
import { updateUserProfile } from "@/lib/api";
import {
  Sun,
  Moon,
  User,
  Mail,
  Lock,
  CreditCard,
  LogOut,
  Check,
  Loader2,
} from "lucide-react";

export default function UserPage() {
  const router = useRouter();
  const { user, displayName, setProfile, globalSkill } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim() || name === displayName) return;
    setSaving(true);
    try {
      await updateUserProfile({ display_name: name.trim() });
      setProfile(name.trim(), globalSkill);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  const handleThemeToggle = async () => {
    toggleTheme();
    const newTheme = theme === "light" ? "dark" : "light";
    try {
      await updateUserProfile({ theme_preference: newTheme });
    } catch {
      // Theme persisted locally regardless
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters");
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage("");
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMessage("Password updated successfully");
      setNewPassword("");
    } catch (err) {
      setPasswordMessage(
        err instanceof Error ? err.message : "Failed to update password"
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Settings
      </h1>

      <div className="space-y-4">
        {/* Theme Toggle */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "light" ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-blue-400" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  Appearance
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {theme === "light" ? "Light mode" : "Dark mode"}
                </p>
              </div>
            </div>
            <button
              onClick={handleThemeToggle}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                theme === "dark" ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
                  theme === "dark" ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Display Name */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              Display Name
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || !name.trim() || name === displayName}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 rounded-xl text-sm font-medium transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              Email
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-xl">
            {user?.email}
          </p>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="w-5 h-5 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              Change Password
            </p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New password (min 6 characters)"
              minLength={6}
            />
            {passwordMessage && (
              <p
                className={`text-xs ${
                  passwordMessage.includes("success")
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {passwordMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordLoading || !newPassword}
              className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white disabled:text-gray-400 rounded-xl text-sm font-medium transition-colors"
            >
              {passwordLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </div>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </div>

        {/* Payment Placeholder */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              Subscription
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Free Plan
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Premium plans coming soon
              </p>
            </div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1 rounded-full">
              Active
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-medium rounded-2xl transition-colors text-sm border border-red-200 dark:border-red-800"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
