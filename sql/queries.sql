-- ============================================================
-- Chapter 7: Queries  (run with:  psql -U sapeis -d sapeis -f sql/queries.sql)
-- UPDATE and DELETE demos run inside a transaction and ROLLBACK,
-- so your data is unchanged after running this file.
-- ============================================================

\echo '--- 7.1 GROUP BY + aggregate + HAVING: average internal score per course'
SELECT c.course_code, c.title,
       COUNT(DISTINCT e.srn)                                       AS students,
       ROUND(AVG(sc.marks_obtained / a.max_marks * 100), 2)        AS avg_score_pct,
       MIN(ROUND(sc.marks_obtained / a.max_marks * 100, 1))        AS lowest_pct
FROM course c
JOIN course_offering o ON o.course_code = c.course_code
JOIN enrollment e      ON e.offering_id = o.offering_id
JOIN assessment a      ON a.offering_id = o.offering_id
JOIN score sc          ON sc.enrollment_id = e.enrollment_id AND sc.assessment_id = a.assessment_id
GROUP BY c.course_code, c.title
HAVING COUNT(DISTINCT e.srn) >= 5 AND AVG(sc.marks_obtained / a.max_marks * 100) < 70
ORDER BY avg_score_pct;

\echo '--- 7.2 UPDATE (UPDATE ... FROM with a subquery): +5 grace marks on ISA-1, then re-run risk'
BEGIN;
SELECT fn_avg_score_pct('PES1UG24CS103') AS score_before, risk_level AS risk_before
FROM risk_assessment WHERE srn = 'PES1UG24CS103';

UPDATE score sc
SET marks_obtained = LEAST(sc.marks_obtained + 5, a.max_marks)
FROM assessment a
WHERE a.assessment_id = sc.assessment_id
  AND a.name = 'ISA-1'
  AND sc.enrollment_id IN (SELECT enrollment_id FROM enrollment WHERE srn = 'PES1UG24CS103');

CALL sp_refresh_risk();
SELECT fn_avg_score_pct('PES1UG24CS103') AS score_after, risk_level AS risk_after
FROM risk_assessment WHERE srn = 'PES1UG24CS103';
ROLLBACK;

\echo '--- 7.3 DELETE (with subquery): remove first week of attendance for one student'
BEGIN;
SELECT COUNT(*) AS rows_before FROM attendance
WHERE enrollment_id IN (SELECT enrollment_id FROM enrollment WHERE srn = 'PES1UG24CS112');

DELETE FROM attendance
WHERE class_date < DATE '2026-08-24'
  AND enrollment_id IN (SELECT enrollment_id FROM enrollment WHERE srn = 'PES1UG24CS112');

SELECT COUNT(*) AS rows_after FROM attendance
WHERE enrollment_id IN (SELECT enrollment_id FROM enrollment WHERE srn = 'PES1UG24CS112');
ROLLBACK;

\echo '--- 7.4 CORRELATED subquery: ISA-1 scores below the class average for that same course'
SELECT s.srn, s.name, c.title AS course, sc.marks_obtained AS marks,
       (SELECT ROUND(AVG(sc2.marks_obtained), 2) FROM score sc2
         WHERE sc2.assessment_id = sc.assessment_id) AS class_avg
FROM score sc
JOIN assessment a        ON a.assessment_id = sc.assessment_id AND a.name = 'ISA-1'
JOIN enrollment e        ON e.enrollment_id = sc.enrollment_id
JOIN student s           ON s.srn = e.srn
JOIN course_offering o   ON o.offering_id = e.offering_id
JOIN course c            ON c.course_code = o.course_code
WHERE sc.marks_obtained < (SELECT AVG(sc2.marks_obtained) FROM score sc2
                            WHERE sc2.assessment_id = sc.assessment_id)   -- correlated on sc.assessment_id
  AND c.course_code = 'UE24CS251A'
ORDER BY sc.marks_obtained;

\echo '--- 7.5 NESTED subqueries: medium/high-risk students with no active intervention'
SELECT srn, name FROM student
WHERE srn IN (SELECT srn FROM risk_assessment WHERE risk_level IN ('MEDIUM', 'HIGH'))
  AND srn NOT IN (SELECT srn FROM intervention WHERE status IN ('OPEN', 'IN_PROGRESS'));

\echo '--- 7.6 NESTED: students whose attendance is below the overall average'
SELECT s.srn, s.name, r.attendance_pct
FROM student s JOIN risk_assessment r ON r.srn = s.srn
WHERE r.attendance_pct < (SELECT AVG(attendance_pct) FROM risk_assessment)
ORDER BY r.attendance_pct;

\echo '--- 7.7 JOINs: INNER (student-course-faculty) and LEFT (students with/without interventions)'
SELECT s.name, c.title, f.name AS taught_by
FROM student s
JOIN enrollment e      ON e.srn = s.srn
JOIN course_offering o ON o.offering_id = e.offering_id
JOIN course c          ON c.course_code = o.course_code
JOIN faculty f         ON f.faculty_id = o.faculty_id
WHERE s.srn = 'PES1UG24CS103'
ORDER BY c.course_code;

SELECT s.srn, s.name, COUNT(i.intervention_id) AS interventions
FROM student s LEFT JOIN intervention i ON i.srn = s.srn
GROUP BY s.srn, s.name
ORDER BY interventions DESC, s.srn;

\echo '--- 7.8 RECURSIVE CTE: every course that must be completed before Computer Networks'
WITH RECURSIVE chain AS (
    SELECT p.course_code, p.prereq_code, 1 AS depth
    FROM course_prerequisite p
    WHERE p.course_code = 'UE24CS253A'
  UNION ALL
    SELECT p.course_code, p.prereq_code, ch.depth + 1
    FROM course_prerequisite p
    JOIN chain ch ON p.course_code = ch.prereq_code
)
SELECT ch.depth, c.course_code, c.title
FROM chain ch JOIN course c ON c.course_code = ch.prereq_code
ORDER BY ch.depth;

\echo '--- 7.9 RECURSIVE CTE (reverse): every course that depends on Problem Solving with C'
WITH RECURSIVE dependents AS (
    SELECT course_code, 1 AS depth FROM course_prerequisite WHERE prereq_code = 'UE24CS101A'
  UNION ALL
    SELECT p.course_code, d.depth + 1
    FROM course_prerequisite p JOIN dependents d ON p.prereq_code = d.course_code
)
SELECT d.depth, c.course_code, c.title FROM dependents d JOIN course c USING (course_code)
ORDER BY d.depth, c.course_code;

\echo '--- 7.10 CTE (multi-step): workload per mentor'
WITH mentee_risk AS (
    SELECT s.mentor_id, r.risk_level
    FROM student s JOIN risk_assessment r ON r.srn = s.srn
),
per_mentor AS (
    SELECT mentor_id,
           COUNT(*)                                   AS mentees,
           COUNT(*) FILTER (WHERE risk_level = 'HIGH')   AS high,
           COUNT(*) FILTER (WHERE risk_level = 'MEDIUM') AS medium
    FROM mentee_risk GROUP BY mentor_id
)
SELECT f.name AS mentor, p.mentees, p.high, p.medium
FROM per_mentor p JOIN faculty f ON f.faculty_id = p.mentor_id
ORDER BY p.high DESC, p.medium DESC;

\echo '--- 7.11 Window function: rank by internal score within each section'
SELECT s.section, s.name, r.avg_score_pct,
       RANK() OVER (PARTITION BY s.section ORDER BY r.avg_score_pct DESC) AS rank_in_section
FROM student s JOIN risk_assessment r ON r.srn = s.srn
ORDER BY s.section, rank_in_section;

\echo '--- 7.12 Functions and views in use'
SELECT srn, fn_attendance_pct(srn) AS attendance, fn_avg_score_pct(srn) AS score,
       fn_classify_risk(fn_attendance_pct(srn), fn_avg_score_pct(srn)) AS risk
FROM student ORDER BY srn LIMIT 5;
