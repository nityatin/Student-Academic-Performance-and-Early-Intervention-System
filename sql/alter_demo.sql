-- ============================================================
-- ALTER and DROP demonstration
-- Run:  docker exec -i sapeis-postgres psql -U sapeis_admin -d sapeis < sql/alter_demo.sql
-- PostgreSQL supports transactional DDL, so everything below is rolled back at the end
-- and the real schema is left unchanged.
-- ============================================================
BEGIN;

\echo '--- 1. ALTER TABLE ... ADD COLUMN, then a CHECK constraint on it'
ALTER TABLE student ADD COLUMN phone VARCHAR(15);
ALTER TABLE student ADD CONSTRAINT chk_phone_digits CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$');

\echo '--- 2. The new constraint rejects a bad value and accepts a good one'
SAVEPOINT before_bad;
UPDATE student SET phone = '98765' WHERE srn = 'PES1UG24CS101';       -- rejected: not 10 digits
ROLLBACK TO before_bad;
UPDATE student SET phone = '9876543210' WHERE srn = 'PES1UG24CS101';  -- accepted
SELECT srn, name, phone FROM student WHERE srn = 'PES1UG24CS101';

\echo '--- 3. ALTER COLUMN: set a default, widen a type'
ALTER TABLE student ALTER COLUMN section SET DEFAULT 'A';
ALTER TABLE intervention ALTER COLUMN action_type TYPE VARCHAR(60);

\echo '--- 4. RENAME a column and add an index'
ALTER TABLE student RENAME COLUMN phone TO contact_number;
CREATE INDEX idx_student_semester_section ON student (semester, section);
\d student

\echo '--- 5. DROP the constraint, index and column again'
ALTER TABLE student DROP CONSTRAINT chk_phone_digits;
DROP INDEX idx_student_semester_section;
ALTER TABLE student DROP COLUMN contact_number;
ALTER TABLE student ALTER COLUMN section DROP DEFAULT;

\echo '--- 6. CREATE, ALTER and DROP a scratch table'
CREATE TABLE scratch_notes (note_id SERIAL PRIMARY KEY, body TEXT);
ALTER TABLE scratch_notes ADD COLUMN created_at TIMESTAMP DEFAULT now();
DROP TABLE scratch_notes;

\echo '--- 7. DROP and re-create a view'
DROP VIEW v_student_overview;
CREATE VIEW v_student_overview AS
SELECT s.srn, s.name, s.semester, s.section, s.mentor_id, f.name AS mentor,
       r.attendance_pct, r.avg_score_pct, r.risk_level, r.computed_at
FROM student s
LEFT JOIN risk_assessment r ON r.srn = s.srn
LEFT JOIN faculty f ON f.faculty_id = s.mentor_id;
SELECT COUNT(*) AS students_in_view FROM v_student_overview;

ROLLBACK;
\echo '--- schema restored: the phone/contact_number column is gone'
SELECT column_name FROM information_schema.columns WHERE table_name = 'student' ORDER BY ordinal_position;
