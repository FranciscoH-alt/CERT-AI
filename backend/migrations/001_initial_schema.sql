-- CertAI Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    global_skill FLOAT DEFAULT 1000.0,          -- ELO-based overall skill rating
    theme_preference TEXT DEFAULT 'light',        -- 'light' or 'dark'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CERTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,                    -- e.g. 'PL-300'
    title TEXT NOT NULL,                           -- e.g. 'Microsoft Power BI Data Analyst'
    description TEXT,
    is_active BOOLEAN DEFAULT FALSE,              -- only PL-300 active in V1
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOMAINS TABLE (exam topic areas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                            -- e.g. 'Prepare the Data'
    description TEXT,
    weight FLOAT DEFAULT 0.0,                     -- % weight in actual exam
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUESTIONS TABLE (AI-generated + cached)
-- ============================================
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,                        -- ["option A", "option B", "option C", "option D"]
    correct_index INT NOT NULL,                    -- 0-3
    explanation TEXT,
    difficulty_estimate FLOAT DEFAULT 1000.0,      -- ELO-based difficulty
    times_answered INT DEFAULT 0,
    times_correct INT DEFAULT 0,
    generated_by TEXT DEFAULT 'gemini',            -- AI model that generated this
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXAM SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    skill_before FLOAT,                            -- snapshot of skill at start
    skill_after FLOAT,                             -- snapshot of skill at end
    is_complete BOOLEAN DEFAULT FALSE
);

-- ============================================
-- USER RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.exam_sessions(id) ON DELETE SET NULL,
    selected_index INT NOT NULL,                   -- user's answer 0-3
    is_correct BOOLEAN NOT NULL,
    time_spent_seconds INT,                        -- how long user took
    skill_before FLOAT,                            -- user skill before this question
    skill_after FLOAT,                             -- user skill after this question
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER DOMAIN SKILLS TABLE (per-domain ELO)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_domain_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    skill_rating FLOAT DEFAULT 1000.0,             -- ELO rating for this domain
    questions_answered INT DEFAULT 0,
    questions_correct INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, domain_id)
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_questions_domain ON public.questions(domain_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty_estimate);
CREATE INDEX IF NOT EXISTS idx_questions_cert ON public.questions(certification_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_user ON public.user_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_session ON public.user_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_skills_user ON public.user_domain_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON public.exam_sessions(user_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_domain_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- User responses: users can only see/create their own
CREATE POLICY "Users can view own responses" ON public.user_responses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own responses" ON public.user_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User domain skills: users can only see/modify their own
CREATE POLICY "Users can view own domain skills" ON public.user_domain_skills
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own domain skills" ON public.user_domain_skills
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own domain skills" ON public.user_domain_skills
    FOR UPDATE USING (auth.uid() = user_id);

-- Exam sessions: users can only see/create their own
CREATE POLICY "Users can view own sessions" ON public.exam_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.exam_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.exam_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Questions and certifications: readable by all authenticated users
CREATE POLICY "Authenticated users can view questions" ON public.questions
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view certifications" ON public.certifications
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view domains" ON public.domains
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can do everything (for backend API)
CREATE POLICY "Service role full access users" ON public.users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access questions" ON public.questions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access responses" ON public.user_responses
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access domain_skills" ON public.user_domain_skills
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access sessions" ON public.exam_sessions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_domain_skills_updated_at
    BEFORE UPDATE ON public.user_domain_skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER: auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED DATA: Certifications and Domains
-- ============================================
INSERT INTO public.certifications (code, title, description, is_active) VALUES
    ('PL-300', 'Microsoft Power BI Data Analyst', 'Demonstrate methods and best practices for modeling, visualizing, and analyzing data with Power BI.', TRUE),
    ('CLF-C02', 'AWS Cloud Practitioner', 'Validate cloud fluency and foundational AWS knowledge.', FALSE),
    ('AZ-900', 'Microsoft Azure Fundamentals', 'Prove foundational knowledge of cloud concepts and Azure services.', FALSE),
    ('SY0-701', 'CompTIA Security+', 'Validate baseline cybersecurity skills and knowledge.', FALSE)
ON CONFLICT (code) DO NOTHING;

-- PL-300 Domains (based on actual Microsoft exam objectives)
INSERT INTO public.domains (certification_id, name, description, weight, sort_order)
SELECT
    c.id,
    d.name,
    d.description,
    d.weight,
    d.sort_order
FROM public.certifications c
CROSS JOIN (VALUES
    ('Prepare the Data (25-30%)', 'Connect to data sources, profile data, clean and transform data.', 0.275, 1),
    ('Model the Data (25-30%)', 'Design and develop a data model, create measures using DAX, optimize model performance.', 0.275, 2),
    ('Visualize and Analyze the Data (25-30%)', 'Create reports, create dashboards, enhance reports for usability and storytelling.', 0.275, 3),
    ('Deploy and Maintain Assets (15-20%)', 'Manage files and datasets, manage workspaces, and manage data security.', 0.175, 4)
) AS d(name, description, weight, sort_order)
WHERE c.code = 'PL-300'
AND NOT EXISTS (
    SELECT 1 FROM public.domains WHERE certification_id = c.id
);
