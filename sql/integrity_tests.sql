-- ============================================================
-- Data integrity test suite
-- Run (as the admin account):
--   docker exec -i sapeis-postgres psql -U sapeis_admin -d sapeis < sql/integrity_tests.sql
-- Every test either checks that the database REJECTS bad data (with the expected error code)
-- or that a rule keeps data consistent. The whole file runs inside one transaction and is
-- rolled back at the end, so your data is unchanged.
-- ============================================================
BEGIN;

CREATE TEMP TABLE test_results (
    id SERIAL, category TEXT, test TEXT, expected TEXT, actual TEXT, result TEXT);

-- expects the statement to FAIL with a given SQLSTATE
CREATE FUNCTION pg_temp.expect_error(p_cat TEXT, p_test TEXT, p_sql TEXT, p_state TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_state TEXT; v_msg TEXT;
BEGIN
    BEGIN
        EXECUTE p_sql;
        INSERT INTO test_results (category, test, expected, actual, result)
        VALUES (p_cat, p_test, 'error ' || p_state, 'statement was ACCEPTED', 'FAIL');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        INSERT INTO test_results (category, test, expected, actual, result)
        VALUES (p_cat, p_test, 'error ' || p_state, 'error ' || v_state || ': ' || left(v_msg, 55),
                CASE WHEN v_state = p_state THEN 'PASS' ELSE 'FAIL' END);
    END;
END $$;

-- expects the statement to SUCCEED
CREATE FUNCTION pg_temp.expect_ok(p_cat TEXT, p_test TEXT, p_sql TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_state TEXT; v_msg TEXT;
BEGIN
    BEGIN
        EXECUTE p_sql;
        INSERT INTO test_results (category, test, expected, actual, result)
        VALUES (p_cat, p_test, 'accepted', 'accepted', 'PASS');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        INSERT INTO test_results (category, test, expected, actual, result)
        VALUES (p_cat, p_test, 'accepted', 'error ' || v_state || ': ' || left(v_msg, 55), 'FAIL');
    END;
END $$;

-- ---------- A. Keys and uniqueness ----------
DO $outer$ BEGIN
  PERFORM pg_temp.expect_error('Unique', 'Duplicate student email',
  $q$INSERT INTO student (srn,name,email,dept_id,semester,section,mentor_id)
     VALUES ('PES1UG24CS998','Dup','aarav.sharma@stu.pes.edu',1,3,'A',1)$q$, '23505');
  PERFORM pg_temp.expect_error('Unique', 'Student enrolled twice in the same offering',
  $q$INSERT INTO enrollment (srn, offering_id) VALUES ('PES1UG24CS101', 1)$q$, '23505');
  PERFORM pg_temp.expect_error('Primary key', 'Duplicate attendance row for same day',
  $q$INSERT INTO attendance VALUES (1, DATE '2026-08-17', 'PRESENT')$q$, '23505');
  PERFORM pg_temp.expect_error('Primary key', 'Second score for the same enrollment and assessment',
  $q$INSERT INTO score VALUES (1, 1, 10)$q$, '23505');

END $outer$;

-- ---------- B. Foreign keys ----------
DO $outer$ BEGIN
  PERFORM pg_temp.expect_error('Foreign key', 'Enrollment for a student that does not exist',
  $q$INSERT INTO enrollment (srn, offering_id) VALUES ('NOSUCHSRN', 1)$q$, '23503');
  PERFORM pg_temp.expect_error('Foreign key', 'Student in a department that does not exist',
  $q$INSERT INTO student (srn,name,email,dept_id,semester,section,mentor_id)
     VALUES ('PES1UG24CS997','X','x1@stu.pes.edu',99,3,'A',1)$q$, '23503');
  PERFORM pg_temp.expect_error('Foreign key', 'Delete a course that still has offerings (no cascade)',
  $q$DELETE FROM course WHERE course_code = 'UE24CS251A'$q$, '23503');

END $outer$;

-- ---------- C. NOT NULL, CHECK and ENUM constraints ----------
DO $outer$ BEGIN
  PERFORM pg_temp.expect_error('Not null', 'Student without a name',
  $q$INSERT INTO student (srn,email,dept_id,semester,section) VALUES ('PES1UG24CS996','n@stu.pes.edu',1,3,'A')$q$, '23502');
  PERFORM pg_temp.expect_error('Check', 'Semester 12 (valid range 1 to 8)',
  $q$INSERT INTO student (srn,name,email,dept_id,semester,section,mentor_id)
     VALUES ('PES1UG24CS995','X','x2@stu.pes.edu',1,12,'A',1)$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'Course with 9 credits (valid range 1 to 6)',
  $q$INSERT INTO course VALUES ('UE24XX999A','Bad Course',9,1)$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'Negative marks',
  $q$UPDATE score SET marks_obtained = -5 WHERE enrollment_id = 1 AND assessment_id = 1$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'Weightage above 100',
  $q$UPDATE assessment SET weightage = 150 WHERE assessment_id = 1$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'Intervention closed before it was opened',
  $q$UPDATE intervention SET closed_on = DATE '2000-01-01' WHERE intervention_id = 1$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'Course that is its own prerequisite',
  $q$INSERT INTO course_prerequisite VALUES ('UE24CS251A','UE24CS251A')$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'ADMIN account linked to a student',
  $q$INSERT INTO app_user (email,password_hash,full_name,role,srn) VALUES ('a@x.com','h','A','ADMIN','PES1UG24CS101')$q$, '23514');
  PERFORM pg_temp.expect_error('Check', 'STUDENT account linked to a faculty member',
  $q$INSERT INTO app_user (email,password_hash,full_name,role,faculty_id) VALUES ('b@x.com','h','B','STUDENT',1)$q$, '23514');
  PERFORM pg_temp.expect_error('Enum', 'Attendance status LATE (only PRESENT or ABSENT)',
  $q$INSERT INTO attendance VALUES (1, DATE '2026-12-05', 'LATE')$q$, '22P02');

END $outer$;

-- ---------- D. Triggers ----------
DO $outer$ BEGIN
  PERFORM pg_temp.expect_error('Trigger', 'Marks above the assessment maximum',
  $q$UPDATE score SET marks_obtained = 99 WHERE enrollment_id = 1 AND assessment_id = 1$q$, 'P0001');
  PERFORM pg_temp.expect_error('Trigger', 'Score attached to an assessment of a different course',
  $q$INSERT INTO score VALUES (1, 4, 10)$q$, 'P0001');   -- assessment 4 belongs to offering 2, enrollment 1 is offering 1
  PERFORM pg_temp.expect_ok('Trigger', 'Marks exactly equal to the maximum are allowed',
  $q$UPDATE score SET marks_obtained = 40 WHERE enrollment_id = 1 AND assessment_id = 1$q$);

END $outer$;

DO $$
DECLARE n_before INT; n_after INT; v_closed DATE;
BEGIN
    SELECT COUNT(*) INTO n_before FROM audit_log;
    UPDATE intervention SET status = 'RESOLVED' WHERE intervention_id = 1;
    SELECT COUNT(*) INTO n_after FROM audit_log;
    SELECT closed_on INTO v_closed FROM intervention WHERE intervention_id = 1;
    INSERT INTO test_results (category, test, expected, actual, result)
    VALUES ('Trigger', 'Status change writes an audit row and stamps closed_on',
            '1 audit row + closed_on set',
            (n_after - n_before) || ' audit row, closed_on=' || COALESCE(v_closed::text, 'NULL'),
            CASE WHEN n_after = n_before + 1 AND v_closed IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);
END $$;

-- ---------- E. Consistency of derived data ----------
DO $$
DECLARE n_before INT; n_after INT; n_bad INT; n_missing INT;
BEGIN
    SELECT COUNT(*) INTO n_before FROM intervention;
    CALL sp_refresh_risk();
    CALL sp_refresh_risk();
    SELECT COUNT(*) INTO n_after FROM intervention;
    -- the first CALL may open interventions for newly high-risk students; the second must add none
    INSERT INTO test_results (category, test, expected, actual, result)
    VALUES ('Consistency', 'Running sp_refresh_risk twice never duplicates an active intervention',
            'at most one active intervention per student',
            (SELECT COALESCE(MAX(c),0) FROM (SELECT COUNT(*) c FROM intervention
                WHERE status IN ('OPEN','IN_PROGRESS') GROUP BY srn) t) || ' max active per student',
            CASE WHEN (SELECT COALESCE(MAX(c),0) FROM (SELECT COUNT(*) c FROM intervention
                WHERE status IN ('OPEN','IN_PROGRESS') GROUP BY srn) t) <= 1 THEN 'PASS' ELSE 'FAIL' END);

    SELECT COUNT(*) INTO n_bad
    FROM student s JOIN risk_assessment r ON r.srn = s.srn
    WHERE r.attendance_pct <> fn_attendance_pct(s.srn)
       OR r.avg_score_pct  <> fn_avg_score_pct(s.srn)
       OR r.risk_level     <> fn_classify_risk(fn_attendance_pct(s.srn), fn_avg_score_pct(s.srn));
    SELECT COUNT(*) INTO n_missing FROM student s WHERE NOT EXISTS (SELECT 1 FROM risk_assessment r WHERE r.srn = s.srn);
    INSERT INTO test_results (category, test, expected, actual, result)
    VALUES ('Consistency', 'Stored risk equals a fresh recalculation for every student',
            '0 mismatches, 0 students without a risk row',
            n_bad || ' mismatches, ' || n_missing || ' missing',
            CASE WHEN n_bad = 0 AND n_missing = 0 THEN 'PASS' ELSE 'FAIL' END);
END $$;

-- ---------- F. Atomicity: all or nothing ----------
DO $$
DECLARE n_before INT; n_after INT;
BEGIN
    SELECT COUNT(*) INTO n_before FROM attendance;
    BEGIN
        INSERT INTO attendance VALUES (1, DATE '2026-12-01', 'PRESENT');   -- valid
        INSERT INTO attendance VALUES (1, DATE '2026-12-02', 'LATE');      -- invalid, raises an error
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    SELECT COUNT(*) INTO n_after FROM attendance;
    INSERT INTO test_results (category, test, expected, actual, result)
    VALUES ('Atomicity', 'A batch with one bad row leaves no rows behind',
            'row count unchanged', n_before || ' -> ' || n_after,
            CASE WHEN n_before = n_after THEN 'PASS' ELSE 'FAIL' END);
END $$;

-- ---------- G. Cascading deletes (kept last: it removes a student inside this transaction) ----------
DO $$
DECLARE n_before INT; n_after INT;
BEGIN
    SELECT (SELECT COUNT(*) FROM enrollment WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM risk_assessment WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM intervention WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM app_user WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM score sc JOIN enrollment e USING (enrollment_id) WHERE e.srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM attendance a JOIN enrollment e USING (enrollment_id) WHERE e.srn='PES1UG24CS103')
    INTO n_before;
    DELETE FROM student WHERE srn = 'PES1UG24CS103';
    SELECT (SELECT COUNT(*) FROM enrollment WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM risk_assessment WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM intervention WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM app_user WHERE srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM score sc JOIN enrollment e USING (enrollment_id) WHERE e.srn='PES1UG24CS103')
         + (SELECT COUNT(*) FROM attendance a JOIN enrollment e USING (enrollment_id) WHERE e.srn='PES1UG24CS103')
    INTO n_after;
    INSERT INTO test_results (category, test, expected, actual, result)
    VALUES ('Cascade', 'Deleting a student removes every dependent row (enrollments, marks, attendance, risk, interventions, login)',
            'dependent rows go to 0', n_before || ' -> ' || n_after,
            CASE WHEN n_before > 0 AND n_after = 0 THEN 'PASS' ELSE 'FAIL' END);
END $$;

\pset format aligned
SELECT id, category, test, expected, actual, result FROM test_results ORDER BY id;
SELECT COUNT(*) FILTER (WHERE result = 'PASS') AS passed,
       COUNT(*) FILTER (WHERE result = 'FAIL') AS failed,
       COUNT(*) AS total
FROM test_results;

ROLLBACK;
