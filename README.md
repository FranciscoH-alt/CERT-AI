# CertAI — Adaptive AI Certification Exam Prep

An AI-powered adaptive certification exam platform built with Next.js, FastAPI, and Supabase.

## Features

- **Adaptive Learning**: ELO-based difficulty algorithm that targets your weakest areas
- **AI-Generated Questions**: Gemini 1.5 Flash generates realistic exam questions
- **PL-300 Support**: Microsoft Power BI Data Analyst certification (more coming soon)
- **Real-time Progress**: Skill tracking, domain breakdowns, and pass probability
- **Mobile-First PWA**: Installable on iOS and Android with offline fallback
- **Dark Mode**: System-aware with manual toggle

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS |
| State | Zustand |
| Charts | Chart.js + react-chartjs-2 |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| AI | Google Gemini 1.5 Flash |

## Project Structure

```
/frontend
  /src
    /app          → Next.js pages (login, home, exam, progress, user)
    /components   → React components (layout, progress charts)
    /lib          → API client, Supabase client, Zustand stores
  /public         → PWA manifest, service worker, icons

/backend
  main.py         → FastAPI app entry point
  config.py       → Environment configuration
  /routes         → API route handlers
  /services       → Business logic (ELO, Gemini, question selector)
  /models         → Pydantic schemas
  /migrations     → Database schema SQL
```

## Setup Guide

### Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase account (free tier works)
- Google AI Studio API key

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema file:
   ```
   backend/migrations/001_initial_schema.sql
   ```
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
4. Go to **Settings → API → JWT Settings** and copy the JWT secret

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase and Gemini API credentials

# Run the server
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run dev server
npm run dev
```

### 4. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create an API key
3. Add it to `backend/.env` as `GEMINI_API_KEY`

## Environment Variables

### Backend (`backend/.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-api-key
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## How the Adaptive System Works

1. **ELO Rating**: Users and questions both have skill/difficulty ratings (default 1000)
2. **Question Selection**: Targets the user's weakest domain with questions near their skill level
3. **After Each Answer**: Both user skill and question difficulty are updated via ELO formula
4. **Pass Probability**: Estimated using the ELO expected score against a passing threshold

```
expected_score = 1 / (1 + 10^((difficulty - skill) / 400))
new_skill = skill + K * (actual - expected)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/user/profile` | Get user profile |
| PATCH | `/user/profile` | Update profile |
| GET | `/certifications/` | List certifications |
| POST | `/exam/session/start` | Start exam session |
| POST | `/exam/generate-question` | Get next adaptive question |
| POST | `/exam/submit-answer` | Submit answer + update ELO |
| POST | `/exam/session/end` | End exam session |
| GET | `/progress/user` | Get full progress data |
| GET | `/progress/domains` | Get domain breakdown |

## PWA Installation

### iOS
1. Open the app in Safari
2. Tap the share button
3. Tap "Add to Home Screen"

### Android
1. Open the app in Chrome
2. Tap the install banner or menu → "Install app"

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npx vercel
```

### Backend (Railway / Render / Fly.io)
```bash
cd backend
# Deploy with your preferred platform
# Ensure environment variables are configured
```
