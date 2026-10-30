# AGENTS.md · Pase

Plataforma SaaS de gestión hostelera: carta digital con QR, comandas, pase de
cocina, seguimiento público, estimación de tiempos e impresión térmica. No es un
repositorio git. README.md contiene la guía funcional completa; este archivo
resume lo que un agente necesita para trabajar sin romper el sistema.

## Stack y arranque

- Next.js 15.5 (App Router, Server Components/Actions), React 19, TypeScript
  estricto, Tailwind 3.4, PostgreSQL 16 en Docker (`pase-db`, `127.0.0.1:5435`),
  SSE sobre `LISTEN/NOTIFY`, Vitest 5 y Playwright 1.64.
- App en `:3010`. `npm run dev` → `http://localhost:3010`.
- Comandos: `npm run db:up|db:down|db:migrate|db:seed|db:reset`, `npm run dev`,
  `npm run build`, `npm run typecheck`, `npm test` (unidad),
  `npm run test:integration` (PostgreSQL real), `npm run test:e2e`.
- **Decisión deliberada:** no se usa Supabase. PostgreSQL local con RLS forzada
  y funciones `SECURITY DEFINER`; auth propia con cookie HMAC
  (`pase_session`). No lo cambies sin actualizar README y migraciones.
- Playwright usa `/usr/bin/chromium` (`CHROMIUM_PATH` para cambiarlo); su
  `webServer` reutiliza el dev server si ya está arriba. El test del propietario
  tarda ~1 min por la compilación bajo demanda de Next.
- `db:reset` borra el volumen: no ejecutarlo contra datos que importen. El seed
  solo corre fuera de `PASE_ENV=production`.

## Datos demo

Contraseña común `PaseDemo2026!`. `owner@casa-aurelio.es`, `encargada@...`,
`sala@...`, `cocina@...`, `owner@lachispa.es`, superadmin `admin@pase.app`
(entra en `/plataforma`). Restaurantes `casa-aurelio` y `la-chispa`; mesa 4
token `casa04c4d5e6f708192a3b4c5d6e7f8091a2b`; seguimiento demo
`demo_tracking_casa_aurelio_000001`; agentes demo
`pase_dev_agent_casa_aurelio` y `pase_dev_agent_la_chispa`.

## Mapa del código

- `db/migrations/`: esquema, RLS, API pública, notificaciones, agente, plataforma.
  Cualquier cambio de políticas va aquí; no editar migraciones ya aplicadas,
  añadir una nueva.
- `features/<dominio>/`: lógica por dominio (`auth`, `orders`, `menu`, `tables`,
  `stations`, `printing`, `staff`, `platform`, `tracking`, `estimates`,
  `permissions`, `audit`). Server Actions en `actions.ts`.
- `lib/db.ts`: `publicQuery` (sin usuario), `userQuery`/`withDb` (fijan
  `app.user_id` en la transacción). `lib/messages.ts` + allowlist de
  `components/ui/banner.tsx` para los flash `?ok=`/`?error=`.
- `app/(public)/`: carta, login y seguimiento. `app/(staff)/`: sala, cocina y
  admin. `app/plataforma/` queda fuera del shell staff para evitar el bucle de
  redirección del layout.
- `components/`: `shell`, `staff`, `admin`, `platform`, `public`, `ui`.
- `agent/print-agent.mjs`: agente local de impresión; `test` escribe tickets en
  `agent/out/` (ignorado por git), `network` habla ESC/POS TCP y `usb_agent`
  escribe en un dispositivo.

## Reglas que han causado errores reales

- **Nunca `redirect()` dentro de `withDb`**: hace rollback de la transacción.
  Redirigir después del commit.
- Un `SELECT`/`UPDATE` con placeholders debe usar todos los parámetros; un `$2`
  sin usar provoca `42P18` en Postgres.
- Las cookies de sesión se hashean con **HMAC-SHA256 + `SESSION_SECRET`**, no con
  SHA-256 plano. Para crear una sesión de prueba usa `api.create_auth_session`
  con el hash HMAC.
- El alta de personal usa `api.create_staff_user(restaurante, email, hash, nombre,
  rol)` (5 argumentos, crea también la pertenencia). El rol `owner` solo lo puede
  asignar un superadmin.
- Los mensajes nuevos deben existir en `lib/messages.ts` y en la allowlist de
  `banner.tsx`; un código sin allowlist no se muestra.
- Sigue el patrón de idempotencia de comandas/líneas y los locks asesores; no
  insertes comandas desde fuera de `features/orders/actions.ts` sin replicarlo.
- El seguimiento público solo puede exponer la comanda de su token y la carga
  agregada por estación; nunca nombres/notas de otras mesas.
- QR: `GET /api/admin/mesas/[id]/qr?format=png|svg&download=1` exige
  `manageTables`; la URL pública es `/carta/<slug>?mesa=<qr_token>`.
- **zsh:** `for path in ...` sobrescribe `PATH` (zsh liga `path` y `PATH`). Usa
  otra variable, p. ej. `p`, en bucles de shell.

## Verificación mínima antes de terminar

```bash
npm run typecheck
npm test
npm run test:integration
npm run test:e2e        # requiere el dev server o lo arranca el config
npm run build
```

Si tocas el agente, prueba también:
`npm run print:agent -- --token pase_dev_agent_casa_aurelio --once` y revisa el
ticket generado en `agent/out/`.
