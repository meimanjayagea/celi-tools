# Database migrations with Flyway

Flyway is the migration source of truth for the web app. Configuration is in `apps/web/db/flyway.toml`, the connection wrapper is in `apps/web/db/run-flyway.mjs`, and versioned SQL files live in `apps/web/db/migrations/`.

| Migration | Purpose |
| --- | --- |
| `V001__auth.sql` | Auth.js tables and email sign-in rate limits in `celi_auth`. |
| `V002__sticky_notes.sql` | Per-user notes and reminder indexes in `celi_app`. |
| `V003__ai_agent.sql` | Encrypted AI provider profiles in `celi_app`. |
| `V004__ai_provider_fallback.sql` | Additional AI providers and ordered fallback profiles. |

## Configuration

Install Flyway CLI 11 or later (the TOML configuration format is used) from the [official downloads](https://documentation.red-gate.com/flyway/reference/usage/command-line), then provide `DATABASE_PROVIDER` and `DATABASE_URL` through the shell or `apps/web/.env.local`. The CLI distribution includes its Java runtime. The wrapper converts the app's PostgreSQL URL to a JDBC URL, keeps credentials in separate process environment variables, and requires TLS for remote connections when `sslmode` is not specified. It accepts PostgreSQL, Prisma Postgres, Neon, and Supabase PostgreSQL. Never commit database credentials.

`flyway.toml` creates/uses `celi_meta` for `flyway_schema_history` and manages `celi_auth` and `celi_app`. Flyway `clean` is disabled. A non-PostgreSQL provider needs its own Flyway driver and migration configuration.

## Check and apply

From the repository root, configure `DATABASE_PROVIDER=postgres` and `DATABASE_URL` for the intended PostgreSQL-compatible database, then run:

```sh
npm run db:status
npm run db:migrate
npm run db:status
```

Flyway `info` reports applied and pending migrations; `migrate` applies pending versions transactionally and stores checksums in `celi_meta.flyway_schema_history`. Use `npm run db:validate` to check the applied history against the migration files. For local values in `apps/web/.env.local`, use `npm run db:status:local` and `npm run db:migrate:local`.

## Existing database

The previous app migration runner recorded versions `001–004` in `celi_meta.schema_migrations`. Flyway does not import that custom ledger. For an existing database, first verify all four old ledger rows are present and that the corresponding schemas and tables exist. Back up the database, then run the one-time baseline command:

```sh
npm run db:baseline:legacy
npm run db:status
```

This records Flyway baseline version `4` and does not execute `V001–V004` against existing tables. Only use it for the verified existing database. On a new, empty database, do **not** baseline: run `npm run db:migrate` so all four migrations are applied.

Back up production before applying migrations. Migrations are forward-only: never edit a version after it has been applied; add the next version instead. These migrations do not insert dummy users, notes, provider profiles, or API keys. Migrations do not run automatically during deployment.
