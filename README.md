# Student Academic Performance & Early Intervention System

DBMS mini project. Next.js (App Router) + TypeScript; backend = Next.js Route Handlers;
PostgreSQL (relational data, triggers, stored procedure) + MongoDB (counselling notes, improvement plans).

## Setup

1. Create your settings file. Copy `.env.example` to `.env` (Windows: `copy .env.example .env`) and fill in
   the four database passwords and the session secret. Each blank line has a command in the file that generates a value.
   If an old `.env.local` exists, delete it: it overrides `.env`.
2. Start the databases (Docker Desktop must be running):   docker compose up -d
   The SQL in db/ and the Mongo script in mongo/ run automatically on first start.
3. Install dependencies:                                    npm install
4. Start the app:                                           npm run dev   ->  http://localhost:3000

Reset all data (also needed after changing passwords or pulling new db/ or mongo/ files):
    docker compose down -v
    docker compose up -d

## Demo logins (app accounts, not database accounts)

| Role | Email | Password | Can do |
|---|---|---|---|
| Admin | admin@pes.edu | Admin@123 | Everything: all students, recalculate risk, any note, audit log |
| Mentor | shilpa.s@pes.edu (also arvind.rao@, meena.k@, rohan.iyer@pes.edu) | Mentor@123 | Own mentees only: notes (edit/delete own), plan steps, intervention status |
| Student | kabir.menon@stu.pes.edu (any student email) | Student@123 | Own record only, read-only |

## Database accounts

| Account | Used by | Rights |
|---|---|---|
| sapeis_admin (Postgres), sapeis_root (Mongo) | Used by us for setup and the report scripts | Full |
| sapeis_app (Postgres and Mongo) | The web app only | Postgres: SELECT on most tables, INSERT/UPDATE on risk and interventions, INSERT on audit log; no DDL, no DELETE. Mongo: read/write on the sapeis database only |

Both database ports are bound to 127.0.0.1, so only this computer can connect.

## Commands for the report

Open a SQL shell:      docker exec -it sapeis-postgres psql -U sapeis_admin -d sapeis
Open a Mongo shell:    docker exec -it sapeis-mongo mongosh -u sapeis_root -p YOUR_MONGO_ROOT_PASSWORD --authenticationDatabase admin sapeis

Run a script (Mac/Linux/Git Bash):
    docker exec -i sapeis-postgres psql -U sapeis_admin -d sapeis < sql/queries.sql
    docker exec -i sapeis-postgres psql -U sapeis_admin -d sapeis < sql/integrity_tests.sql
    docker exec -i sapeis-postgres psql -U sapeis_admin -d sapeis < sql/alter_demo.sql
Run a script (PowerShell):
    Get-Content sql/queries.sql | docker exec -i sapeis-postgres psql -U sapeis_admin -d sapeis

Cross-database check (MongoDB documents must point at real PostgreSQL students):
    node --env-file=.env scripts/check-consistency.mjs
    node --env-file=.env scripts/check-consistency.mjs --fix     (also deletes orphaned Mongo documents)

queries.sql, integrity_tests.sql and alter_demo.sql roll back their changes, so they are safe to re-run.

## Folders

    db/       schema (DDL), seed data (DML), functions, procedure, triggers, view, app role   (auto-run by Docker)
    mongo/    MongoDB app user, collections, indexes and seed                                 (auto-run by Docker)
    sql/      queries, integrity tests and ALTER/DROP demo for the report
    nosql/    mongosh commands (create, read, update, delete, aggregation)
    scripts/  cross-database consistency check
    docs/     ER diagram, relational schema, technology justification, requirements map
    src/      Next.js app: pages, API route handlers, auth, database access

The build prints a warning about "CompressionStream" from the jose library. It is harmless: that code path is not used by our tokens.
