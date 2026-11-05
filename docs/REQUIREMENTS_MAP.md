# Where each requirement is met

| Requirement | Where |
|---|---|
| ER diagram | docs/ER_diagram.png (also .pdf, .svg); regenerate with `python3 docs/make_er.py` |
| Relational schema with keys, relationships, constraints | docs/relational_schema.md |
| SQL implementation, DDL with constraints | db/01_schema.sql |
| NoSQL database | MongoDB: mongo/01_init.js (collections, indexes, seed), nosql/mongo_commands.js |
| Technology justification | docs/technology_justification.md |
| DML operations | INSERT: db/02_seed.sql. UPDATE and DELETE: sql/queries.sql sections 7.2, 7.3 |
| Nested queries | sql/queries.sql 7.5, 7.6 |
| Correlated queries | sql/queries.sql 7.4 |
| Recursive queries | sql/queries.sql 7.8, 7.9 (course_prerequisite) |
| Join queries | sql/queries.sql 7.1, 7.4, 7.7 |
| Functions | db/03_routines.sql: fn_attendance_pct, fn_avg_score_pct, fn_classify_risk |
| Triggers | db/03_routines.sql: before_score_check, before_intervention_update |
| CTE | sql/queries.sql 7.8, 7.9 (recursive), 7.10 (multi-step) |
| Stored procedure, view, window function | db/03_routines.sql; sql/queries.sql 7.11 |
| NoSQL feature: Read, Update, Delete | Notes: src/app/api/notes (GET, PATCH, DELETE). Plan steps: src/app/api/plan/[srn] (PATCH, DELETE). Mongo commands: nosql/mongo_commands.js |
| Backend/API and database integration | src/app/api/*, src/lib/queries.ts, src/lib/pg.ts, src/lib/mongo.ts |
| Authentication | src/app/api/auth/login and logout, src/lib/token.ts, src/lib/auth.ts, src/middleware.ts, table app_user |
| Minimum 2 roles in frontend | Three roles: ADMIN, MENTOR, STUDENT. Nav, dashboard, edit controls and data are role-specific (see README) |
