# RunTracker — Wymagania

## Wymagania funkcjonalne

### CZĘŚĆ 1: MVP

**US1.1:** Jako biegacz chcę się zalogować przez Google, żeby mieć bezpieczny dostęp
- Google OAuth + whitelist (VITE_ALLOWED_EMAILS)
- Per-user data isolation

**US1.2:** Jako biegacz chcę przejść onboarding z pytaniami o moje umiejętności
- 11 kroków: typ biegacza, cel, poziom, dystans, wyniki, dni, teren, kontuzje, data
- Trail-specific pytania (conditional)
- Premium UI: full-screen steps, glassmorphism, animated transitions

**US1.3:** Jako biegacz chcę AI-generated plan treningowy z taperingiem
- Claude (primary) + OpenAI (fallback) — server-side
- Adaptive rolling: macroStructure (stały) + weeks (rolling 3 dni)
- Tapering protocols per dystans (5k → ultra)
- Trail: hill repeats, VK, downhill drills, elevation targets
- Walidacja realności (nie obiecuj maratonu za 4 tyg)

**US1.4:** Jako biegacz chcę widzieć dashboard z hero metrics
- Tygodniowy dystans, tempo, D+, realizacja
- Dzisiejszy trening z "Wyślij na Garmin"
- Widok tygodnia (lista treningów)
- AI insight card

**US1.5:** Jako biegacz chcę wysłać trening na zegarek Garmin
- Upload + schedule via Garmin MCP
- Batch: cały tydzień naraz
- Status animation (uploading → scheduled → error)

### CZĘŚĆ 2: Strava + AI Analysis

**US2.1:** Strava OAuth + sync aktywności (Run, TrailRun)
**US2.2:** Matching aktywności do planu (dystans ±30%, elevation ±40%)
**US2.3:** AI analiza per workout (road + trail/GAP)
**US2.4:** WorkoutDetail z porównaniem plan vs wykonanie
**US2.5:** Adaptive planner (rolling 3-day generation)

### CZĘŚĆ 3: Analytics + Polish

**US3.1:** Analytics dashboard (4 taby z animated charts)
**US3.2:** Race predictor (Riegel), VDOT, GAP calculator
**US3.3:** Weekly AI digest (Cloud Scheduler)
**US3.4:** Plan adaptation + zone auto-update
**US3.5:** PWA z offline support

---

## Wymagania niefunkcjonalne

### Performance
- First Contentful Paint < 2s
- Animated transitions < 300ms
- AI generation timeout: 120s
- Debounce Firestore writes: 500ms

### Security
- Server-side AI calls only (no API keys in frontend)
- Firebase Security Rules: per-user isolation
- Strava tokens encrypted in Firestore
- Email whitelist for MVP

### UX
- Dark mode = default
- Mobile-first (bottom nav)
- Glassmorphism + micro-interactions (Framer Motion)
- Self-hosted fonts (no FOUT)
- PWA installable

### Skalowalność
- Free tier do 100 userów
- $6-8/mies do 500 userów
- Firestore reads minimized (real-time listeners, nie polling)

---

## Ograniczenia

1. **Garmin API** — nieoficjalne (MCP), może się zmienić
2. **Strava API** — rate limit 100 req/15min, basic API bez streams
3. **GitHub Pages** — static only, HashRouter required
4. **Claude API** — $3/1M input, $15/1M output (sonnet)
5. **GAP accuracy** — approx z total elevation/distance (nie per-point)
