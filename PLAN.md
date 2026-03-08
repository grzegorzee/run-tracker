# RunTracker — Plan Implementacji

## Aktualny postęp

**Teraz pracujemy nad:** CZĘŚĆ 1 ✅ | CZĘŚĆ 2 ✅ | CZĘŚĆ 3 ✅ → Następna: Konfiguracja Google Cloud

---

## CZĘŚĆ 0: Dokumentacja

- [x] START.md
- [x] PLAN.md
- [x] DOCUMENTATION.md
- [x] REQUIREMENTS.md
- [x] DECYZJE.md
- [ ] Aktualizacja CLAUDE.md o sekcję RunTracker

---

## CZĘŚĆ 1: MVP Foundation

### M1.1: Projekt + Premium Setup ✅
- [x] Vite + React + TypeScript
- [x] Dependencies (firebase, router, tailwind, framer-motion, etc.)
- [x] Vite config (base, PWA plugin, path aliases)
- [x] Google Fonts (Plus Jakarta Sans, Space Grotesk) — Satoshi TBD self-host
- [x] Design system w index.css (dark-first paleta, glass, glow)
- [x] Tailwind config (custom colors, fonts, animations)
- [x] gh-pages package + deploy script
- [x] .env.example

### M1.2: Auth + Premium Login ✅
- [x] useAuth.ts (Google OAuth + whitelist)
- [x] UserContext.tsx (UserProvider, onboarding detection)
- [x] Login.tsx (cinematic full-screen, glassmorphism)
- [x] Layout.tsx (glass sidebar desktop + bottom nav mobile)
- [x] App.tsx (HashRouter, ErrorBoundary, Toaster)

### M1.3: Onboarding Wizard (9 kroków) ✅
- [x] Krok 1: Typ biegacza (road/trail/mountain/mixed)
- [x] Krok 2: Cel (5K → ultra)
- [x] Krok 3: Poziom
- [x] Krok 4: Tygodniowy dystans
- [x] Krok 5: Ostatnie wyniki (tempo + czas zawodów)
- [x] Krok 6: Dni/tydzień
- [x] Krok 7: Profil terenu (conditional trail)
- [x] Krok 8: Kontuzje
- [x] Krok 9: Data docelowa + generate trigger
- [x] Stan: Generowanie (animated loader)
- [ ] Stan: Review (makro struktura + 2 tygodnie) — TODO w CZĘŚCI 2

### M1.4: AI Plan Generation (Cloud Functions) ✅
- [x] functions/ setup (firebase-functions v2, anthropic, openai)
- [x] generatePlan.ts (Claude primary + OpenAI fallback)
- [x] System prompt (tapering, trail, 80/20, volume limits, 10% rule)
- [x] JSON extraction + parsing
- [x] Firestore save (macroStructure + weeks)
- [x] ai-client.ts (frontend → Cloud Function)
- [x] Types (full type system w src/types/index.ts)

### M1.5: Dashboard + Views ✅
- [x] useTrainingPlan.ts (real-time, currentWeek, expiration)
- [x] Dashboard.tsx (hero metrics, today workout, week view, AI insight)
- [x] TrainingPlan.tsx (kalendarz z kolorami faz, phase timeline)
- [x] WorkoutDetail.tsx (plan vs execution, AI analysis)
- [x] Analytics.tsx (placeholder z animowanymi charts)
- [x] Settings.tsx (profile, Strava, Garmin, sign out)

### M1.6: Garmin Integration ✅
- [x] garmin-workout-builder.ts (Garmin workout JSON — all workout types)
- [x] useGarmin.ts (upload + schedule + batch week)
- [ ] GarminSyncButton.tsx (animated states) — TODO: extract component
- [ ] "Wyślij cały tydzień" batch

---

## CZĘŚĆ 2: Strava Integration & AI Analysis ✅

### M2.1: Strava OAuth ✅
- [x] stravaAuthUrl.ts (approval_prompt=force, battle-tested from strength_save)
- [x] stravaCallback.ts (clean reconnect, auto-sync, shared syncUserActivities)
- [x] strava-callback.html (bridge z basePath pattern)
- [x] StravaCallback.tsx (OAuth callback handler)
- [x] Settings.tsx — Strava connect/sync/disconnect z real hook

### M2.2: Activity Sync + Matching ✅
- [x] stravaSync.ts (token refresh, 7-day minimum lookback, scheduled 6h)
- [x] useRunningActivities.ts (grouping, matching, comparison)
- [x] useStrava.ts (real-time subscriptions, connect/sync/disconnect)
- [x] Deduplication + GAP calculation + best efforts + splits

### M2.3: AI Workout Analysis ✅
- [x] analyzeWorkout.ts (Claude + OpenAI fallback, trail/GAP/elevation)
- [x] WorkoutDetail — przycisk "Uruchom AI analizę"

### M2.4: WorkoutDetail — rozszerzenie ✅
- [x] Real data z useTrainingPlan + useRunningActivities
- [x] Plan vs wykonanie comparison z ✓/✗
- [x] AI summary display (AIAnalysisCard)
- [x] Garmin upload z prawdziwym hookiem

### M2.5: Adaptive Planner (rolling 7-day) ✅
- [x] adaptivePlanner.ts (rolling 7-day, nie 3-day)
- [x] Cloud Scheduler trigger (21:00 CET)
- [x] Manual trigger (triggerAdaptivePlanner)
- [x] Evidence-based: ACWR, HR drift, EF trend, missed workouts
- [x] Dashboard "Wygeneruj kolejne 7 dni" button

---

## CZĘŚĆ 3: Analytics, Adaptacja & Polish ✅

### M3.1: Analytics Dashboard — 4 taby ✅
- [x] Tab 1: Przegląd (Recharts bar charts: km/tydzień + D+, lista aktywności)
- [x] Tab 2: Wykresy (pace trend z GAP, HR trend, kadencja, filtry)
- [x] Tab 3: Postęp (animated completion ring, week heatmap)
- [x] Tab 4: Narzędzia (race predictor, pace zones, VDOT, GAP)

### M3.2: Race Predictor & Pace Utils ✅
- [x] pace-utils.ts (Riegel, zones, VDOT, formatPace, parsePace)
- [x] elevation-utils.ts (GAP, gradeAdjustmentFactor)
- [x] Interactive calculators w Tab 4

### M3.3: Weekly AI Digest ✅
- [x] weeklyDigest.ts (Cloud Scheduler Monday 8:00 + manual trigger)
- [x] WeeklySummary.tsx (premium cards z metrics grid + AI insights)

### M3.4: Plan Adaptation Dashboard ✅
- [x] suggestAdaptations.ts (ACWR analysis, EF trend, pace zone auto-update)
- [x] Pace zone auto-update w Firestore

### M3.5: PWA + Polish ✅
- [x] vite-plugin-pwa config (theme_color #0A0F0A, runtime caching)
- [x] Service worker (NetworkFirst Firestore, CacheFirst fonts)
- [x] Chunk splitting (React, Firebase, Recharts, Framer Motion)
- [x] NewPlan.tsx ("Nowy rozdział" experience)
- [x] WeeklySummary page + routing

---

## Backlog

- [ ] Garmin Connect IQ widget
- [ ] Social features (friends, challenges)
- [ ] Stripe payments (premium tier)
- [ ] Nutrition tracking integration
- [ ] Weather-based workout adjustments
- [ ] Multi-language support
