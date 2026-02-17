/**
 * Home page — certification grid with progress overview.
 *
 * Shows:
 * - Personalized greeting with user's name
 * - Streak & daily target progress
 * - Overall progress bar with weighted pass probability
 * - Skill label and description
 * - Certification grid (PL-300 active, others "Coming Soon")
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { getUserProgress, type UserProgress } from "@/lib/api";
import {
  BarChart3,
  ChevronRight,
  Lock,
  TrendingUp,
  Flame,
  Target,
  Award,
} from "lucide-react";

// Certification cards data
const certifications = [
  {
    code: "PL-300",
    title: "PL-300",
    subtitle: "Microsoft Power BI Data Analyst",
    color: "from-blue-500 to-blue-700",
    active: true,
  },
  {
    code: "CLF-C02",
    title: "CLF-C02",
    subtitle: "AWS Cloud Practitioner",
    color: "from-orange-500 to-orange-700",
    active: false,
  },
  {
    code: "AZ-900",
    title: "AZ-900",
    subtitle: "Azure Fundamentals",
    color: "from-cyan-500 to-cyan-700",
    active: false,
  },
  {
    code: "SY0-701",
    title: "SY0-701",
    subtitle: "CompTIA Security+",
    color: "from-red-500 to-red-700",
    active: false,
  },
];

export default function HomePage() {
  const router = useRouter();
  const { displayName, globalSkill } = useAuthStore();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const data = await getUserProgress();
        setProgress(data);
      } catch {
        // User may not have any progress yet
      } finally {
        setLoading(false);
      }
    };
    loadProgress();
  }, []);

  const passProbability = progress?.pass_probability;
  const passProbEst = passProbability?.estimate ?? 0;
  const passProbConfidence = passProbability?.confidence ?? "low";

  // Daily target progress
  const dailyTarget = progress?.daily_target ?? 10;
  const todayAnswered = progress?.today_answered ?? 0;
  const dailyPercent = Math.min(100, Math.round((todayAnswered / dailyTarget) * 100));

  // Streak
  const currentStreak = progress?.current_streak ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
      {/* Greeting Section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {displayName || "Student"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Keep studying to improve your certification readiness.
        </p>
      </div>

      {/* Streak & Daily Target Row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Streak Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className={`w-5 h-5 ${currentStreak > 0 ? "text-orange-500" : "text-gray-400"}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Streak
            </span>
          </div>
          <p className={`text-3xl font-bold ${currentStreak > 0 ? "text-orange-500" : "text-gray-400"}`}>
            {currentStreak}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {currentStreak > 0 ? `${currentStreak} day${currentStreak > 1 ? "s" : ""} in a row!` : "Start your streak today"}
          </p>
        </div>

        {/* Daily Target Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className={`w-5 h-5 ${todayAnswered >= dailyTarget ? "text-green-500" : "text-blue-500"}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Today
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {todayAnswered}
            <span className="text-sm font-normal text-gray-400">/{dailyTarget}</span>
          </p>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-2">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                todayAnswered >= dailyTarget ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${dailyPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Progress Overview Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                Overall Progress
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Skill: {Math.round(progress?.global_skill ?? globalSkill)}
                </p>
                {progress?.skill_label && (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                    {progress.skill_label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(passProbEst)}%
            </p>
            <div className="flex items-center gap-1 justify-end">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pass probability
              </p>
              {passProbConfidence && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  passProbConfidence === "high"
                    ? "bg-green-100 dark:bg-green-950 text-green-600"
                    : passProbConfidence === "medium"
                    ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-600"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                }`}>
                  {passProbConfidence}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
              passProbEst >= 70
                ? "bg-green-500"
                : passProbEst >= 40
                ? "bg-yellow-500"
                : "bg-blue-600"
            }`}
            style={{ width: `${Math.min(100, passProbEst)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
          <span>
            {progress?.total_questions ?? 0} questions answered
          </span>
          <span>{progress?.accuracy ?? 0}% accuracy</span>
        </div>
      </div>

      {/* Certification Grid */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Certifications
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {certifications.map((cert) => (
            <div
              key={cert.code}
              className={`relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden ${
                cert.active
                  ? "hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer"
                  : "opacity-50 grayscale"
              } transition-all duration-200`}
              onClick={() => {
                if (cert.active) router.push("/exam");
              }}
            >
              {/* Color accent bar */}
              <div
                className={`h-1.5 bg-gradient-to-r ${cert.color}`}
              />

              <div className="p-4 md:p-5">
                {/* Coming Soon badge */}
                {!cert.active && (
                  <div className="flex items-center gap-1 mb-2">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Coming Soon
                    </span>
                  </div>
                )}

                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  {cert.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {cert.subtitle}
                </p>

                {/* Action button */}
                <div className="mt-4">
                  {cert.active ? (
                    <button className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
                      Start
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm font-medium rounded-xl cursor-not-allowed"
                    >
                      Locked
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats (visible when user has progress) */}
      {progress && progress.total_questions > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {progress.total_questions}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Questions
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {progress.accuracy}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Accuracy
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Award className="w-4 h-4 text-blue-500" />
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round(progress.global_skill)}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {progress.skill_label || "Skill"}
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-4 mt-4">
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
      )}
    </div>
  );
}
