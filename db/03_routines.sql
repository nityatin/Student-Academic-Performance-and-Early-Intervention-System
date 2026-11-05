-- ============================================================
-- Functions, stored procedure, triggers, views
-- ============================================================

-- 1. Attendance % for a student across all courses
CREATE OR REPLACE FUNCTION fn_attendance_pct(p_srn VARCHAR)
RETURNS NUMERIC AS $$
    SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'PRESENT')
                          / NULLIF(COUNT(*), 0), 2), 0)
    FROM attendance a JOIN enrollment e ON e.enrollment_id = a.enrollment_id
    WHERE e.srn = p_srn;
$$ LANGUAGE sql STABLE;

-- 2. Weighted-average score % for a student (internal assessments only)
CREATE OR REPLACE FUNCTION fn_avg_score_pct(p_srn VARCHAR)
RETURNS NUMERIC AS $$
    SELECT COALESCE(ROUND(100.0 * SUM(sc.marks_obtained / a.max_marks * a.weightage)
                          / NULLIF(SUM(a.weightage), 0), 2), 0)
    FROM score sc
    JOIN enrollment e ON e.enrollment_id = sc.enrollment_id
    JOIN assessment a ON a.assessment_id = sc.assessment_id
    WHERE e.srn = p_srn;
$$ LANGUAGE sql STABLE;

-- 3. Risk classification rule
CREATE OR REPLACE FUNCTION fn_classify_risk(p_att NUMERIC, p_score NUMERIC)
RETURNS risk_level_t AS $$
    SELECT CASE
        WHEN p_att < 65 OR p_score < 40 THEN 'HIGH'::risk_level_t
        WHEN p_att < 75 OR p_score < 55 THEN 'MEDIUM'::risk_level_t
        ELSE 'LOW'::risk_level_t
    END;
$$ LANGUAGE sql IMMUTABLE;

-- 4. Stored procedure: recompute risk for every student and auto-open interventions
CREATE OR REPLACE PROCEDURE sp_refresh_risk()
LANGUAGE plpgsql AS $$
DECLARE
    r        RECORD;
    v_att    NUMERIC;
    v_score  NUMERIC;
    v_level  risk_level_t;
BEGIN
    FOR r IN SELECT srn, mentor_id FROM student LOOP
        v_att   := fn_attendance_pct(r.srn);
        v_score := fn_avg_score_pct(r.srn);
        v_level := fn_classify_risk(v_att, v_score);

        INSERT INTO risk_assessment (srn, attendance_pct, avg_score_pct, risk_level, computed_at)
        VALUES (r.srn, v_att, v_score, v_level, now())
        ON CONFLICT (srn) DO UPDATE
           SET attendance_pct = EXCLUDED.attendance_pct,
               avg_score_pct  = EXCLUDED.avg_score_pct,
               risk_level     = EXCLUDED.risk_level,
               computed_at    = EXCLUDED.computed_at;

        -- open an intervention for HIGH-risk students that have none active
        IF v_level = 'HIGH' AND NOT EXISTS (
               SELECT 1 FROM intervention i
               WHERE i.srn = r.srn AND i.status IN ('OPEN','IN_PROGRESS')) THEN
            INSERT INTO intervention (srn, faculty_id, risk_level, action_type)
            VALUES (r.srn, r.mentor_id, 'HIGH', 'MENTOR_MEETING');
        END IF;
    END LOOP;
END;
$$;

-- 5. Trigger: a score must (a) belong to an assessment of the course the student is enrolled in
--             and (b) not exceed the assessment's maximum marks
CREATE OR REPLACE FUNCTION trg_check_marks() RETURNS TRIGGER AS $$
DECLARE
    v_max             NUMERIC;
    v_assess_offering INT;
    v_enroll_offering INT;
BEGIN
    SELECT max_marks, offering_id INTO v_max, v_assess_offering
    FROM assessment WHERE assessment_id = NEW.assessment_id;
    SELECT offering_id INTO v_enroll_offering
    FROM enrollment WHERE enrollment_id = NEW.enrollment_id;

    IF v_assess_offering IS DISTINCT FROM v_enroll_offering THEN
        RAISE EXCEPTION 'Assessment % does not belong to the course of enrollment %',
                        NEW.assessment_id, NEW.enrollment_id;
    END IF;
    IF NEW.marks_obtained > v_max THEN
        RAISE EXCEPTION 'Marks % exceed maximum % for assessment %',
                        NEW.marks_obtained, v_max, NEW.assessment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_score_check
BEFORE INSERT OR UPDATE ON score
FOR EACH ROW EXECUTE FUNCTION trg_check_marks();

-- 6. Trigger: stamp closed_on and write an audit row when an intervention changes status
CREATE OR REPLACE FUNCTION trg_intervention_status() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status IN ('RESOLVED','CLOSED') AND NEW.closed_on IS NULL THEN
            NEW.closed_on := CURRENT_DATE;
        END IF;
        INSERT INTO audit_log (table_name, record_id, action, detail)
        VALUES ('intervention', NEW.intervention_id::text, 'STATUS_CHANGE',
                OLD.status || ' -> ' || NEW.status || ' (student ' || NEW.srn || ')');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_intervention_update
BEFORE UPDATE ON intervention
FOR EACH ROW EXECUTE FUNCTION trg_intervention_status();

-- 7. View used by the dashboard
CREATE OR REPLACE VIEW v_student_overview AS
SELECT s.srn, s.name, s.semester, s.section, s.mentor_id, f.name AS mentor,
       r.attendance_pct, r.avg_score_pct, r.risk_level, r.computed_at
FROM student s
LEFT JOIN risk_assessment r ON r.srn = s.srn
LEFT JOIN faculty f ON f.faculty_id = s.mentor_id;

-- initial computation
CALL sp_refresh_risk();
