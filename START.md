# RunTracker — AI Running Coach

## Quick Reference

| | |
|---|---|
| **Opis** | AI Running Coach inspirowany Runna by Strava — plan treningowy z taperingiem, road+trail, Garmin sync, Strava analytics |
| **Status** | ✅ CZĘŚĆ 1-3 complete — next: Google Cloud configuration (API keys, Firebase deploy, Strava app) |
| **Repo** | https://github.com/grzegorzee/run-tracker |
| **Live** | https://grzegorzee.github.io/run-tracker/ |
| **Firebase** | run-tracker-app |
| **Stack** | React 18 + TS + Vite + Firebase 12 + Tailwind + shadcn/ui + Framer Motion |
| **AI** | Claude (primary) + OpenAI (fallback) — server-side via Cloud Functions |

---

## Komendy

```bash
# Dev
cd "/Users/grzegorzjasionowicz/Documents/Baza Wiedzy/FIRMA/projekty/run_tracker" && npm run dev

# Deploy na GitHub Pages
npm run deploy

# Deploy Cloud Functions
cd functions && firebase deploy --only functions

# Build
npm run build

# Testy
npm run test
```

**🔴 DEPLOY:** Po każdej zmianie kodu: `npm run deploy` (sam push na main NIE aktualizuje GitHub Pages!)

---

## Routing (HashRouter)

| Ścieżka | Strona | Opis |
|----------|--------|------|
| `/` | Login | Cinematic login screen |
| `/onboarding` | Onboarding | 11-step wizard (road+trail) |
| `/dashboard` | Dashboard | Hero metrics, today workout, week view |
| `/plan` | TrainingPlan | Kalendarz z kolorami faz |
| `/workout/:id` | WorkoutDetail | Plan vs wykonanie + AI + elevation |
| `/analytics` | Analytics | 4 taby z animated charts |
| `/weekly-summary` | WeeklySummary | AI tygodniowe podsumowanie |
| `/settings` | Settings | Strava, Garmin, preferencje |
| `/new-plan` | NewPlan | Nowy plan po wygaśnięciu |
| `/strava-callback` | StravaCallback | OAuth redirect |

---

## Firebase Collections

| Collection | Opis |
|------------|------|
| `users/{userId}` | Profil, onboarding, Garmin/Strava status |
| `training_plans/{planId}` | Plan + macroStructure + weeks[] (rolling) |
| `strava_activities/{activityId}` | Aktywności ze Strava + derived metrics |
| `weekly_summaries/{summaryId}` | Tygodniowe AI podsumowania |

---

## Kluczowe pliki do modyfikacji

| Chcesz zmienić... | Edytuj... |
|---|---|
| Design system (kolory, fonty) | `src/index.css` + `tailwind.config.ts` |
| Typy treningów | `src/data/runningWorkoutTypes.ts` |
| Tapering protocols | `src/data/taperProtocols.ts` |
| AI plan generation | `functions/src/ai/generatePlan.ts` |
| Adaptive planner (rolling 7-day) | `functions/src/ai/adaptivePlanner.ts` |
| AI workout analysis | `functions/src/ai/analyzeWorkout.ts` |
| Garmin workout builder | `src/lib/garmin-workout-builder.ts` |
| Pace/VDOT/GAP calculations | `src/lib/pace-utils.ts` + `src/lib/elevation-utils.ts` |
| Training metrics (TRIMP, ACWR) | `src/lib/training-metrics.ts` |
| Strava OAuth | `functions/src/strava/` |
| Weekly digest (AI summary) | `functions/src/ai/weeklyDigest.ts` |
| Adaptation suggestions | `functions/src/ai/suggestAdaptations.ts` |
| Weekly summary page | `src/pages/WeeklySummary.tsx` |
| New plan page | `src/pages/NewPlan.tsx` |
| Strava callback page | `src/pages/StravaCallback.tsx` |
| Onboarding wizard | `src/pages/Onboarding.tsx` |
| Dashboard layout | `src/pages/Dashboard.tsx` |
| Navigation | `src/components/AppNavigation.tsx` |
| Firebase config | `src/lib/firebase.ts` |
| Auth + whitelist | `src/hooks/useAuth.ts` |

---

## Architektura AI — Adaptive Rolling Planning

```
Onboarding → AI generuje macroStructure + weeks[0-1]
    ↓
Tydzień biegowy:  Biegi → Strava sync → derived metrics
    ↓
Co 7 dni:  adaptivePlanner → generuje kolejne 7 dni
    ↓
Auto-upload na Garmin (jeśli connected)
    ↓
Powtarza co 7 dni aż do race day
    ↓
Poniedziałek 8:00 CET:  weeklyDigest → AI podsumowanie tygodnia
    ↓
suggestAdaptations → auto-update pace zones gdy biegacz konsekwentnie szybszy
```

- `macroStructure[]` = statyczny (fazy: base → build → peak → taper → race)
- `weeks[]` = dynamiczny (rośnie co 7 dni)
- `generatedUpTo` = data do której mamy treningi

---

## Cloud Functions

| Function | Typ | Opis |
|----------|-----|------|
| `generatePlan` | Callable | Onboarding → macroStructure + 2 weeks |
| `adaptivePlanner` | Callable | Rolling 7-day plan generation based on Strava data |
| `triggerAdaptivePlanner` | Scheduled | Automatyczny trigger adaptivePlanner |
| `analyzeWorkout` | Callable | Per-workout AI summary po sync ze Strava |
| `weeklyDigest` | Callable | AI weekly summary z metrykami i insights |
| `triggerWeeklyDigest` | Scheduled | Poniedziałek 8:00 CET — auto weekly digest |
| `suggestAdaptations` | Callable | Trend analysis + auto-update pace zones |
| `stravaAuthUrl` | HTTPS | Generate Strava OAuth URL |
| `stravaCallback` | HTTPS | Handle Strava OAuth callback |
| `stravaSync` | Callable | Sync activities from Strava |
