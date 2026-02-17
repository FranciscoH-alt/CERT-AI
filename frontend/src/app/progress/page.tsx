/**
 * Progress page — v2 detailed analytics and domain breakdown.
 *
 * Shows:
 * - Overall skill rating with label and weighted pass probability
 * - Streak & daily target
 * - Domain breakdown with proficiency %, weights, and suggestions
 * - Skill trend chart
 * - Domain radar chart
 */

"use client";

import { useEffect, useState } from "react";
import { getUserProgress, getSkillHistory, type UserProgress, type SkillHistory } from "@/lib/api";
import {
  TrendingUp,
  Target,
  AlertTriangle,
  BarChart3,
  Award,
  Loader2,
  Flame,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DomainChart from "@/components/progress/DomainChart";
import TrendChart from "@/components/progress/TrendChart";

export default function ProgressPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [skillHistory, setSkillHistory] = useState<SkillHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDomainDetails, setShowDomainDetails] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [progData, histData] = await Promise.allSettled([
          getUserProgress(),
          getSkillHistory(),
        ]);
        if (progData.status === "fulfilled") setProgress(progData.value);
        if (histData.status === "fulfilled") setSkillHistory(histData.value);
      } catch {
        // No progress yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!progress || progress.total_questions === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Progress
        </h1>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No progress yet. Start an exam to see your analytics.
          </p>
        </div>
      </div>
    );
  }

  const passProbability = progress.pass_probability;

  // Find weakest domain
  const weakestDomain =
    progress.domain_skills.length > 0
      ? progress.domain_skills.reduce((min, d) =>
          d.skill_rating < min.skill_rating ? d : min
        )
      : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Progress
      </h1>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* Skill Rating */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Skill Rating
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(progress.global_skill)}
          </p>
          {progress.skill_label && (
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5">
              {progress.skill_label}
            </p>
          )}
        </div>

        {/* Pass Probability */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Pass Prob.
            </span>
          </div>
          <p className={`text-2xl font-bold ${
            passProbability.estimate >= 70
              ? "text-green-600 dark:text-green-400"
              : passProbability.estimate >= 40
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-red-600 dark:text-red-400"
          }`}>
            {Math.round(passProbability.estimate)}%
          </p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${
            passProbability.confidence === "high"
              ? "bg-green-100 dark:bg-green-950 text-green-600"
              : passProbability.confidence === "medium"
              ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-600"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500"
          }`}>
            {passProbability.confidence} confidence
          </span>
        </div>

        {/* Streak */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className={`w-4 h-4 ${progress.current_streak > 0 ? "text-orange-500" : "text-gray-400"}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Streak
            </span>
          </div>
          <p className={`text-2xl font-bold ${progress.current_streak > 0 ? "text-orange-500" : "text-gray-400"}`}>
            {progress.current_streak}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Best: {progress.longest_streak}
          </p>
        </div>

        {/* Today */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Today
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {progress.today_answered}
            <span className="text-sm font-normal text-gray-400">/{progress.daily_target}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {progress.total_questions} total &bull; {progress.accuracy}% accuracy
          </p>
        </div>
      </div>

      {/* Weakest Domain Alert */}
      {weakestDomain && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Focus Area
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                <strong>{weakestDomain.domain_name}</strong> &mdash; {Math.round(weakestDomain.proficiency_percent)}% proficiency (Rating: {Math.round(weakestDomain.skill_rating)}).
                {weakestDomain.suggestion && ` ${weakestDomain.suggestion}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Skill History (Last 10) */}
      {skillHistory && skillHistory.last_10.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Last 10 Answers
            </h3>
            {skillHistory.volatility > 0 && (
              <span className="text-xs text-gray-400">
                Volatility: {skillHistory.volatility.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {skillHistory.last_10.map((item, i) => (
              <div
                key={i}
                className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  item.is_correct
                    ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
                }`}
                title={`${item.is_correct ? "Correct" : "Wrong"} (${item.skill_delta > 0 ? "+" : ""}${item.skill_delta})`}
              >
                {item.is_correct ? "\u2713" : "\u2717"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Domain Breakdown Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">
            Domain Breakdown
          </h3>
          {progress.domain_skills.length > 0 ? (
            <DomainChart domains={progress.domain_skills} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              Answer questions to see domain breakdown
            </p>
          )}
        </div>

        {/* Performance Trend Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">
            Skill Trend
          </h3>
          {progress.recent_sessions.length > 0 ? (
            <TrendChart sessions={progress.recent_sessions} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              Complete sessions to see your trend
            </p>
          )}
        </div>
      </div>

      {/* Domain Details List */}
      {progress.domain_skills.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowDomainDetails(!showDomainDetails)}
            className="w-full px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Domain Details
            </h3>
            {showDomainDetails ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showDomainDetails && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {progress.domain_skills
                .sort((a, b) => a.proficiency_percent - b.proficiency_percent)
                .map((domain) => (
                  <div
                    key={domain.domain_id}
                    className="px-5 py-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {domain.domain_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {domain.questions_correct}/{domain.questions_answered}{" "}
                          correct ({domain.accuracy}%) &bull; Weight: {Math.round(domain.weight * 100)}%
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {Math.round(domain.proficiency_percent)}%
                        </p>
                        <p className="text-xs text-gray-400">proficiency</p>
                      </div>
                    </div>
                    {/* Proficiency bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          domain.proficiency_percent >= 75
                            ? "bg-green-500"
                            : domain.proficiency_percent >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(100, domain.proficiency_percent)}%`,
                        }}
                      />
                    </div>
                    {/* Suggestion */}
                    {domain.suggestion && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {domain.suggestion}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
