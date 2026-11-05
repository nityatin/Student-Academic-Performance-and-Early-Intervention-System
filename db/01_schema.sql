-- ============================================================
-- Student Academic Performance & Early Intervention System
-- PostgreSQL schema (DDL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- bcrypt password hashing (crypt / gen_salt)

DROP TABLE IF EXISTS app_user, course_prerequisite, audit_log, intervention, risk_assessment,
                     attendance, score, assessment, enrollment, course_offering, course,
                     student, faculty, department CASCADE;
DROP TYPE IF EXISTS risk_level_t, intervention_status_t, attendance_status_t, user_role_t CASCADE;

CREATE TYPE risk_level_t          AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE intervention_status_t AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE attendance_status_t   AS ENUM ('PRESENT', 'ABSENT');
CREATE TYPE user_role_t           AS ENUM ('ADMIN', 'MENTOR', 'STUDENT');

CREATE TABLE department (
    dept_id    SERIAL PRIMARY KEY,
    dept_name  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE faculty (
    faculty_id SERIAL PRIMARY KEY,
    name       VARCHAR(80)  NOT NULL,
    email      VARCHAR(120) NOT NULL UNIQUE,
    dept_id    INT NOT NULL REFERENCES department(dept_id)
);

CREATE TABLE student (
    srn        VARCHAR(15) PRIMARY KEY,               -- e.g. PES1UG24CS101
    name       VARCHAR(80)  NOT NULL,
    email      VARCHAR(120) NOT NULL UNIQUE,
    dept_id    INT NOT NULL REFERENCES department(dept_id),
    semester   INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    section    CHAR(1) NOT NULL,
    mentor_id  INT REFERENCES faculty(faculty_id) ON DELETE SET NULL
);

CREATE TABLE course (
    course_code VARCHAR(12) PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    credits     INT NOT NULL CHECK (credits BETWEEN 1 AND 6),
    dept_id     INT NOT NULL REFERENCES department(dept_id)
);

-- Self-referencing M:N on course: which courses must be completed before another (used by the recursive CTE)
CREATE TABLE course_prerequisite (
    course_code VARCHAR(12) NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
    prereq_code VARCHAR(12) NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
    PRIMARY KEY (course_code, prereq_code),
    CHECK (course_code <> prereq_code)
);

CREATE TABLE course_offering (
    offering_id   SERIAL PRIMARY KEY,
    course_code   VARCHAR(12) NOT NULL REFERENCES course(course_code),
    faculty_id    INT NOT NULL REFERENCES faculty(faculty_id),
    academic_term VARCHAR(12) NOT NULL,               -- e.g. AUG-DEC 2026
    UNIQUE (course_code, faculty_id, academic_term)
);

CREATE TABLE enrollment (
    enrollment_id SERIAL PRIMARY KEY,
    srn           VARCHAR(15) NOT NULL REFERENCES student(srn) ON DELETE CASCADE,
    offering_id   INT NOT NULL REFERENCES course_offering(offering_id) ON DELETE CASCADE,
    UNIQUE (srn, offering_id)
);

CREATE TABLE assessment (
    assessment_id SERIAL PRIMARY KEY,
    offering_id   INT NOT NULL REFERENCES course_offering(offering_id) ON DELETE CASCADE,
    name          VARCHAR(30) NOT NULL,               -- ISA-1, ISA-2, Assignment, ESA
    max_marks     NUMERIC(5,2) NOT NULL CHECK (max_marks > 0),
    weightage     NUMERIC(5,2) NOT NULL CHECK (weightage > 0 AND weightage <= 100),
    UNIQUE (offering_id, name)
);

CREATE TABLE score (
    enrollment_id  INT NOT NULL REFERENCES enrollment(enrollment_id) ON DELETE CASCADE,
    assessment_id  INT NOT NULL REFERENCES assessment(assessment_id) ON DELETE CASCADE,
    marks_obtained NUMERIC(5,2) NOT NULL CHECK (marks_obtained >= 0),
    PRIMARY KEY (enrollment_id, assessment_id)
);

CREATE TABLE attendance (
    enrollment_id INT NOT NULL REFERENCES enrollment(enrollment_id) ON DELETE CASCADE,
    class_date    DATE NOT NULL,
    status        attendance_status_t NOT NULL,
    PRIMARY KEY (enrollment_id, class_date)
);

CREATE TABLE risk_assessment (
    srn            VARCHAR(15) PRIMARY KEY REFERENCES student(srn) ON DELETE CASCADE,
    attendance_pct NUMERIC(5,2) NOT NULL,
    avg_score_pct  NUMERIC(5,2) NOT NULL,
    risk_level     risk_level_t NOT NULL,
    computed_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE intervention (
    intervention_id SERIAL PRIMARY KEY,
    srn             VARCHAR(15) NOT NULL REFERENCES student(srn) ON DELETE CASCADE,
    faculty_id      INT REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    risk_level      risk_level_t NOT NULL,
    action_type     VARCHAR(40) NOT NULL DEFAULT 'MENTOR_MEETING',
    status          intervention_status_t NOT NULL DEFAULT 'OPEN',
    opened_on       DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_on       DATE,
    CHECK (closed_on IS NULL OR closed_on >= opened_on)
);

CREATE TABLE audit_log (
    log_id     SERIAL PRIMARY KEY,
    table_name VARCHAR(40) NOT NULL,
    record_id  VARCHAR(40) NOT NULL,
    action     VARCHAR(20) NOT NULL,
    detail     TEXT,
    logged_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Login accounts. Each account is linked to exactly the entity its role implies.
CREATE TABLE app_user (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     VARCHAR(80) NOT NULL,
    role          user_role_t NOT NULL,
    faculty_id    INT UNIQUE REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    srn           VARCHAR(15) UNIQUE REFERENCES student(srn) ON DELETE CASCADE,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT chk_role_link CHECK (
        (role = 'ADMIN'   AND faculty_id IS NULL     AND srn IS NULL) OR
        (role = 'MENTOR'  AND faculty_id IS NOT NULL AND srn IS NULL) OR
        (role = 'STUDENT' AND srn IS NOT NULL        AND faculty_id IS NULL))
);

CREATE INDEX idx_enrollment_srn     ON enrollment(srn);
CREATE INDEX idx_attendance_enroll  ON attendance(enrollment_id);
CREATE INDEX idx_intervention_srn   ON intervention(srn, status);
