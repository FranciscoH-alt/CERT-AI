-- CertAI V2 Features Migration
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Add concept_tag and scenario_text to questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS concept_tag TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS scenario_text TEXT;

-- Add streak and daily target columns to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_target INT DEFAULT 10;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- ============================================
-- REVIEW QUEUE TABLE (Spaced Repetition)
-- ============================================
CREATE TABLE IF NOT EXISTS public.review_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    concept_tag TEXT,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    interval_hours INT DEFAULT 24,
    ease_factor FLOAT DEFAULT 2.5,
    repetitions INT DEFAULT 0,
    mastery_score FLOAT DEFAULT 0.0,
    source TEXT DEFAULT 'auto',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- ============================================
-- DAILY ACTIVITY TABLE (Streaks)
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_answered INT DEFAULT 0,
    questions_correct INT DEFAULT 0,
    time_spent_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

-- ============================================
-- SIMULATION SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.simulation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    time_limit_minutes INT DEFAULT 90,
    total_questions INT DEFAULT 60,
    questions_answered INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    score FLOAT,
    is_complete BOOLEAN DEFAULT FALSE,
    is_passed BOOLEAN,
    domain_results JSONB,
    question_order JSONB,
    answers JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_review_queue_user_next ON public.review_queue(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_review_queue_user ON public.review_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON public.daily_activity(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_user ON public.simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_concept_tag ON public.questions(concept_tag);
CREATE INDEX IF NOT EXISTS idx_user_responses_created ON public.user_responses(user_id, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Review Queue
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own review queue" ON public.review_queue
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review queue" ON public.review_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review queue" ON public.review_queue
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own review queue" ON public.review_queue
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access review_queue" ON public.review_queue
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Daily Activity
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily activity" ON public.daily_activity
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily activity" ON public.daily_activity
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily activity" ON public.daily_activity
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access daily_activity" ON public.daily_activity
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Simulation Sessions
ALTER TABLE public.simulation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own simulation sessions" ON public.simulation_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own simulation sessions" ON public.simulation_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own simulation sessions" ON public.simulation_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access simulation_sessions" ON public.simulation_sessions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER review_queue_updated_at
    BEFORE UPDATE ON public.review_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
