# Alliance Supply Command

Multi-base inventory, requisitions and deployment logistics system for the Rebel Alliance — built as a Master's degree final project (Django + React), with the backend designed to hold up under real technical scrutiny: atomic transactions, row-level locking to prevent overselling stock under concurrent requests, an append-only audit ledger, role-based permissions, and a tested service layer.

## El concepto

Sos parte del equipo de logística de una base de la Alianza Rebelde. Cada base (Yavin 4, Hoth...)
tiene su propio inventario de piezas de nave, armas y suministros médicos. Ese material llega por
**requisiciones** a proveedores y contactos simpatizantes, se guarda como **stock** en la base, y
sale por **órdenes de despliegue** hacia los escuadrones que lo necesitan en el campo — cada
movimiento queda registrado en un ledger, porque en plena guerra no te podés dar el lujo de perder
la cuenta de las municiones. Alliance Supply Command es el sistema que lleva ese control de punta a
punta: qué hay, dónde está, quién lo pidió, y a dónde fue.

## Consignas del Proyecto Final de Máster

> **ENTREGA DE PROYECTO FINAL — Máster en Desarrollo Full Stack**
>
> El Proyecto Final de Máster (PFM) representa la culminación del programa formativo. Su objetivo
> es que el alumno demuestre haber adquirido las competencias técnicas y metodológicas necesarias
> para desarrollar, documentar y desplegar una aplicación web funcional, integrando tanto el
> backend (Django) como elementos del frontend (React u otra tecnología).
>
> **Objetivos generales**
> - Aplicar los conocimientos adquiridos en backend con Django y frontend con React, aunque el
>   proyecto principal se base en Django.
> - Desarrollar una aplicación web completa, con flujo real de datos y despliegue operativo.
> - Mostrar la capacidad de análisis, diseño, desarrollo, documentación y defensa técnica del trabajo.
> - Comprender cómo las herramientas aprendidas pueden aportar valor real y eficiencia en un
>   entorno profesional.
> - Demostrar autonomía técnica y responsabilidad profesional en el ciclo de desarrollo completo.

**Enlace del proyecto desplegado:** [https://proyecto-final-conquerblocks-1.onrender.com](https://proyecto-final-conquerblocks-1.onrender.com) &middot; **API:** [https://proyecto-final-conquerblocks.onrender.com/api/v1](https://proyecto-final-conquerblocks.onrender.com/api/v1) — ver
[Despliegue](#despliegue) para cómo está armado y por qué.

## Screenshots

| | |
|---|---|
| ![Login](docs/screenshots/01-login.jpg) | ![Dashboard](docs/screenshots/02-dashboard.jpg) |
| ![Components](docs/screenshots/03-components.jpg) | ![Stock & Ledger](docs/screenshots/04-stock-ledger.jpg) |
| ![Requisitions](docs/screenshots/05-requisitions.jpg) | ![Deployment Orders with manifest](docs/screenshots/06-deployment-orders.jpg) |

The deployment orders screenshot shows a `DISPATCHED` order with its manifest already
rendered (`MAN-DEP-DEMO-001.pdf`, generated asynchronously by the Celery worker — see
[Async work](#async-work-celery--redis) below).

## Why this domain

Instead of a portfolio site or a simple CRUD, this models something with real business rules: several bases hold stock of the same components, requisitions bring stock in from suppliers, deployment orders send it out to squadrons, and every unit that moves is logged. That combination — multi-location stock, concurrency-safe transactions, and reporting — is what actually distinguishes a backend project with depth from a beginner CRUD.

## Domain mapping

| System concept        | Rebel Alliance flavor                                   |
|------------------------|-----------------------------------------------------------|
| Warehouse              | **Base** (Yavin 4, Hoth, ...)                              |
| Product                | **Component** (ship parts, weapons, medical supplies)      |
| Supplier                | **Supplier** (sympathetic contacts, smuggler networks)      |
| Purchase order          | **Requisition** — received into a Base, credits stock      |
| Customer                | **Squadron**                                                |
| Sales order              | **Deployment Order** — dispatched from a Base, debits stock |
| Invoice                  | **Manifest**                                                 |
| Inventory ledger          | **Stock Movement** (append-only, one row per unit change)   |

## Data model

```mermaid
erDiagram
    BASE ||--o{ STOCK : holds
    COMPONENT ||--o{ STOCK : "tracked as"
    STOCK {
        int quantity "DB CHECK quantity >= 0"
    }
    BASE ||--o{ REQUISITION : receives
    SUPPLIER ||--o{ REQUISITION : fulfills
    REQUISITION ||--|{ REQUISITION_LINE : contains
    COMPONENT ||--o{ REQUISITION_LINE : "line item"

    BASE ||--o{ DEPLOYMENT_ORDER : dispatches
    SQUADRON ||--o{ DEPLOYMENT_ORDER : receives
    DEPLOYMENT_ORDER ||--|{ DEPLOYMENT_ORDER_LINE : contains
    COMPONENT ||--o{ DEPLOYMENT_ORDER_LINE : "line item"
    DEPLOYMENT_ORDER ||--|| MANIFEST : produces

    BASE ||--o{ STOCK_MOVEMENT : "logged at"
    COMPONENT ||--o{ STOCK_MOVEMENT : "unit change of"
```

Every arrow into `STOCK_MOVEMENT` is one append-only row — nothing ever updates or
deletes a movement, it's the audit trail behind every quantity shown anywhere else
in the app. `REQUISITION` credits stock (in), `DEPLOYMENT_ORDER` debits it (out); both
go through `logistics/services.py`, never through a direct model save.

## Architecture

```mermaid
graph TD
    subgraph Client
        A[React SPA<br/>Vite + TypeScript]
    end
    subgraph Backend
        B[Django REST API<br/>gunicorn]
        C[(PostgreSQL)]
        D[(Redis)]
        E[Celery worker]
        F[Celery beat]
    end

    A -- "JWT auth, REST/JSON" --> B
    B -- "reads/writes" --> C
    B -- "enqueues tasks<br/>on transaction.on_commit" --> D
    D -- "delivers jobs" --> E
    E -- "reads/writes" --> C
    F -- "schedules hourly digest" --> D
    E -- "sends email" --> G[SMTP]
```

```
backend/
  config/settings/    base.py, dev.py, prod.py, test.py
  accounts/           custom User model with roles (Command, Quartermaster, Technician, Dispatcher)
  logistics/
    models.py         data model + DB-level constraints (CheckConstraint: stock >= 0)
    services.py        <- business logic lives here, not in views or models
    views.py           DRF viewsets call services.py, never touch Stock.quantity directly
    permissions.py     role-based permission classes
    tests/              unit tests + a real concurrency test (see below)
    management/commands/seed_demo.py
```

The **services.py / views.py split** is the same shape as a Controller → Service → Repository
layered backend in any stack — the Java/Spring Boot companion project mirrors it 1:1, which is the
point: the architecture is the transferable skill, Django is just this project's framework.

### The concurrency guarantee

`logistics/services.py::dispatch_order` wraps the whole operation in
`transaction.atomic()` and locks the `Stock` rows it touches with
`select_for_update()`. Two requests racing to dispatch the same limited stock
can't both succeed — the second one blocks until the first commits, re-reads
the now-lower quantity, and is correctly rejected if there isn't enough left.

This isn't just asserted in a docstring — `logistics/tests/test_concurrency.py`
proves it by firing two real dispatches from two threads (two separate DB
connections) against the same stock row and asserting exactly one wins and
stock never goes negative:

```bash
cd backend && python -m pytest logistics/tests/test_concurrency.py -v
```

## Frontend

`frontend/` is a React + TypeScript (Vite) app: React Router for navigation, TanStack Query for
server state/caching, Axios with an interceptor that refreshes the JWT on 401, and a small
role-aware sidebar (Requisitions is hidden for Technicians, Deployment Orders for Quartermasters,
etc. — mirroring the backend's `permissions.py`, not replacing it). Styling is hand-written SCSS,
mobile-first, no component library, in a dark "holo-terminal" theme.

```
frontend/src/
  api/           axios client + JWT refresh, typed endpoint functions, error helpers
  context/       AuthContext (login/logout, current user + role)
  components/    Layout (topbar + responsive sidebar), route guard, shared UI bits
  pages/         one page per resource (Dashboard, Components, Stock & Ledger,
                 Requisitions, Deployment Orders, Bases, Suppliers, Squadrons)
```

Every page talks to the real API — there's no mocked data. Requisitions and Deployment Orders
render their actual lifecycle (`DRAFT → SUBMITTED → RECEIVED` / `DRAFT → CONFIRMED → DISPATCHED`)
with the action buttons calling the same `submit/receive/confirm/dispatch` endpoints exercised by
the backend tests.

### UI polish

A few things that separate "the API works" from "this feels like a finished app":
a hand-rolled SVG bar chart on the dashboard (`components/InventoryValueChart.tsx`
— no charting library, two bars from the valuation report didn't justify one),
loading skeletons instead of a bare "Loading..." line, toast confirmations on
every create/submit/receive/confirm/dispatch action so the user isn't left
guessing whether something worked, and real pagination (`components/Pagination.tsx`)
on the three lists most likely to outgrow one page — Requisitions, Deployment
Orders, and the Stock Movement ledger — instead of silently showing only the
first 20 rows forever. Requisitions and Deployment Orders also now show a
proper "you don't have permission to view this" banner instead of a silently
empty table when a role without access hits the URL directly (DRF was already
returning the right 403; the frontend just wasn't reading it).

### Filtering & search

`django-filter` and DRF's `SearchFilter` were already on the backend (`filterset_fields` /
`search_fields` on the viewsets) from early on, but nothing in the UI used them — every list
just showed everything. Requisitions and Deployment Orders now have a status `<select>`
(`?status=SUBMITTED`), Stock & Ledger has a base `<select>` that filters both the stock table
and the movement ledger at once, and Components has a debounced (300ms) search box over SKU/name
so it doesn't fire a request on every keystroke. Changing a filter resets pagination back to
page 1 — otherwise "page 3 of the filtered list" can silently be empty.

### Frontend tests

Vitest + React Testing Library, 16 tests across 5 files: the pure error-parsing helper
(`api/errors.ts`), a presentational component (`StatusBadge`), the route guard
(`ProtectedRoute` — loading / redirect / authenticated states), the login form (submits
credentials, surfaces a failed-login error, redirects an already-logged-in user), and
`AuthContext` itself (login stores the JWT pair and loads the profile, logout clears it,
a stale/invalid stored token gets cleared instead of leaving the app stuck). Nothing here
hits a real backend — `api/endpoints.ts` and `AuthContext` are mocked at the module
boundary with `vi.mock`, so the tests run in milliseconds and don't need Docker up.

```bash
cd frontend && npm test          # vitest run -- CI mode, exits after one pass
cd frontend && npm run test:watch # interactive, reruns on file change
```

## Async work (Celery + Redis)

Two things happen off the request/response cycle, both wired through `logistics/tasks.py`:

```mermaid
sequenceDiagram
    participant U as Browser (React)
    participant V as DeploymentOrderViewSet
    participant S as services.dispatch_order
    participant DB as PostgreSQL
    participant W as Celery worker

    U->>V: POST /deployment-orders/{id}/dispatch/
    V->>S: dispatch_order(order)
    activate S
    S->>DB: BEGIN transaction.atomic()
    S->>DB: select_for_update() on Stock rows
    S->>DB: debit stock, create Manifest row
    S->>DB: COMMIT
    Note over S,DB: transaction.on_commit(...) fires only<br/>after the COMMIT actually lands
    S-->>W: generate_manifest_pdf.delay(manifest.id)
    deactivate S
    V-->>U: 200 OK (manifest.pdf_ready = false)

    loop every 1.5s until ready
        U->>V: GET /manifests/?order={id}
        V-->>U: pdf_ready: false
    end

    W->>DB: fetch Manifest, render PDF (ReportLab)
    W->>DB: save pdf_file, pdf_ready = true
    U->>V: GET /manifests/?order={id}
    V-->>U: pdf_ready: true, download link
```

- **Manifest PDF generation.** `dispatch_order` in `services.py` creates the `Manifest` row
  synchronously (it's part of the same DB transaction as the stock debit), but the PDF itself
  is rendered in a Celery worker via `generate_manifest_pdf.delay(manifest.id)` — the dispatch
  API call returns immediately without waiting on ReportLab. The frontend polls
  `GET /manifests/?order=<id>` until `pdf_ready` flips `true`, so the deployment orders table
  shows "Rendering manifest..." and then swaps in a download link on its own, no page refresh.
- **Low-stock digest.** `send_low_stock_digest` runs hourly via Celery Beat
  (`CELERY_BEAT_SCHEDULE` in `settings/base.py`), emails Alliance Command a list of every
  component at or below its minimum stock, and sends nothing when there's nothing to report.

The tricky part worth knowing for the defense: `generate_manifest_pdf.delay(...)` is called
inside `transaction.on_commit(...)`, not directly. `dispatch_order` runs inside
`transaction.atomic()`; if the task were enqueued immediately, a fast enough Celery worker
(a separate process, separate DB connection) could try to fetch the `Manifest` row *before*
the transaction that created it has actually committed, and fail. `on_commit` defers the
`.delay()` call until Django knows the row is really there.

```bash
cd backend && python -m pytest logistics/tests/test_tasks.py -v   # runs tasks synchronously, no broker needed
```

Locally without Docker: `celery -A config worker -l info` and, in another shell,
`celery -A config beat -l info` (needs `redis-server` running and `CELERY_TASK_ALWAYS_EAGER=False`,
which is the default outside tests). In dev, `EMAIL_BACKEND` is the console backend, so the
low-stock digest just prints to the worker's log instead of sending real mail.

## End-to-end test (Playwright)

Everything above is verified in isolation: backend service functions against a real DB,
frontend components against a mocked API. Neither proves the two actually work *together* —
that the React form sends what the serializer expects, that the JWT interceptor survives a
page navigation, that the Celery worker really produces a file the browser can download. `e2e/`
has exactly one test for that: it logs in as `command`, creates a deployment order, confirms
and dispatches it, waits for the frontend to poll the manifest into existence, and downloads
the resulting PDF to check the first bytes are `%PDF-`. One test, not a suite — the unit tests
already cover the branching logic; this one only has to prove the seams hold.

It's what caught the one real bug in this project that no unit test did: `Manifest.number` is
built as `f"MAN-{order.number}"`, but the column was sized for the manifest number alone
(`max_length=20`), so a realistic order number (`E2E-1755000000000`, 18 chars) overflowed it and
the dispatch endpoint returned a 500. The fixture data every unit test used (`DEP-0001`) was
short enough to never trip it. Fixed in `logistics/models.py` + migration `0003`, with a
regression test added alongside the existing ones in `test_services.py`.

```bash
cd e2e && npm install
# stack must already be running and freshly seeded (docker compose up -d, then seed_demo)
npm test
```

Runs against `http://localhost:5173` by default (`E2E_BASE_URL` to point elsewhere). It's not
wired into CI — that would mean standing up Postgres, Redis, the backend, Celery and the
frontend build inside a GitHub Actions job just to run one test, which is more infrastructure
than a single smoke test earns; it's meant to be run locally before a release the way you'd
smoke-test a deploy by hand.

## Running it locally

```bash
cp backend/.env.example backend/.env     # adjust if needed
cp frontend/.env.example frontend/.env
docker compose up --build
docker compose exec backend python manage.py seed_demo
```

- Frontend: `http://localhost:5173/`
- API root: `http://localhost:8000/api/v1/`
- Swagger UI: `http://localhost:8000/api/v1/docs/`
- Admin: `http://localhost:8000/admin/`
- Demo users (after `seed_demo`): `command` / `quartermaster` / `dispatcher`, password `RebelYell123!`

Running the frontend outside Docker during development: `cd frontend && npm install && npm run dev`
(needs the backend running separately on `:8000`, CORS is already open for `localhost:5173` in `dev.py`).

> **This isn't a static HTML/CSS site** — opening `frontend/index.html` directly, or with something
> like VS Code's "Go Live" (Live Server), will show a blank page. `index.html` points at
> `/src/main.tsx`, which only compiles and serves correctly through Vite's dev server (`npm run dev`)
> or as a built bundle (`npm run build` → serve `frontend/dist/`). Same for the backend: it's a
> Django + Postgres API, not something a static file server can run. Use the commands above.

## Despliegue

La entrega del PFM pide una URL pública, así que el proyecto está desplegado en servicios con
plan gratuito permanente (sin tarjeta, sin trial que caduca): **Render** para el backend
(Django/gunicorn, plan Free) y el frontend (sitio estático, build de React), y **Neon** para
Postgres. Es un stack distinto al que enseña el módulo de Despliegue del máster (droplet de
DigitalOcean + CloudPanel), elegido puntualmente porque no había presupuesto disponible para un
droplet de pago — el resto del razonamiento (por qué esta combinación y no otra) está en
[Decisiones técnicas](#decisiones-técnicas).

### La pieza que cambia: Celery sin worker permanente

El plan gratuito de Render no ofrece un proceso de fondo persistente (solo "Web Services" que se
duermen a los 15 minutos sin tráfico), así que no hay dónde correr un worker de Celery real ni
Celery Beat. En vez de quitar Celery del proyecto, se lo dejó intacto y se cambió únicamente
**cómo se dispara**, con dos ajustes ya presentes en el código (nada de esto afecta a Docker
local, que sigue usando el worker y Beat reales):

- **Generación del PDF del manifiesto**: `config/settings/prod.py` fija
  `CELERY_TASK_ALWAYS_EAGER=True` por variable de entorno. Con eso, cada `.delay()` (ver
  `services.dispatch_order`) corre de forma síncrona, en el mismo proceso, en vez de mandarse a un
  broker Redis inexistente. Además, `ManifestViewSet.pdf` (nuevo) no depende de que el PDF siga
  en disco -- lo re-genera en cada descarga a partir de los datos del manifiesto
  (`render_manifest_pdf` es una función pura), porque el disco del plan gratuito de Render no está
  garantizado entre reinicios.
- **Digest horario de stock bajo**: sin Celery Beat corriendo, nada dispara la tarea programada.
  `logistics.views.LowStockDigestCronView` (nuevo, `POST /api/v1/internal/run-low-stock-digest/`,
  protegido con un secreto compartido) hace ese disparo posible por HTTP; un cron externo y
  gratuito (GitHub Actions, ver abajo) lo llama una vez por hora.

### Cómo está armado

1. **Neon** (Postgres gratis, sin caducar): un proyecto, con `DB_NAME` / `DB_USER` / `DB_PASSWORD`
   / `DB_HOST` extraídos de la cadena de conexión que da Neon (formato
   `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`) — `config/settings/prod.py` ya pide
   `sslmode=require`, que es lo que exige Neon.
2. **Render → New → Web Service** (backend): conectado al repo de GitHub, *Root Directory*:
   `backend`. *Build Command*:
   `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`.
   *Start Command*: `gunicorn config.wsgi:application`. Variables de entorno: `DJANGO_SETTINGS_MODULE=config.settings.prod`,
   `SECRET_KEY` (larga y aleatoria), `ALLOWED_HOSTS` (el dominio `.onrender.com` que asigna Render),
   `CORS_ALLOWED_ORIGINS` (el dominio del sitio estático del paso 3), `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT=5432`
   (de Neon), `CELERY_TASK_ALWAYS_EAGER=True`, `CRON_SECRET` (otra cadena aleatoria), `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`,
   `DEFAULT_FROM_EMAIL`, `ALLIANCE_COMMAND_EMAIL`. Plan: **Free**.
3. **Render → New → Static Site** (frontend): mismo repo, *Root Directory*: `frontend`. *Build
   Command*: `npm ci && npm run build`. *Publish Directory*: `dist`. Variable de entorno:
   `VITE_API_URL` apuntando a la URL del backend del paso 2 (ej.
   `https://alliance-supply-api.onrender.com/api/v1`). Regla de *Redirects/Rewrites*: `/*` → `/index.html`
   (rewrite), imprescindible para que las rutas de React Router funcionen al entrar directo o
   refrescar la página.
4. **GitHub Actions** (`.github/workflows/cron.yml`, contenido más abajo): dos secretos del repo
   (`Settings → Secrets and variables → Actions`), `RENDER_API_URL` (la URL del paso 2, sin barra
   final) y `CRON_SECRET` (el mismo valor que en el paso 2). El workflow hace ping cada 10 minutos
   para que el backend no se termine de dormir del todo, y dispara el digest una vez por hora.

```yaml
name: Free-tier keep-warm & digest cron

on:
  schedule:
    - cron: "*/10 * * * *"  # keep-warm ping
    - cron: "5 * * * *"     # low-stock digest, once an hour
  workflow_dispatch: {}      # allows a manual run from the Actions tab

jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - name: Ping backend (Render free tier sleeps after 15 min idle)
        run: curl -sS --max-time 60 "${{ secrets.RENDER_API_URL }}/api/v1/schema/" || true

      - name: Trigger low-stock digest (hourly slot, or manual run)
        if: github.event.schedule == '5 * * * *' || github.event_name == 'workflow_dispatch'
        run: |
          curl -sS --max-time 60 -X POST \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.RENDER_API_URL }}/api/v1/internal/run-low-stock-digest/"
```

### Qué esperar

El backend gratuito se duerme sin tráfico y tarda ~1 minuto en despertar la primera vez que
alguien entra después de un rato inactivo — no es una caída, y el ping de GitHub Actions cada 10
minutos lo mantiene despierto la mayor parte del tiempo durante el período de revisión. El sitio
estático del frontend no se duerme nunca (es solo archivos servidos directo). La base de Neon es
gratuita para siempre, sin límite de 30 días como la que ofrece Render por defecto.

## Running tests

```bash
cd backend
python -m pytest -v
```

17 tests. 14 in `logistics/`: happy paths and error paths for `receive_requisition`,
`dispatch_order`, `adjust_stock`, `transfer_stock` (including a regression test for the
`Manifest.number` overflow the E2E test found — see below); the threaded concurrency test;
and the Celery task tests (manifest PDF generation via `transaction.on_commit`, low-stock
digest email content). 3 in `accounts/`: the login-throttle behavior (allows requests under
the limit, blocks with `429` once over it, correct credentials still work right up to the
limit). CI (`.github/workflows/backend-ci.yml`) runs the full suite against a real Postgres
service container on every push (tasks run in eager mode in CI too -- no broker needed there).

Frontend: 16 tests, see [Frontend tests](#frontend-tests) above. CI
(`.github/workflows/frontend-ci.yml`) runs `npm run build` (type-check + bundle) and
`npm test` on every push that touches `frontend/`. Two independent pipelines, one per
side of the stack — same reasoning as the services.py/views.py split: each half of the
app is verified on its own terms.

There's also a single Playwright end-to-end test in `e2e/` that exercises both sides together —
see [End-to-end test](#end-to-end-test-playwright) above. It's run locally, not in CI (see that
section for why).

## Decisiones técnicas

A few choices that came up repeatedly enough while building this to be worth writing down —
mostly "why not the more obvious/bigger tool", since for a project this size the answer is
usually that the bigger tool would cost more than it'd save.

- **Service functions, not fat views or fat models.** Every state-changing operation
  (`receive_requisition`, `dispatch_order`, `adjust_stock`, `transfer_stock`) lives in
  `logistics/services.py` as a plain function, not a model method or a chunk of view logic.
  Views stay thin (parse request → call service → serialize response), and the service layer
  is what's actually unit-tested — no test client, no HTTP, just calling a function and
  checking the DB. It also means the same operation can eventually be called from a management
  command or a Celery task without duplicating logic.
- **`select_for_update()` + `transaction.atomic()`, not optimistic locking.** Stock rows are
  low-contention (a handful of writers per base, not thousands), so paying for a row lock at
  write time is simpler to reason about than adding a `version` column and retry logic for
  conflicts that will almost never happen here. The concurrency test
  (`test_concurrent_dispatch_never_oversells`) exists specifically to prove the lock does what
  it's supposed to under real thread contention, not just in theory.
- **Celery for the PDF and the digest, not for everything.** Only two things are async: manifest
  PDF rendering (slow, not needed for the HTTP response to succeed) and the hourly low-stock
  email (scheduled, not request-triggered). Everything else — including the stock debit itself —
  stays synchronous inside the request, because making *that* async would mean telling the user
  "your dispatch might work" instead of "your dispatch worked", for no real benefit.
- **JWT with a refresh interceptor, not session auth.** The frontend is a separate SPA origin
  talking to the API over `fetch`/Axios, which is what JWT is for; session auth would mean
  fighting CORS/CSRF for cookies for no gain here. The interceptor in `api/client.ts` retries a
  failed request once after refreshing, so an expired access token is invisible to the rest of
  the app instead of every page needing its own 401-handling logic.
- **Hand-written SCSS, not a component library or Tailwind.** No `node_modules` full of unused
  utility classes, and every visual decision (the holo-terminal theme, the sidebar, the chart)
  is something I can point at and explain, instead of "MUI does it this way by default." For a
  project this size that trade-off is worth it; it wouldn't necessarily be at 40 screens.
- **The login throttle is scoped to one view, not a global `DEFAULT_THROTTLE_CLASSES`.** Brute-
  forcing a password is the concrete risk (`LoginRateThrottle`, `5/min` per IP on
  `/auth/token/`); rate-limiting every authenticated, already-behind-a-JWT endpoint on top of
  that is solving a problem this project doesn't have yet.
- **One Playwright test, not an E2E suite.** It exists to catch the class of bug unit tests
  structurally can't — the two halves disagreeing about a contract — and it already did (see
  [End-to-end test](#end-to-end-test-playwright)). A full suite of E2E tests duplicating what the
  33 unit/component tests already cover would mostly just make the CI run slower.
- **Docker Compose, not Kubernetes.** Five services (Postgres, Redis, backend, Celery
  worker+beat, frontend) on one host is what Compose is for. Nothing here needs autoscaling,
  rolling deploys across multiple nodes, or a service mesh — reaching for k8s would be solving
  an infrastructure problem this project doesn't have, not a logistics one.
- **Render + Neon for the public deployment, not the DigitalOcean droplet the master's own
  Despliegue module teaches.** That module's approach (a droplet, CloudPanel, Nginx, Postgres
  installed by hand) is the "real" way to do this with a budget, and it's what I'd use with one —
  it's also *more* infrastructure than this project's traffic ever needs, not less. Render's free
  web service + static site and Neon's permanently-free Postgres get to the same place (a stable,
  public URL) with zero cost and zero servers to patch, at the price of no persistent background
  process for Celery/Beat to run in — see [Despliegue](#despliegue) for exactly how that trade-off
  is handled (`CELERY_TASK_ALWAYS_EAGER` + an HTTP-triggered cron instead of a worker). Locally,
  `docker compose up` still runs the real Celery worker and Beat, unchanged — the free deployment
  is a constraint of *this specific delivery*, not a redesign of the architecture.

## Roadmap

- [x] Data model, constraints, migrations
- [x] Service layer with atomic/locked stock operations + tests (incl. concurrency)
- [x] REST API (JWT auth, role permissions, filtering, OpenAPI docs)
- [x] Docker Compose + CI
- [x] React frontend (dashboard, CRUD screens, role-based views)
- [x] Celery + Redis: low-stock email digest, async manifest PDF generation
- [x] Architecture / data model / sequence diagrams + screenshots in the README
- [x] Frontend tests (Vitest + React Testing Library) wired into CI
- [x] UI polish: dashboard chart, loading skeletons, success toasts, table pagination
- [x] List filtering (status, base, search) wired to the backend's existing `django-filter`/`SearchFilter`
- [x] Login rate-throttling (`5/min` per IP on `/auth/token/`)
- [x] End-to-end test (Playwright) tying frontend, backend and Celery together
- [x] "Decisiones técnicas" — written rationale for the bigger architectural choices
- [x] Public deployment (Render + Neon, free tier) — see [Despliegue](#despliegue)
- [ ] Documento del proyecto (memoria técnica en PDF/Word) para la entrega del PFM
- [ ] Vídeo explicativo (máx. 5 min) para la entrega del PFM
- [ ] Companion Java/Spring Boot reimplementation of the core domain (separate repo)
