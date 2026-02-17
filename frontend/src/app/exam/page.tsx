/**
 * Adaptive exam page — v2.
 *
 * Features:
 * - Collapsible scenario text
 * - Concept tags and difficulty labels
 * - Enhanced feedback (why correct, why others wrong)
 * - Optional timed mode with countdown
 * - Mark for review / flag questions
 * - Auto-queue incorrect answers for spaced repetition
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useExamStore, useAuthStore } from "@/lib/store";
import {
  startSession,
  generateQuestion,
  submitAnswer,
  endSession,
  addToReviewQueue,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Trophy,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Timer,
  Tag,
  AlertCircle,
} from "lucide-react";

export default function ExamPage() {
  const router = useRouter();
  const {
    sessionId,
    currentQuestion,
    selectedAnswer,
    showResult,
    lastResult,
    questionsAnswered,
    correctAnswers,
    isLoading,
    markedForReview,
    timedMode,
    questionTimer,
    questionTimeLimit,
    setSessionId,
    setQuestion,
    setSelectedAnswer,
    setShowResult,
    setLastResult,
    incrementAnswered,
    setLoading,
    toggleMarkedForReview,
    setTimedMode,
    tickTimer,
    resetTimer,
    reset,
  } = useExamStore();

  const { setProfile, displayName } = useAuthStore();
  const [error, setError] = useState("");
  const [scenarioExpanded, setScenarioExpanded] = useState(true);
  const questionStartTime = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (timedMode && currentQuestion && !showResult) {
      resetTimer();
      timerRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedMode, currentQuestion?.question_id, showResult]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timedMode && questionTimer >= questionTimeLimit && !showResult && selectedAnswer !== null) {
      handleSubmitAnswer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionTimer]);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        setError("");
        const session = await startSession("PL-300");
        setSessionId(session.session_id);
        await loadNextQuestion(session.session_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start session");
      } finally {
        setLoading(false);
      }
    };
    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextQuestion = async (sid?: string) => {
    try {
      setLoading(true);
      setError("");
      const question = await generateQuestion("PL-300", sid || sessionId || undefined);
      setQuestion({
        question_id: question.question_id,
        question_text: question.question_text,
        options: question.options,
        domain: question.domain,
        difficulty: question.difficulty,
        scenario_text: question.scenario_text || "",
        concept_tag: question.concept_tag || "",
      });
      questionStartTime.current = Date.now();
      setScenarioExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate question");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = useCallback(async () => {
    if (selectedAnswer === null || !currentQuestion) return;

    try {
      setLoading(true);
      setError("");
      if (timerRef.current) clearInterval(timerRef.current);

      const timeSpent = Math.round(
        (Date.now() - questionStartTime.current) / 1000
      );

      const result = await submitAnswer({
        question_id: currentQuestion.question_id,
        selected_index: selectedAnswer,
        session_id: sessionId || undefined,
        time_spent_seconds: timeSpent,
      });

      setLastResult(result);
      setShowResult(true);
      incrementAnswered(result.is_correct);
      setProfile(displayName, result.skill_after);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnswer, currentQuestion, sessionId]);

  const handleNextQuestion = () => {
    setShowResult(false);
    loadNextQuestion();
  };

  const handleEndSession = async () => {
    if (sessionId) {
      try {
        await endSession(sessionId);
      } catch {
        // Silent
      }
    }
    reset();
    router.push("/");
  };

  const handleAddToReview = async () => {
    if (!currentQuestion) return;
    try {
      await addToReviewQueue(currentQuestion.question_id);
      toggleMarkedForReview(currentQuestion.question_id);
    } catch {
      // Silent
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const timerWarning = timedMode && questionTimer >= questionTimeLimit * 0.75;
  const isMarked = currentQuestion
    ? markedForReview.includes(currentQuestion.question_id)
    : false;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handleEndSession}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">End Session</span>
        </button>

        <div className="flex items-center gap-4 text-sm">
          {/* Timed mode toggle */}
          <button
            onClick={() => setTimedMode(!timedMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              timedMode
                ? "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            {timedMode ? formatTime(Math.max(0, questionTimeLimit - questionTimer)) : "Timer Off"}
          </button>

          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Target className="w-4 h-4" />
            <span>
              {correctAnswers}/{questionsAnswered}
            </span>
          </div>
          {questionsAnswered > 0 && (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Trophy className="w-4 h-4" />
              <span>
                {Math.round((correctAnswers / questionsAnswered) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => loadNextQuestion()}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !currentQuestion && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generating your next question...
          </p>
        </div>
      )}

      {/* Question Card */}
      {currentQuestion && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Domain, concept tag, and difficulty badges */}
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full">
                {currentQuestion.domain}
              </span>
              {currentQuestion.concept_tag && (
                <span className="flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2.5 py-1 rounded-full">
                  <Tag className="w-3 h-3" />
                  {currentQuestion.concept_tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Mark for review */}
              <button
                onClick={handleAddToReview}
                className={`p-1 rounded transition-colors ${
                  isMarked
                    ? "text-yellow-500"
                    : "text-gray-400 hover:text-yellow-500"
                }`}
                title={isMarked ? "Marked for review" : "Mark for review"}
              >
                <Bookmark className="w-4 h-4" fill={isMarked ? "currentColor" : "none"} />
              </button>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>Difficulty: {Math.round(currentQuestion.difficulty)}</span>
              </div>
            </div>
          </div>

          {/* Timer warning bar */}
          {timedMode && !showResult && (
            <div className="h-1 bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  timerWarning ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{
                  width: `${Math.max(0, (1 - questionTimer / questionTimeLimit) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* Collapsible Scenario */}
          {currentQuestion.scenario_text && (
            <div className="mx-5 mt-4">
              <button
                onClick={() => setScenarioExpanded(!scenarioExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors w-full text-left"
              >
                <AlertCircle className="w-4 h-4 text-blue-500" />
                <span>Scenario</span>
                {scenarioExpanded ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {scenarioExpanded && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.scenario_text}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Question text */}
          <div className="p-5 md:p-6">
            <p className="text-base md:text-lg font-medium text-gray-900 dark:text-white leading-relaxed">
              {currentQuestion.question_text}
            </p>
          </div>

          {/* Answer options */}
          <div className="px-5 pb-5 space-y-2.5">
            {currentQuestion.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              const isSelected = selectedAnswer === index;
              const isCorrect =
                showResult && lastResult?.correct_index === index;
              const isWrong =
                showResult && isSelected && !lastResult?.is_correct;

              let borderColor =
                "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600";
              let bgColor = "";

              if (showResult) {
                if (isCorrect) {
                  borderColor = "border-green-500 dark:border-green-400";
                  bgColor = "bg-green-50 dark:bg-green-950/30";
                } else if (isWrong) {
                  borderColor = "border-red-500 dark:border-red-400";
                  bgColor = "bg-red-50 dark:bg-red-950/30";
                }
              } else if (isSelected) {
                borderColor = "border-blue-500 dark:border-blue-400";
                bgColor = "bg-blue-50 dark:bg-blue-950/30";
              }

              return (
                <button
                  key={index}
                  onClick={() => !showResult && setSelectedAnswer(index)}
                  disabled={showResult}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 ${borderColor} ${bgColor} text-left transition-all duration-200`}
                >
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isSelected && !showResult
                        ? "bg-blue-600 text-white"
                        : isCorrect
                        ? "bg-green-600 text-white"
                        : isWrong
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {showResult && isCorrect ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : showResult && isWrong ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      letter
                    )}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Enhanced Result Explanation */}
          {showResult && lastResult && (
            <div className="mx-5 mb-5 space-y-3">
              {/* Correct/Incorrect header */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  {lastResult.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      lastResult.is_correct
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {lastResult.is_correct ? "Correct!" : "Incorrect"}
                  </span>
                  {lastResult.difficulty_label && (
                    <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      {lastResult.difficulty_label}
                    </span>
                  )}
                </div>

                {/* Why the correct answer is correct */}
                {lastResult.why_correct && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                      Why this is correct:
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {lastResult.why_correct}
                    </p>
                  </div>
                )}

                {/* Why other answers are wrong */}
                {lastResult.why_others_wrong && lastResult.why_others_wrong.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                      Why others are wrong:
                    </p>
                    <ul className="space-y-1">
                      {lastResult.why_others_wrong.map((reason, i) => (
                        <li key={i} className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex items-start gap-1.5">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Concept tag and skill change */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span>
                    Skill: {Math.round(lastResult.skill_before)} →{" "}
                    <span
                      className={
                        lastResult.skill_after > lastResult.skill_before
                          ? "text-green-600 dark:text-green-400 font-medium"
                          : "text-red-600 dark:text-red-400 font-medium"
                      }
                    >
                      {Math.round(lastResult.skill_after)}
                    </span>
                  </span>
                  <span>Domain: {lastResult.domain}</span>
                  {lastResult.concept_tag && (
                    <span className="flex items-center gap-1 text-purple-500">
                      <Tag className="w-3 h-3" />
                      {lastResult.concept_tag}
                    </span>
                  )}
                </div>

                {/* Auto-queued notification */}
                {lastResult.auto_queued_for_review && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Auto-added to your review queue for spaced repetition</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-5 pb-5">
            {!showResult ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null || isLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 font-medium rounded-xl transition-colors text-sm"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  "Submit Answer"
                )}
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Next Question
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
