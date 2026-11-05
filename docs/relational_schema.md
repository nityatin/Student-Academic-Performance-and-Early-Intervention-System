# Relational schema

Notation: **PK** primary key, **FK** foreign key, **UK** unique, `CHK` check constraint.
All tables are in 3NF: every non-key attribute depends on the key, the whole key, and nothing but the key.

| Relation | Attributes | Keys and constraints |
|---|---|---|
| department | dept_id, dept_name | PK dept_id; UK dept_name |
| faculty | faculty_id, name, email, dept_id | PK faculty_id; UK email; FK dept_id -> department |
| student | srn, name, email, dept_id, semester, section, mentor_id | PK srn; UK email; FK dept_id -> department; FK mentor_id -> faculty (ON DELETE SET NULL); CHK semester BETWEEN 1 AND 8 |
| course | course_code, title, credits, dept_id | PK course_code; FK dept_id -> department; CHK credits BETWEEN 1 AND 6 |
| course_prerequisite | course_code, prereq_code | PK (course_code, prereq_code); FK both -> course (ON DELETE CASCADE); CHK course_code <> prereq_code |
| course_offering | offering_id, course_code, faculty_id, academic_term | PK offering_id; FK course_code -> course; FK faculty_id -> faculty; UK (course_code, faculty_id, academic_term) |
| enrollment | enrollment_id, srn, offering_id | PK enrollment_id; FK srn -> student (CASCADE); FK offering_id -> course_offering (CASCADE); UK (srn, offering_id) |
| assessment | assessment_id, offering_id, name, max_marks, weightage | PK assessment_id; FK offering_id -> course_offering (CASCADE); UK (offering_id, name); CHK max_marks > 0; CHK weightage in (0, 100] |
| score | enrollment_id, assessment_id, marks_obtained | PK (enrollment_id, assessment_id); FK enrollment_id -> enrollment; FK assessment_id -> assessment (both CASCADE); CHK marks_obtained >= 0; trigger rejects marks above max_marks |
| attendance | enrollment_id, class_date, status | PK (enrollment_id, class_date); FK enrollment_id -> enrollment (CASCADE); status is enum PRESENT/ABSENT |
| risk_assessment | srn, attendance_pct, avg_score_pct, risk_level, computed_at | PK srn; FK srn -> student (CASCADE); risk_level is enum LOW/MEDIUM/HIGH |
| intervention | intervention_id, srn, faculty_id, risk_level, action_type, status, opened_on, closed_on | PK intervention_id; FK srn -> student (CASCADE); FK faculty_id -> faculty (SET NULL); CHK closed_on IS NULL OR closed_on >= opened_on; status is enum OPEN/IN_PROGRESS/RESOLVED/CLOSED |
| app_user | user_id, email, password_hash, full_name, role, faculty_id, srn | PK user_id; UK email; UK faculty_id; UK srn; FK faculty_id -> faculty; FK srn -> student; CHK role_link: ADMIN has neither link, MENTOR has only faculty_id, STUDENT has only srn |
| audit_log | log_id, table_name, record_id, action, detail, logged_at | PK log_id; written only by the intervention-status trigger |

## ER to relational mapping (steps applied)

1. **Strong entities** become tables: department, faculty, student, course, assessment, intervention, app_user.
2. **1:N relationships** become a foreign key on the N side: department->faculty/student/course, faculty->student (mentors), faculty->intervention, student->intervention, course_offering->assessment.
3. **M:N relationships** become junction tables with a composite or surrogate key:
   - student M:N course_offering -> **enrollment**
   - enrollment M:N assessment -> **score** (carries the attribute marks_obtained)
   - course M:N course (self-referencing) -> **course_prerequisite**
4. **1:1 relationship**: student 1:1 risk_assessment shares the primary key (srn is both PK and FK).
5. **Optional 1:1 (login)**: app_user holds nullable, unique FKs to faculty and student; the CHECK constraint forces exactly the link the role needs.
6. **Weak-like entity**: attendance has no key of its own; it is identified by (enrollment_id, class_date).
7. **Enumerated attributes** (risk level, statuses, role) are PostgreSQL ENUM types, so invalid values are rejected by the database.

## Database objects beyond tables

| Object | Name | Purpose |
|---|---|---|
| Function | fn_attendance_pct(srn) | Attendance percentage across all courses |
| Function | fn_avg_score_pct(srn) | Weighted internal score percentage |
| Function | fn_classify_risk(att, score) | HIGH if att < 65 or score < 40; MEDIUM if att < 75 or score < 55; else LOW |
| Procedure | sp_refresh_risk() | Recomputes risk for every student and opens an intervention for HIGH-risk students without an active one |
| Trigger | before_score_check | Rejects marks above the assessment maximum |
| Trigger | before_intervention_update | Stamps closed_on and writes an audit_log row on status change |
| View | v_student_overview | Student + mentor + latest risk, used by the dashboard |
| Index | idx_enrollment_srn, idx_attendance_enroll, idx_intervention_srn | Speed up the common joins and filters |

## MongoDB collections (NoSQL side)

| Collection | Shape | Why it is not relational |
|---|---|---|
| counselling_notes | { srn, author, authorEmail, text, tags[], createdAt, updatedAt? } | Free text with a variable-length tag array; notes differ in length and tags |
| intervention_plans | { srn, goal, steps[{ id, title, done }], resources[{ type, name }], updatedAt } | Nested, per-student documents whose steps and resources vary; read and written as one unit |

`srn` links each document to `student.srn` in PostgreSQL. The API checks the SRN against PostgreSQL before writing to MongoDB.
