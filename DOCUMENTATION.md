# RunTracker — Dokumentacja Techniczna

## Tech Stack

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 18 + TypeScript + Vite + SWC |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix) + Framer Motion |
| Fonts | Satoshi (headings) + Plus Jakarta Sans (body) + Space Grotesk (metrics) |
| Backend/DB | Firebase 12 (Auth + Firestore + Cloud Functions v2) |
| AI Primary | Claude claude-sonnet-4-6 (server-side) |
| AI Fallback | OpenAI GPT (server-side) |
| Garmin | Garmin MCP (upload_workout + schedule_workout) |
| Strava | OAuth 2.0 via Cloud Functions + bridge HTML |
| Hosting | GitHub Pages (HashRouter) + gh-pages |
| Charts | Recharts |
| PWA | vite-plugin-pwa |

---

## Architektura — Adaptive Rolling Planning

### Filozofia
Zamiast generować 12 tygodni naraz (które szybko się dezaktualizują), stosujemy podejście hybrydowe:

1. **Macro Structure (statyczny)** — definiowany przy onboardingu:
   - Podział na fazy: base → build → peak → taper → race
   - Daty granic faz
   - Tygodniowe targety per faza
   - Zapisane w `macroStructure[]` — NIE zmienia się

2. **Micro Workouts (dynamiczny, rolling 7 dni)** — `adaptivePlanner.ts`:
   - Co 7 dni generuje treningi na kolejny tydzień
   - Bierze pod uwagę dane Strava + ACWR + fatigue
   - `generatedUpTo` = data do której mamy treningi
   - Zmienione z 3-dniowego na 7-dniowy rolling (lepsze dopasowanie do cyklów treningowych)

### Flow

```
Onboarding → macroStructure + weeks[0-1] (2 tyg)
    ↓
Co 7 dni → adaptivePlanner → weeks[+7 dni]
    ↓
Auto Garmin upload (jeśli connected)
    ↓
Powtarza co 7 dni
    ↓
Poniedziałek 8:00 CET → weeklyDigest → AI summary
```

---

## Firestore Schema

### users/{userId}
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: string;
  onboardingCompleted: boolean;
  garminConnected: boolean;
  stravaConnected: boolean;
  stravaTokens?: { accessToken: string; refreshToken: string; expiresAt: number };
  stravaAthleteId?: string;
  preferredTerrain: 'road' | 'trail' | 'mixed';
  lastLogin: Timestamp;
  createdAt: Timestamp;
}
```

### training_plans/{planId}
```typescript
{
  userId: string;
  goalType: string;
  goalDate?: string;
  targetRaceDistance?: string;
  runnerType: 'road' | 'trail' | 'mountain' | 'mixed';
  totalWeeks: number;
  startDate: string;
  endDate: string;
  currentPhase: 'base' | 'build' | 'peak' | 'taper' | 'race';
  taperWeeks: number;
  macroStructure: PhaseDefinition[];
  generatedUpTo: string;           // YYYY-MM-DD
  weeks: TrainingWeek[];
  paceZones: PaceZones;
  elevationTarget?: number;
  status: 'active' | 'completed' | 'expired';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### strava_activities/{activityId}
```typescript
{
  userId: string;
  stravaId: number;
  name: string;
  date: string;
  sportType: 'Run' | 'TrailRun' | 'VirtualRun';
  distance: number;           // meters
  movingTime: number;         // seconds
  avgPace: number;            // sec/km
  avgHR?: number;
  maxHR?: number;
  totalElevationGain?: number;
  // Derived metrics
  trimp?: number;
  efficiencyFactor?: number;
  aerobicDecoupling?: number;
  gradeAdjustedPace?: number;
  // Matching
  matchedWorkoutId?: string;
  matchedWeekNumber?: number;
  // AI
  aiSummary?: WorkoutAISummary;
}
```

### weekly_summaries/{summaryId}
```typescript
{
  userId: string;
  planId: string;
  weekNumber: number;
  weekType: 'build' | 'recovery' | 'taper' | 'race';
  plannedDistance: number;
  actualDistance: number;
  weeklyTrimp: number;
  acwr?: number;
  aiInsights?: string;
}
```

---

## Design System — Dark-First Premium

### Paleta (Dark Mode = default)

- **Tła:** `#0A0F0A` (base) → `#141A14` (surface) → `#1E261E` (elevated)
- **Tekst:** `#E8F0E8` (primary) → 60% opacity (secondary) → 35% (tertiary)
- **Accent:** `#00C853` (green primary) + `#FFB800` (gold CTA)
- **Glass:** `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.08)` border + 20px blur
- **Workout colors:** easy=#4ADE80, tempo=#FBBF24, interval=#F87171, long=#A78BFA, trail=#34D399, taper=#67E8F9

### Fonty

```
Satoshi Bold/ExtraBold     → Nagłówki, hero metrics
Plus Jakarta Sans Regular  → Body, opisy
Space Grotesk Medium       → Liczby, tempo, czas
```

### Typografia Scale

```
Hero number:    Space Grotesk 700, 48-64px, tracking -0.02em
Page heading:   Satoshi 700, 28-32px, tracking -0.01em
Section:        Satoshi 600, 20-24px
Card title:     Plus Jakarta Sans 600, 16-18px
Body:           Plus Jakarta Sans 400, 14-16px, leading 1.6
Label:          Plus Jakarta Sans 500, 12px, uppercase, tracking 0.05em
Metrics:        Space Grotesk 500, 14-16px
```

---

## AI Integration

### Claude (Primary) — Server-Side Only
- Model: claude-sonnet-4-6
- Called from Cloud Functions (never frontend)
- System prompt includes: tapering protocols, trail rules, 80/20, volume limits, adaptation rules

### OpenAI (Fallback)
- Triggered on Claude error/timeout
- Same prompt structure

### AI Functions
1. `generatePlan` — onboarding → macroStructure + 2 weeks
2. `adaptivePlanner` — rolling 7-day based on Strava data + ACWR + fatigue signals
3. `analyzeWorkout` — per-workout AI summary (triggered after Strava sync)
4. `weeklyDigest` — weekly AI summary (scheduled Monday 8:00 CET via `triggerWeeklyDigest`)
5. `suggestAdaptations` — trend analysis + auto-updates pace zones when runner consistently faster

### Weekly Digest System

Automated weekly summary sent every Monday at 8:00 CET:

- **Trigger:** `triggerWeeklyDigest` (Cloud Scheduler)
- **Logic:** `weeklyDigest.ts` collects 7 days of Strava activities, calculates weekly TRIMP, ACWR, distance, compares plan vs actual
- **Output:** Stored in `weekly_summaries/{summaryId}`, displayed on `/weekly-summary` page
- **Content:** Volume compliance %, intensity distribution, fatigue trend, AI insights/recommendations

### Adaptation Suggestions (suggestAdaptations)

Analyzes longer-term trends and auto-adjusts the plan:

- Runs periodically to detect consistent performance patterns
- **Auto pace zone updates:** When a runner is consistently faster than current zones (e.g., easy runs 10-15 sec/km faster over 3+ weeks), pace zones are automatically recalculated
- Uses VDOT progression to recalculate all zone boundaries
- Detects overtraining signals (rising resting HR, declining EF, high ACWR)
- Suggests recovery weeks when fatigue accumulates

---

## Analytics — 4-Tab Structure

Analytics page (`/analytics`) uses Recharts for all charts with animated transitions:

| Tab | Content | Charts |
|-----|---------|--------|
| **Overview** | Weekly volume, pace trends, ACWR | Area chart (distance), Line chart (pace), Gauge (ACWR) |
| **Performance** | Race predictor, VDOT history, PR timeline | Line chart (VDOT), Bar chart (PRs) |
| **Training Load** | TRIMP, ACWR, fatigue/fitness balance | Stacked area (acute vs chronic), Line (ACWR with safe zone) |
| **Body** | HR zones distribution, efficiency factor | Pie chart (zone time), Line (EF trend) |

### Runner Tools (in Analytics)

- **Race Predictor:** Predicts finish times for 5K/10K/HM/M/50K based on current VDOT + training data. Uses Riegel formula with adjustments for trail (elevation penalty)
- **VDOT Calculator:** Calculates VDOT from recent race results or best training efforts. Derives all pace zones from VDOT
- **GAP Calculator:** Grade-Adjusted Pace — normalizes pace for elevation. Uses Minetti cost-of-transport model: +10% per 1% uphill gradient, -6% per 1% downhill gradient

---

## Vite Configuration — Chunk Splitting

Performance optimization via manual chunk splitting in `vite.config.ts`:

```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
  'charts-vendor': ['recharts'],
  'animation-vendor': ['framer-motion'],
}
```

Separates large dependencies into independent chunks for better caching and parallel loading.

---

## Garmin Integration

### Workout Builder
Converts plan workouts to Garmin-compatible JSON:
- `ExecutableStepDTO` — single step (warmup, interval, cooldown)
- `RepeatGroupDTO` — repeat group (intervals)
- Pace targets for road, HR zones for trail

### Flow
```
Plan workout → garmin-workout-builder → Garmin JSON
    → upload_workout (MCP) → garminWorkoutId
    → schedule_workout (MCP, date) → on watch
```

---

## Strava Integration

### OAuth Flow
1. Frontend calls `stravaAuthUrl` Cloud Function
2. User authorizes on Strava
3. Redirect to `strava-callback.html` (bridge)
4. Bridge posts to `stravaCallback` Cloud Function
5. Tokens stored in `users/{userId}`

### Sync
- `stravaSync` fetches new activities since `lastSync`
- Filters: Run, TrailRun
- Calculates derived metrics (TRIMP, EF, GAP)
- Matches to plan (weekday + distance ±30% + elevation ±40%)

---

## Evidence-Based Training Rules

### TRIMP (Training Impulse)
```
TRIMP = duration(min) × HR_ratio × exp(1.92 × HR_ratio)
HR_ratio = (avgHR - restHR) / (maxHR - restHR)
```

### ACWR (Acute:Chronic Workload Ratio)
```
ACWR = TRIMP_7d / avg_TRIMP_28d
Safe zone: 0.8 - 1.3
```

### Adaptation Signals
| ACWR > 1.3 | Reduce volume 15-20% |
| ACWR < 0.8 | Gradual increase |
| HR drift > 10% | Reduce intensity |
| EF dropping 3+ weeks | Force recovery week |

### Volume Limits
- Max +10-15%/week (10% rule)
- 80% easy (Z1-Z2), 20% quality
- Recovery week every 3-4 weeks (70% volume)

### Tapering Protocols
- 5K: 1 week taper (65% volume)
- 10K: 2 weeks (70% → 55%)
- Half Marathon: 2 weeks (70% → 45%)
- Marathon: 3 weeks (80% → 60% → 45%)
- Ultra 50K: 3 weeks (75% → 55% → 35%)
- Trail Race: 2 weeks (70% → 45%, reduce D+ 50-60%)
