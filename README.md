# MarkahKu

MarkahKu is a private grade tracker for Malaysian Form 1–5 students. It helps students record exam results, follow grade trends, set targets, and review progress in Malay or English.

## Stack

- React 19 and TypeScript
- TanStack Start and TanStack Router
- Supabase Auth and database services
- Tailwind CSS 4
- Vite
- Bun

## Requirements

Install [Bun](https://bun.sh/) and Git.

## Local development

1. Clone this repository and enter its directory.
2. Install dependencies:
   ```sh
   bun install
   ```
3. Set the environment variables listed below in your local environment or an ignored `.env` file.
4. Start the development server:
   ```sh
   bun run dev
   ```

The Vite development server prints the local URL when it starts.

## Checks

```sh
bun run typecheck
bun run lint
bun test
bun run build
```

Use `bun run preview` to serve a production build locally.

## Environment variables

Set values through your deployment secret manager or local ignored environment file. Never commit secret values.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase URL used by the browser build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used by the browser build |
| `SUPABASE_URL` | Supabase URL used by server-side code |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used by server-side code |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for trusted administrative operations |
| `LOVABLE_CRON_SECRET` | Current server-only authorization secret for scheduled requests |
| `LOVABLE_CRON_SECRET_PREVIOUS` | Optional previous secret during scheduled-request key rotation |
| `LOVABLE_DB_MIGRATION_URL` | Database connection string used by Drizzle tooling |
| `AI_DAILY_CAP` | Optional daily AI request limit |
| `OCR_DAILY_CAP` | Optional daily OCR request limit |

Only the `VITE_*` variables are exposed to the client bundle. Keep service role keys, cron secrets, and database connection strings on the server.

## Google sign-in

MarkahKu uses Lovable Auth for Google sign-in, backed by the configured Supabase authentication provider.

1. In Google Cloud Console, create an OAuth client for a web application and configure its consent screen.
2. In the Supabase project, open **Authentication → Providers → Google**, enable the provider, and enter the Google OAuth client ID and client secret.
3. Copy the callback URL shown in the Supabase provider settings into the Google OAuth client's authorized redirect URIs.
4. In Supabase **Authentication → URL Configuration**, add the local development origin and each deployed app origin to the allowed redirect URLs.
5. Confirm the Supabase project is connected to the Lovable Auth integration used by this repository.

Keep the OAuth client secret in the provider settings or a secret manager. Do not put it in browser code or commit it to Git.

## Contributing

Use a feature branch and open a pull request for review. Do not commit generated files or database migrations without following the repository's `AGENTS.md` guidance.
