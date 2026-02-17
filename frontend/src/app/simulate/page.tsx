/**
 * Simulation exam page — full-length practice exam.
 *
 * Features:
 * - 60 questions, 90-minute timer
 * - Question navigation panel
 * - Mark for review
 * - No feedback until completion
 * - Detailed results with domain breakdown
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSimulationStore } from "@/lib/store";
import {
  startSimulation,
  submitSimAnswer,
  completeSimulation,
  getSimHistory,
  type SimulationSummary,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  Clock,
  Flag,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Trophy,
  AlertTriangle,
  Play,
  History,
} from "lucide-react";

type SimState = "lobby" | "active" | "results";

export default function SimulatePage() {
  const router = useRouter();
  const {
    sessionId,
    questions,
    currentIndex,
    answers,
    markedForReview,
    timeRemaining,
    isActive,
    isComplete,
    results,
    startSim,
    setCurrentIndex,
    setAnswer,
    toggleMarkedForReview,
    tickTime,
    completeSim,
    reset,
  } = useSimulationStore();

  const [simState, setSimState] = useState<SimState>(
    isActive ? "active" : isComplete ? "results" : "lobby"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNav, setShowNav] = useState(false);
  const [history, setHistory] = useState<SimulationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTime = useRef<number>(Date.now());

  // Timer
  useEffect(() => {
    if (simState === "active" && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        tickTime();
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState]);

  // Auto-complete when time runs out
  useEffect(() => {
    if (simState === "active" && timeRemaining <= 0) {
      handleComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await getSimHistory();
      setHistory(data.simulations || []);
    } catch {
      // Ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await startSimulation("PL-300");
      startSim(data.session_id, data.questions, data.time_limit_seconds);
      setSimState("active");
      questionStartTime.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = async (selectedIndex: number) => {
    if (!sessionId) return;
    const q = questions[currentIndex];
    if (!q) return;

    setAnswer(currentIndex, selectedIndex);

    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);

    try {
      await submitSimAnswer({
        session_id: sessionId,
        question_id: q.question_id,
        question_index: currentIndex,
        selected_index: selectedIndex,
        time_spent_seconds: timeSpent,
      });
    } catch {
      // Continue even if submission fails
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      questionStartTime.current = Date.now();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      questionStartTime.current = Date.now();
    }
  };

  const handleGoTo = (index: number) => {
    setCurrentIndex(index);
    questionStartTime.current = Date.now();
    setShowNav(false);
  };

  const handleComplete = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const res = await completeSimulation(sessionId);
      completeSim(res);
      setSimState("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete simulation");
    } finally {
      setLoading(false);
    }
  };

  const handleNewSim = () => {
    reset();
    setSimState("lobby");
    loadHistory();
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const currentQ = questions[currentIndex];
  const timerWarning = timeRemaining < 600; // 10 minutes

  // ============================================
  // LOBBY
  // ============================================
  if (simState === "lobby") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Exam Simulation
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
          Practice under real exam conditions with a full-length PL-300 simulation.
        </p>

        {/* Simulation Info Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">60</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Questions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">90</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Minutes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">700</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pass Score</p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>No feedback is provided until you complete the simulation</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Timer starts immediately. The exam auto-submits when time expires</span>
            </div>
            <div className="flex items-start gap-2">
              <Flag className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>You can mark questions for review and navigate freely</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Simulation
              </>
            )}
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Past Simulations
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((sim) => (
                <div key={sim.session_id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Score: {Math.round(sim.score)}/1000
                    </p>
                    <p className="text-xs text-gray-400">
                      {sim.correct_answers}/{sim.total_questions} correct
                      {sim.started_at && ` \u2022 ${new Date(sim.started_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    sim.is_passed
                      ? "bg-green-100 dark:bg-green-950 text-green-600"
                      : "bg-red-100 dark:bg-red-950 text-red-600"
                  }`}>
                    {sim.is_passed ? "PASS" : "FAIL"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {historyLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RESULTS
  // ============================================
  if (simState === "results" && results) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        {/* Score Header */}
        <div className={`rounded-2xl p-6 mb-6 text-center ${
          results.is_passed
            ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
        }`}>
          <div className="mb-2">
            {results.is_passed ? (
              <Trophy className="w-12 h-12 text-green-500 mx-auto" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            )}
          </div>
          <h1 className={`text-3xl font-bold ${
            results.is_passed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}>
            {results.is_passed ? "PASSED" : "NOT PASSED"}
          </h1>
          <p className="text-5xl font-bold text-gray-900 dark:text-white mt-2">
            {Math.round(results.score)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            out of 1000 (pass: {results.pass_threshold})
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {results.correct_answers}/{results.total_questions}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Correct</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(results.accuracy)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(results.time_taken_minutes)}m
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
          </div>
        </div>

        {/* Domain Breakdown */}
        {results.domain_results && results.domain_results.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Domain Breakdown
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.domain_results.map((dr, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {dr.domain_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {dr.questions_correct}/{dr.questions_total} correct
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <div className="w-16 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          dr.accuracy >= 70 ? "bg-green-500" : dr.accuracy >= 50 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, dr.accuracy)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-10 text-right">
                      {Math.round(dr.accuracy)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleNewSim}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors"
          >
            New Simulation
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-xl text-sm transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // ACTIVE EXAM
  // ============================================
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (confirm("Are you sure? Your progress will be submitted.")) {
                handleComplete();
              }
            }}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            End
          </button>
          <span className="text-sm text-gray-400">
            Q{currentIndex + 1}/{questions.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Question nav toggle */}
          <button
            onClick={() => setShowNav(!showNav)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold ${
            timerWarning
              ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-4">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Navigation Panel */}
      {showNav && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {answeredCount}/{questions.length} answered
            </p>
            <p className="text-xs text-gray-400">
              {markedForReview.length} flagged
            </p>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((_, i) => {
              const isAnswered = answers[i] !== undefined;
              const isCurrent = i === currentIndex;
              const isFlagged = markedForReview.includes(i);

              return (
                <button
                  key={i}
                  onClick={() => handleGoTo(i)}
                  className={`w-full aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-colors relative ${
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : isAnswered
                      ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {i + 1}
                  {isFlagged && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Question Card */}
      {currentQ && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Domain badge and flag */}
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full">
              {currentQ.domain}
            </span>
            <button
              onClick={() => toggleMarkedForReview(currentIndex)}
              className={`p-1.5 rounded-lg transition-colors ${
                markedForReview.includes(currentIndex)
                  ? "text-orange-500 bg-orange-50 dark:bg-orange-950"
                  : "text-gray-400 hover:text-orange-500"
              }`}
            >
              <Flag className="w-4 h-4" fill={markedForReview.includes(currentIndex) ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Scenario */}
          {currentQ.scenario_text && (
            <div className="mx-5 mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {currentQ.scenario_text}
              </p>
            </div>
          )}

          {/* Question text */}
          <div className="p-5">
            <p className="text-base font-medium text-gray-900 dark:text-white leading-relaxed">
              {currentQ.question_text}
            </p>
          </div>

          {/* Answer options */}
          <div className="px-5 pb-5 space-y-2">
            {currentQ.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              const isSelected = answers[currentIndex] === index;

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="px-5 pb-5 flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-medium rounded-xl text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl text-sm transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit Exam
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {loading && !currentQ && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Preparing your simulation...
          </p>
        </div>
      )}
    </div>
  );
}
