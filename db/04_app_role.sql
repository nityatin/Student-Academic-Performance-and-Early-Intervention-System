-- ============================================================
-- Least-privilege login for the web app.
-- The app connects as sapeis_app, never as the admin/owner account, so a bug or
-- SQL injection in the app cannot drop tables, alter the schema or delete students.
-- The password comes from the APP_DB_PASSWORD environment variable (see .env).
-- ============================================================
\getenv app_pw APP_DB_PASSWORD

SELECT format('CREATE ROLE sapeis_app LOGIN PASSWORD %L', :'app_pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sapeis_app') \gexec
SELECT format('ALTER ROLE sapeis_app PASSWORD %L', :'app_pw') \gexec

GRANT CONNECT ON DATABASE sapeis TO sapeis_app;
GRANT USAGE ON SCHEMA public TO sapeis_app;

-- read-only tables (the app never changes these today)
GRANT SELECT ON department, faculty, course, course_prerequisite, course_offering,
                enrollment, assessment, score, attendance, student, app_user,
                v_student_overview TO sapeis_app;

-- tables the app writes through its API and the risk procedure
GRANT SELECT, INSERT, UPDATE ON risk_assessment, intervention TO sapeis_app;
GRANT SELECT, INSERT         ON audit_log TO sapeis_app;
GRANT USAGE ON SEQUENCE intervention_intervention_id_seq, audit_log_log_id_seq TO sapeis_app;
