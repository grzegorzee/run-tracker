# RunTracker — Instrukcja Konfiguracji Google Cloud

## Spis treści

1. [Wymagania wstępne](#1-wymagania-wstępne)
2. [Firebase — Tworzenie projektu](#2-firebase--tworzenie-projektu)
3. [Firebase Auth — Google Sign-In](#3-firebase-auth--google-sign-in)
4. [Firestore Database](#4-firestore-database)
5. [Cloud Functions — Konfiguracja](#5-cloud-functions--konfiguracja)
6. [Strava API — Rejestracja aplikacji](#6-strava-api--rejestracja-aplikacji)
7. [Anthropic API (Claude)](#7-anthropic-api-claude)
8. [OpenAI API (Fallback)](#8-openai-api-openai-fallback)
9. [Environment Variables — Pełna konfiguracja](#9-environment-variables--pełna-konfiguracja)
10. [Deploy Cloud Functions](#10-deploy-cloud-functions)
11. [GitHub Pages — Deploy frontendu](#11-github-pages--deploy-frontendu)
12. [Weryfikacja — Checklist końcowy](#12-weryfikacja--checklist-końcowy)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Wymagania wstępne

### Zainstaluj na komputerze:

```bash
# Node.js 20+ (wymagane przez Cloud Functions)
node --version   # powinno być >= 20.0.0

# npm (przychodzi z Node.js)
npm --version

# Firebase CLI
npm install -g firebase-tools

# Zaloguj się do Firebase
firebase login

# Sprawdź logowanie
firebase projects:list
```

### Konta potrzebne:

| Konto | Link | Po co |
|-------|------|-------|
| Google Cloud / Firebase | https://console.firebase.google.com | Backend, Auth, DB, Functions |
| Strava Developer | https://www.strava.com/settings/api | OAuth integration |
| Anthropic | https://console.anthropic.com | Claude AI (primary) |
| OpenAI | https://platform.openai.com | GPT fallback |
| GitHub | https://github.com | Hosting (GitHub Pages) |

---

## 2. Firebase — Tworzenie projektu

### Krok 2.1: Utwórz projekt Firebase

1. Otwórz: https://console.firebase.google.com
2. Kliknij **"Utwórz projekt"** (Create a project)
3. Nazwa projektu: **`run-tracker-app`**
   - Firebase może dodać losowy suffix (np. `run-tracker-app-12345`) — to OK
   - Zanotuj **Project ID** — będzie potrzebny w wielu miejscach
4. **Google Analytics**: Wyłącz (nie potrzebujemy na start)
5. Kliknij **"Utwórz projekt"** i poczekaj ~30 sekund

### Krok 2.2: Upgrade na plan Blaze (Pay-as-you-go)

**OBOWIĄZKOWE** — Cloud Functions v2 wymagają planu Blaze.

1. W Firebase Console → ⚙️ (Settings) → **Usage and billing**
2. Kliknij **"Modify plan"** → Wybierz **Blaze (Pay as you go)**
3. Podaj kartę płatniczą
4. **Koszt:** Darmowy do ~100 userów, potem grosze

> ⚠️ Bez planu Blaze: Cloud Functions **nie zadziałają**. Firestore i Auth działają na Spark (darmowym), ale Functions v2 = Blaze only.

### Krok 2.3: Dodaj Web App

1. W Firebase Console → **Project Overview** → Kliknij ikonę **Web** (`</>`)
2. Nazwa: **RunTracker Web**
3. **NIE** zaznaczaj "Firebase Hosting" (używamy GitHub Pages)
4. Kliknij **"Zarejestruj aplikację"**
5. Pojawi się konfiguracja Firebase — **SKOPIUJ ją!**

Będzie wyglądać tak:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "run-tracker-app-12345.firebaseapp.com",
  projectId: "run-tracker-app-12345",
  storageBucket: "run-tracker-app-12345.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

**Zapisz te wartości** — trafią do `.env` w kroku 9.

---

## 3. Firebase Auth — Google Sign-In

### Krok 3.1: Włącz Google Provider

1. Firebase Console → **Authentication** → **Sign-in method**
2. Kliknij **"Google"** → **Włącz** (Enable)
3. **Support email**: Wybierz swój email
4. Kliknij **"Zapisz"** (Save)

### Krok 3.2: Authorized domains

Firebase Auth domyślnie pozwala na:
- `localhost`
- `run-tracker-app-12345.firebaseapp.com`

**Musisz dodać** GitHub Pages domain:

1. Authentication → **Settings** → **Authorized domains**
2. Kliknij **"Add domain"**
3. Dodaj: **`grzegorzee.github.io`**

> ⚠️ Bez tego: Google Sign-In pokaże błąd "auth/unauthorized-domain" na produkcji.

### Krok 3.3: OAuth consent screen (Google Cloud Console)

1. Otwórz: https://console.cloud.google.com
2. Wybierz projekt `run-tracker-app-12345`
3. Szukaj: **"OAuth consent screen"**
4. Typ: **External** (chyba że chcesz ograniczyć do organizacji)
5. Wypełnij:
   - App name: **RunTracker**
   - User support email: twój email
   - Developer contact: twój email
6. Scopes: domyślne (email, profile, openid)
7. Test users: dodaj swój email
8. Kliknij **"Publish app"** (gdy gotowy na produkcję)

> Dopóki app jest w trybie "Testing" — tylko test users mogą się logować. Jak opublikujesz — każdy z Google account.

---

## 4. Firestore Database

### Krok 4.1: Utwórz bazę danych

1. Firebase Console → **Firestore Database** → **"Create database"**
2. **Lokalizacja: `europe-west1` (Belgia)**

   > ⚠️ KRYTYCZNE: Musisz wybrać `europe-west1` bo Cloud Functions też są w `europe-west1`. Mieszanie regionów = latency + koszty.

3. **Mode: Production** (NIE test mode — mamy już reguły)
4. Kliknij **"Create"**

### Krok 4.2: Deploy reguł i indeksów

Z katalogu projektu:

```bash
cd "/Users/grzegorzjasionowicz/Documents/Baza Wiedzy/FIRMA/projekty/run_tracker"

# Ustaw aktywny projekt
firebase use run-tracker-app-12345

# Deploy reguł Firestore
firebase deploy --only firestore:rules

# Deploy indeksów Firestore
firebase deploy --only firestore:indexes
```

### Co robią reguły:

| Collection | Read | Write | Kto |
|-----------|------|-------|-----|
| `users/{userId}` | ✅ własny | ✅ własny | Użytkownik |
| `training_plans/{planId}` | ✅ własny | ✅ własny | Użytkownik |
| `strava_activities/{id}` | ✅ własny | ❌ (Cloud Functions only) | Tylko backend |
| `weekly_summaries/{id}` | ✅ własny | ❌ (Cloud Functions only) | Tylko backend |

### Co robią indeksy:

| Collection | Indeks | Query |
|-----------|--------|-------|
| `training_plans` | userId + status + createdAt DESC | Pobieranie aktywnego planu usera |
| `strava_activities` | userId + date DESC | Lista aktywności usera |
| `weekly_summaries` | userId + weekStartDate DESC | Podsumowania tygodniowe |

> 📝 Budowanie indeksów trwa 2-5 minut. Zanim przetestujesz queries — poczekaj.

---

## 5. Cloud Functions — Konfiguracja

### Krok 5.1: Zainstaluj zależności

```bash
cd "/Users/grzegorzjasionowicz/Documents/Baza Wiedzy/FIRMA/projekty/run_tracker/functions"
npm install
```

### Krok 5.2: Ustaw environment variables

Cloud Functions v2 używają **Cloud Run environment variables** (nie `functions.config()`).

**Metoda 1: Firebase CLI (zalecana)**

```bash
# Ustaw Strava credentials
firebase functions:secrets:set STRAVA_CLIENT_ID
# Wpisz: TWÓJ_CLIENT_ID z kroku 6

firebase functions:secrets:set STRAVA_CLIENT_SECRET
# Wpisz: TWÓJ_CLIENT_SECRET z kroku 6

firebase functions:secrets:set STRAVA_REDIRECT_URI
# Wpisz: https://grzegorzee.github.io/run-tracker/strava-callback.html

# Ustaw Anthropic API Key
firebase functions:secrets:set ANTHROPIC_API_KEY
# Wpisz: sk-ant-api03-... z kroku 7

# Ustaw OpenAI API Key (fallback)
firebase functions:secrets:set OPENAI_API_KEY
# Wpisz: sk-proj-... z kroku 8
```

**Metoda 2: Plik `.env` w functions/ (do lokalnego testowania)**

Utwórz plik `functions/.env`:

```bash
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abcdef1234567890
STRAVA_REDIRECT_URI=https://grzegorzee.github.io/run-tracker/strava-callback.html
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

> ⚠️ **NIGDY nie commituj `functions/.env` do gita!** Dodaj do `.gitignore`.

**Metoda 3: Google Cloud Console (GUI)**

1. https://console.cloud.google.com → **Secret Manager**
2. Utwórz secrety: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
3. Cloud Functions automatycznie je odczytają

### Krok 5.3: Dostosuj Cloud Functions do używania Secrets

W naszym kodzie funkcje odczytują `process.env.STRAVA_CLIENT_ID` itd. Żeby Firebase Secrets Manager podał je jako env vars, w deploy Cloud Functions trzeba dodać `--set-secrets` albo użyć konfiguracji w kodzie.

**Najprościej:** użyj `functions/.env` + `firebase deploy` — Firebase automatycznie czyta `.env` przy deploymencie i ustawia zmienne.

Alternatywnie, dodaj secrets do definicji funkcji (opcjonalne, dla lepszego bezpieczeństwa):

```typescript
export const stravaCallback = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    secrets: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET']
  },
  async (request) => { ... }
)
```

> Ale: to wymaga że sekrety są w Secret Manager, nie w .env.

### Krok 5.4: Sprawdź konfigurację

```bash
# Wylistuj sekrety
firebase functions:secrets:access STRAVA_CLIENT_ID

# Sprawdź konfigurację
firebase functions:config:get
```

---

## 6. Strava API — Rejestracja aplikacji

### Krok 6.1: Utwórz Strava API Application

1. Zaloguj się na Strava: https://www.strava.com
2. Otwórz: https://www.strava.com/settings/api
3. Kliknij **"Create an App"** (jeśli nie masz żadnej)

### Krok 6.2: Wypełnij formularz

| Pole | Wartość |
|------|---------|
| **Application Name** | `RunTracker` |
| **Category** | `Training` |
| **Club** | (puste) |
| **Website** | `https://grzegorzee.github.io/run-tracker/` |
| **Application Description** | `AI Running Coach with personalized training plans` |
| **Authorization Callback Domain** | `grzegorzee.github.io` |

> ⚠️ **Authorization Callback Domain** — TYLKO domena, bez `https://` i bez ścieżki!
>
> ✅ `grzegorzee.github.io`
> ❌ `https://grzegorzee.github.io/run-tracker/strava-callback.html`

### Krok 6.3: Zanotuj credentials

Po utworzeniu zobaczysz:

| Pole | Użycie |
|------|--------|
| **Client ID** | → `STRAVA_CLIENT_ID` w env |
| **Client Secret** | → `STRAVA_CLIENT_SECRET` w env |

### Krok 6.4: Redirect URI

Nasz redirect URI to:
```
https://grzegorzee.github.io/run-tracker/strava-callback.html
```

Ten URL musi:
1. Być pod domeną wpisaną w **Authorization Callback Domain** ✅
2. Być statycznym plikiem HTML (bridge do HashRouter) ✅
3. Być dostępny publicznie ✅

### Jak działa flow:

```
1. User klika "Połącz Stravę" →
2. Frontend wywołuje Cloud Function `stravaAuthUrl` →
3. Function zwraca URL Strava OAuth →
4. User jest przekierowany na strava.com/oauth/authorize →
5. User klika "Authorize" →
6. Strava redirectuje do: .../strava-callback.html?code=XXX&state=USER_ID →
7. Bridge HTML (strava-callback.html) przekierowuje do: /#/strava/callback?code=XXX →
8. React StravaCallback.tsx odczytuje code i wywołuje Cloud Function `stravaCallback` →
9. Function wymienia code na tokens i synchuje aktywności
```

---

## 7. Anthropic API (Claude)

### Krok 7.1: Utwórz klucz API

1. Otwórz: https://console.anthropic.com
2. Zarejestruj się / zaloguj
3. **API Keys** → **"Create Key"**
4. Nazwa: `RunTracker`
5. **Skopiuj klucz** (zaczyna się od `sk-ant-api03-...`)

### Krok 7.2: Doładuj konto

1. **Billing** → Dodaj kartę płatniczą
2. Doładuj minimum **$5** (wystarczy na setki generacji planów)

### Koszty:

| Funkcja | Model | Input/Output | Koszt ~1 wywołanie |
|---------|-------|-------------|-------------------|
| `generatePlan` | claude-sonnet-4-6 | ~2K/8K tokens | ~$0.05 |
| `analyzeWorkout` | claude-sonnet-4-6 | ~1K/2K tokens | ~$0.01 |
| `adaptivePlanner` | claude-sonnet-4-6 | ~2K/4K tokens | ~$0.03 |
| `weeklyDigest` | claude-sonnet-4-6 | ~1K/2K tokens | ~$0.01 |

**Koszt miesięczny per user:** ~$0.50-1.00 (przy 4 treningach/tydzień + weekly digest + adaptive co 3 dni)

---

## 8. OpenAI API (Fallback)

### Krok 8.1: Utwórz klucz API

1. Otwórz: https://platform.openai.com
2. **API Keys** → **"Create new secret key"**
3. Nazwa: `RunTracker`
4. Skopiuj klucz (zaczyna się od `sk-proj-...`)

### Krok 8.2: Doładuj konto

1. **Billing** → Dodaj minimum **$5**

> OpenAI jest fallback — używany TYLKO jeśli Claude API zwróci błąd. Normalnie kosztuje $0.

---

## 9. Environment Variables — Pełna konfiguracja

### 9.1: Frontend (`.env` w root projektu)

Utwórz plik `.env` w katalogu głównym `run_tracker/`:

```bash
# Firebase Config (z kroku 2.3)
VITE_FIREBASE_API_KEY=AIzaSyB...
VITE_FIREBASE_AUTH_DOMAIN=run-tracker-app-12345.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=run-tracker-app-12345
VITE_FIREBASE_STORAGE_BUCKET=run-tracker-app-12345.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456

# Auth — emaile które mogą się logować (rozdzielone przecinkami)
VITE_ALLOWED_EMAILS=twoj@email.com,znajomy@email.com

# Strava (Client ID — potrzebne do wyświetlania w logach, nie do OAuth)
VITE_STRAVA_CLIENT_ID=12345
```

> ⚠️ Prefiks `VITE_` jest **obowiązkowy** — Vite wystawia tylko zmienne z tym prefiksem.

### 9.2: Cloud Functions (`functions/.env`)

```bash
# Strava OAuth
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abcdef1234567890abcdef1234567890
STRAVA_REDIRECT_URI=https://grzegorzee.github.io/run-tracker/strava-callback.html

# AI — Primary
ANTHROPIC_API_KEY=sk-ant-api03-...

# AI — Fallback
OPENAI_API_KEY=sk-proj-...
```

### 9.3: Upewnij się że `.gitignore` zawiera:

```
.env
functions/.env
functions/.secret.local
```

---

## 10. Deploy Cloud Functions

### Krok 10.1: Zbuduj i zdeploy

```bash
cd "/Users/grzegorzjasionowicz/Documents/Baza Wiedzy/FIRMA/projekty/run_tracker"

# Upewnij się że jesteś na dobrym projekcie
firebase use run-tracker-app-12345

# Deploy TYLKO Cloud Functions
firebase deploy --only functions
```

### Krok 10.2: Sprawdź deploy

Po deploy zobaczysz:

```
✔  functions[generatePlan(europe-west1)] Successful create operation.
✔  functions[stravaAuthUrl(europe-west1)] Successful create operation.
✔  functions[stravaCallback(europe-west1)] Successful create operation.
✔  functions[stravaSync(europe-west1)] Successful create operation.
✔  functions[scheduledStravaSync(europe-west1)] Successful create operation.
✔  functions[analyzeWorkout(europe-west1)] Successful create operation.
✔  functions[adaptivePlanner(europe-west1)] Successful create operation.
✔  functions[triggerAdaptivePlanner(europe-west1)] Successful create operation.
✔  functions[weeklyDigest(europe-west1)] Successful create operation.
✔  functions[triggerWeeklyDigest(europe-west1)] Successful create operation.
✔  functions[suggestAdaptations(europe-west1)] Successful create operation.
```

### Krok 10.3: Sprawdź w Cloud Console

1. https://console.cloud.google.com → **Cloud Functions** (lub Cloud Run)
2. Powinno być **11 funkcji** w regionie `europe-west1`
3. Kliknij na dowolną → **Logs** → sprawdź czy nie ma błędów

### Krok 10.4: Deploy Firestore (rules + indexes)

```bash
firebase deploy --only firestore
```

### Krok 10.5: Wszystko naraz

```bash
firebase deploy --only functions,firestore
```

---

## 11. GitHub Pages — Deploy frontendu

### Krok 11.1: Utwórz repo na GitHub

```bash
cd "/Users/grzegorzjasionowicz/Documents/Baza Wiedzy/FIRMA/projekty/run_tracker"

# Inicjalizuj git (jeśli nie ma)
git init
git add .
git commit -m "Initial commit: RunTracker v0.1.0"

# Utwórz repo na GitHub
gh repo create grzegorzee/run-tracker --public --source=. --push
```

### Krok 11.2: Deploy na GitHub Pages

```bash
# Build + deploy
npm run deploy
```

To uruchamia:
1. `npm run build` → TypeScript + Vite → `dist/`
2. `gh-pages -d dist` → Push `dist/` na branch `gh-pages`

### Krok 11.3: Sprawdź GitHub Pages settings

1. GitHub → repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **`gh-pages`** / **`/ (root)`**
4. URL: `https://grzegorzee.github.io/run-tracker/`

### Krok 11.4: Sprawdź czy `strava-callback.html` jest na miejscu

```bash
curl -s https://grzegorzee.github.io/run-tracker/strava-callback.html | head -5
```

Powinno zwrócić HTML bridge. Jeśli 404 — sprawdź czy plik jest w `public/strava-callback.html`.

---

## 12. Weryfikacja — Checklist końcowy

### Test 1: Strona się ładuje
- [ ] Otwórz `https://grzegorzee.github.io/run-tracker/`
- [ ] Powinien pojawić się ekran logowania (Login.tsx)

### Test 2: Google Sign-In działa
- [ ] Kliknij "Zaloguj przez Google"
- [ ] Popup Google → wybierz konto z `VITE_ALLOWED_EMAILS`
- [ ] Powinno przekierować na `/onboarding`

### Test 3: Firestore zapisuje dane
- [ ] Firebase Console → Firestore → kolekcja `users`
- [ ] Powinien pojawić się dokument z Twoim uid

### Test 4: Onboarding + AI generacja
- [ ] Przejdź cały wizard onboarding
- [ ] Na końcu → "Generuję plan treningowy..."
- [ ] Sprawdź logi: Cloud Console → Cloud Functions → `generatePlan` → Logs
- [ ] Firestore → `training_plans` → powinien pojawić się nowy plan

### Test 5: Dashboard z planem
- [ ] Po generacji → Dashboard z hero metrykami
- [ ] Widoczne: tydzień, km, treningi

### Test 6: Strava OAuth
- [ ] Settings → "Połącz" obok Strava
- [ ] Przekierowanie na strava.com → Authorize
- [ ] Redirect na strava-callback.html → /#/strava/callback
- [ ] "Strava połączona!" → auto-redirect do Settings
- [ ] Settings → "Połączono jako [Twoje imię]"

### Test 7: Strava Sync
- [ ] Settings → przycisk "Sync"
- [ ] Sprawdź Firestore → `strava_activities` — powinny pojawić się Twoje biegi

### Test 8: Analytics
- [ ] Tab Narzędzia → Race Predictor → wpisz czas 5K → predykcje się pojawiają
- [ ] Tab Przegląd → wykresy (jeśli jest data Strava)

### Test 9: PWA
- [ ] Chrome → DevTools → Application → Service Workers → zarejestrowany
- [ ] Manifest → poprawne ikony i nazwy

---

## 13. Troubleshooting

### Problem: "auth/unauthorized-domain"

**Przyczyna:** GitHub Pages domena nie jest dodana do authorized domains.

**Rozwiązanie:**
1. Firebase Console → Authentication → Settings → Authorized domains
2. Dodaj: `grzegorzee.github.io`

---

### Problem: Cloud Functions 403 / CORS error

**Przyczyna:** Frontend wywołuje Functions z innej domeny niż Firebase.

**Rozwiązanie:** Cloud Functions v2 z `onCall` automatycznie obsługują CORS. Jeśli problem persists:

1. Sprawdź czy Functions są w `europe-west1` (muszą pasować do `getFunctions(app, 'europe-west1')`)
2. Sprawdź czy `firebase.ts` w froncie ma: `getFunctions(app, 'europe-west1')`

---

### Problem: Strava callback → "Brak kodu autoryzacji"

**Przyczyna:** Bridge HTML nie przekierowuje poprawnie.

**Rozwiązanie:**
1. Sprawdź `public/strava-callback.html` — musi redirect na `/#/strava/callback`
2. Sprawdź czy plik jest w `dist/` po build: `ls dist/strava-callback.html`
3. Upewnij się że plik jest w `public/` (Vite kopiuje z public/ do dist/)

---

### Problem: "Strava token exchange failed"

**Przyczyna:** Zły Client Secret lub redirect URI nie pasuje.

**Rozwiązanie:**
1. Sprawdź `STRAVA_CLIENT_SECRET` w `functions/.env` — musi być DOKŁADNIE taki jak na strava.com/settings/api
2. Sprawdź `STRAVA_REDIRECT_URI` — musi być: `https://grzegorzee.github.io/run-tracker/strava-callback.html`
3. Strava "Authorization Callback Domain" musi być: `grzegorzee.github.io`

---

### Problem: AI generation timeout / error

**Przyczyna:** Brak API key lub limit exceeded.

**Rozwiązanie:**
1. Cloud Console → Cloud Functions → `generatePlan` → Logs
2. Szukaj: "ANTHROPIC_API_KEY not set" → dodaj key do `functions/.env`
3. Szukaj: "rate_limit" → poczekaj chwilę lub upgrade plan
4. Szukaj: "timeout" → funkcja ma 120s limit, jeśli AI odpowiada wolno → retry

---

### Problem: Firestore "Missing or insufficient permissions"

**Przyczyna:** Reguły nie pozwalają na operację.

**Rozwiązanie:**
1. Sprawdź czy deploy reguł się udał: `firebase deploy --only firestore:rules`
2. `strava_activities` i `weekly_summaries` mają `allow write: if false` — frontend NIE MOŻE do nich pisać (to jest OK, Cloud Functions piszą)
3. Sprawdź czy `userId` w dokumencie odpowiada `auth.uid`

---

### Problem: "Missing index" w Firestore

**Przyczyna:** Indeksy nie zostały zdeployowane.

**Rozwiązanie:**
```bash
firebase deploy --only firestore:indexes
```
Poczekaj 2-5 minut na zbudowanie indeksów.

---

### Problem: Cloud Functions deploy fails — "build error"

**Przyczyna:** Brakujące zależności lub TypeScript error.

**Rozwiązanie:**
```bash
cd functions
npm install
npx tsc --noEmit   # sprawdź błędy lokalniecnpm run build       # pełny build
```

---

### Problem: GitHub Pages → 404 na refresh

**Przyczyna:** Normalne zachowanie HashRouter — GitHub Pages nie serwuje SPA rewrites.

**Rozwiązanie:** Nic nie trzeba robić! Używamy `HashRouter` (`/#/dashboard`) — to działa na GitHub Pages bez konfiguracji. Jeśli URL nie ma `#` — sprawdź routing w App.tsx.

---

### Logi — gdzie szukać

| Co | Gdzie |
|----|-------|
| Frontend errors | Chrome DevTools → Console |
| Auth errors | Firebase Console → Authentication → Logs |
| Cloud Functions logs | Cloud Console → Cloud Run → Logs (lub `firebase functions:log`) |
| Firestore operations | Firebase Console → Firestore → (Rules Playground do testowania) |
| Strava API | Cloud Functions logs → szukaj "strava" |

### Przydatne komendy

```bash
# Logi Cloud Functions (real-time)
firebase functions:log --only stravaCallback

# Emulator lokalny (testowanie bez deploy)
firebase emulators:start --only functions,firestore

# Sprawdź aktywny projekt
firebase projects:list
firebase use

# Redeploy jednej funkcji
firebase deploy --only functions:stravaCallback
```

---

## Quick Reference — Komendy

```bash
# === DEVELOPMENT ===
cd "/Users/grzegorzjasionowicz/Documents/Baza Wiedzy/FIRMA/projekty/run_tracker"
npm run dev                              # Frontend dev server

# === DEPLOY ===
npm run deploy                           # Frontend → GitHub Pages
firebase deploy --only functions         # Cloud Functions
firebase deploy --only firestore         # Firestore rules + indexes
firebase deploy --only functions,firestore  # Oba naraz

# === DEBUG ===
firebase functions:log                   # Logi Functions
firebase emulators:start                 # Emulator lokalny
npx tsc --noEmit                        # TypeScript check (frontend)
cd functions && npx tsc --noEmit        # TypeScript check (functions)
```
