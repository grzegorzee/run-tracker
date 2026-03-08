# RunTracker — Log Decyzji

## 2026-03-08: Inicjalizacja projektu

### D1: Multi-user produkt
**Decyzja:** Firebase Auth + per-user data isolation (userId na wszystkim)
**Uzasadnienie:** Sprawdzony pattern z Strength Save, skalowalny, bezpieczny

### D2: AI — Claude (Anthropic) jako primary
**Decyzja:** Claude claude-sonnet-4-6 (server-side) + OpenAI GPT jako fallback
**Uzasadnienie:** Lepsza jakość generacji planów, Claude lepiej rozumie kontekst biegowy

### D3: Hosting — GitHub Pages
**Decyzja:** GitHub Pages + HashRouter + bridge HTML
**Uzasadnienie:** Darmowy, sprawdzony pattern z Strength Save, `npm run deploy`

### D4: Nazwa — RunTracker
**Decyzja:** `run-tracker` jako repo/project ID
**Uzasadnienie:** Krótkie, jednoznaczne, łatwe do zapamiętania

### D5: Design — Premium dark-first
**Decyzja:** Tesla/Apple level, dark mode jako DOMYŚLNY, butelkowa zieleń
**Uzasadnienie:** Premium feel dla biegaczy, lepszy kontrast na danych treningowych

### D6: Trail running + tapering jako core
**Decyzja:** Road + trail od MVP, tapering protocols per dystans
**Uzasadnienie:** Differentiator vs konkurencja (Runna/TrainingPeaks), real need

### D7: Adaptive Rolling Planning
**Decyzja:** Statyczne fazy (macroStructure) + dynamiczne treningi (rolling 3 dni)
**Uzasadnienie:** Plan adaptuje się do realnej formy, nie dezaktualizuje się

### D8: Garmin MCP integration
**Decyzja:** Treningi uploadowane bezpośrednio na zegarek via Garmin MCP
**Uzasadnienie:** Seamless UX — plan → zegarek → bieg → Strava → feedback

### D9: Fonty premium
**Decyzja:** Satoshi (headings) + Plus Jakarta Sans (body) + Space Grotesk (metrics)
**Uzasadnienie:** Nowoczesne, czytelne, premium look, self-hosted dla performance

### D10: Derived metrics (code-based, nie AI)
**Decyzja:** TRIMP, ACWR, HR drift, EF obliczane w kodzie, nie przez AI
**Uzasadnienie:** Szybsze, tańsze, deterministyczne, research-based formuły

---

## 2026-03-08: CZĘŚĆ 2 + CZĘŚĆ 3 — Completion

### D11: Adaptive planner — rolling 7-day (zmiana z 3-day)
**Decyzja:** `adaptivePlanner` generuje treningi na 7 dni zamiast 3 dni
**Uzasadnienie:** Na prośbę użytkownika. 7-dniowy cykl lepiej pasuje do tygodniowej periodyzacji treningu (hard/easy days, long run w weekend, recovery week co 3-4 tyg). Mniej częste wywołania AI = niższy koszt

### D12: Strava OAuth — patterns z Strength Save
**Decyzja:** Skopiowano battle-tested Strava OAuth patterns z projektu Strength Save (bridge HTML, Cloud Functions, token refresh)
**Uzasadnienie:** Sprawdzony, działający pattern. Nie wymyślamy koła na nowo — ten sam flow (authUrl → Strava → bridge → callback → tokens) działa produkcyjnie w Strength Save

### D13: Chunk splitting — Vite manualChunks
**Decyzja:** Dodano chunk splitting: React, Firebase, Recharts, Framer Motion jako osobne chunki
**Uzasadnienie:** Performance — osobne chunki cache'ują się niezależnie, równoległy download, mniejszy initial bundle. Recharts i Framer Motion to duże biblioteki (~200KB+ każda)

### D14: Weekly digest — Monday 8:00 CET
**Decyzja:** `triggerWeeklyDigest` uruchamiany przez Cloud Scheduler w poniedziałek o 8:00 CET
**Uzasadnienie:** Poniedziałek rano = naturalny moment na podsumowanie minionego tygodnia treningowego. Biegacz dostaje insights przed planowaniem nowego tygodnia

### D15: suggestAdaptations — auto-update pace zones
**Decyzja:** `suggestAdaptations` automatycznie aktualizuje pace zones gdy biegacz konsekwentnie biegnie szybciej niż aktualne strefy (3+ tygodnie trendu)
**Uzasadnienie:** Biegacze poprawiający formę szybko wyrastają ze stref tempa. Ręczna aktualizacja = friction. Auto-update na bazie VDOT progression zapewnia że treningi zawsze mają odpowiednią intensywność
