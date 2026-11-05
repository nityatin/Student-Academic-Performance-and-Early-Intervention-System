-- ============================================================
-- DML: sample data
-- ============================================================
INSERT INTO department (dept_name) VALUES ('Computer Science & Engineering'), ('Electronics & Communication');

INSERT INTO faculty (name, email, dept_id) VALUES
 ('Dr. Shilpa S',     'shilpa.s@pes.edu',    1),
 ('Dr. Arvind Rao',   'arvind.rao@pes.edu',  1),
 ('Prof. Meena K',    'meena.k@pes.edu',     1),
 ('Dr. Rohan Iyer',   'rohan.iyer@pes.edu',  1);

INSERT INTO course (course_code, title, credits, dept_id) VALUES
 ('UE24CS251A', 'Database Management Systems', 4, 1),
 ('UE24CS252A', 'Operating Systems',           4, 1),
 ('UE24CS253A', 'Computer Networks',           4, 1),
 ('UE24MA241A', 'Linear Algebra',              4, 1),
 ('UE24CS254A', 'Design & Analysis of Algorithms', 4, 1),
 ('UE24CS101A', 'Problem Solving with C',      4, 1),
 ('UE24CS151A', 'Data Structures and its Applications', 4, 1),
 ('UE24MA141A', 'Discrete Mathematics',        4, 1);

-- prerequisite chains (course -> course that must come first)
INSERT INTO course_prerequisite (course_code, prereq_code) VALUES
 ('UE24CS151A', 'UE24CS101A'),   -- Data Structures needs C
 ('UE24CS251A', 'UE24CS151A'),   -- DBMS needs Data Structures
 ('UE24CS252A', 'UE24CS151A'),   -- OS needs Data Structures
 ('UE24CS254A', 'UE24CS151A'),   -- DAA needs Data Structures
 ('UE24CS253A', 'UE24CS252A'),   -- Computer Networks needs OS
 ('UE24MA241A', 'UE24MA141A');   -- Linear Algebra needs Discrete Maths

INSERT INTO course_offering (course_code, faculty_id, academic_term) VALUES
 ('UE24CS251A', 1, 'AUG-DEC 2026'),
 ('UE24CS252A', 2, 'AUG-DEC 2026'),
 ('UE24CS253A', 3, 'AUG-DEC 2026'),
 ('UE24MA241A', 4, 'AUG-DEC 2026'),
 ('UE24CS254A', 2, 'AUG-DEC 2026');

INSERT INTO student (srn, name, email, dept_id, semester, section, mentor_id) VALUES
 ('PES1UG24CS101','Aarav Sharma',   'aarav.sharma@stu.pes.edu',   1,3,'A',1),
 ('PES1UG24CS102','Diya Nair',      'diya.nair@stu.pes.edu',      1,3,'A',1),
 ('PES1UG24CS103','Kabir Menon',    'kabir.menon@stu.pes.edu',    1,3,'A',1),
 ('PES1UG24CS104','Ishita Verma',   'ishita.verma@stu.pes.edu',   1,3,'A',2),
 ('PES1UG24CS105','Rahul Gowda',    'rahul.gowda@stu.pes.edu',    1,3,'A',2),
 ('PES1UG24CS106','Sneha Reddy',    'sneha.reddy@stu.pes.edu',    1,3,'B',2),
 ('PES1UG24CS107','Vihaan Patel',   'vihaan.patel@stu.pes.edu',   1,3,'B',3),
 ('PES1UG24CS108','Ananya Iyer',    'ananya.iyer@stu.pes.edu',    1,3,'B',3),
 ('PES1UG24CS109','Arjun Kulkarni', 'arjun.kulkarni@stu.pes.edu',1,3,'B',3),
 ('PES1UG24CS110','Meera Joshi',    'meera.joshi@stu.pes.edu',    1,3,'B',4),
 ('PES1UG24CS111','Rohit Bhat',     'rohit.bhat@stu.pes.edu',     1,3,'B',4),
 ('PES1UG24CS112','Tanvi Shetty',   'tanvi.shetty@stu.pes.edu',   1,3,'B',4);

-- every student enrolls in all 5 offerings
INSERT INTO enrollment (srn, offering_id)
SELECT s.srn, o.offering_id FROM student s CROSS JOIN course_offering o;

-- assessments: ISA-1 (40, 20%), ISA-2 (40, 20%), Assignment (10, 10%), ESA (100, 50%)
INSERT INTO assessment (offering_id, name, max_marks, weightage)
SELECT o.offering_id, a.name, a.max_marks, a.weightage
FROM course_offering o
CROSS JOIN (VALUES ('ISA-1',40,20),('ISA-2',40,20),('Assignment',10,10)) AS a(name,max_marks,weightage);

-- scores: deterministic spread so some students end up weak (student index drives performance)
INSERT INTO score (enrollment_id, assessment_id, marks_obtained)
SELECT e.enrollment_id, a.assessment_id,
       ROUND( a.max_marks * LEAST(0.97, GREATEST(0.12,
              q.base + ((e.enrollment_id * 7 + a.assessment_id * 13) % 15 - 7) / 100.0)) , 2)
FROM enrollment e
JOIN assessment a ON a.offering_id = e.offering_id
JOIN (VALUES ('PES1UG24CS101',0.88),('PES1UG24CS102',0.79),('PES1UG24CS103',0.34),
             ('PES1UG24CS104',0.91),('PES1UG24CS105',0.52),('PES1UG24CS106',0.73),
             ('PES1UG24CS107',0.28),('PES1UG24CS108',0.84),('PES1UG24CS109',0.58),
             ('PES1UG24CS110',0.67),('PES1UG24CS111',0.41),('PES1UG24CS112',0.76)) AS q(srn, base)
  ON q.srn = e.srn;

-- attendance: 30 class days per enrollment; absence probability depends on the student
INSERT INTO attendance (enrollment_id, class_date, status)
SELECT e.enrollment_id,
       (DATE '2026-08-17' + d.n) ,
       CASE WHEN ((e.enrollment_id * 31 + d.n * 17) % 100) < q.present_pct
            THEN 'PRESENT'::attendance_status_t ELSE 'ABSENT'::attendance_status_t END
FROM enrollment e
CROSS JOIN generate_series(0, 29) AS d(n)
JOIN (VALUES ('PES1UG24CS101',95),('PES1UG24CS102',88),('PES1UG24CS103',58),
             ('PES1UG24CS104',96),('PES1UG24CS105',72),('PES1UG24CS106',85),
             ('PES1UG24CS107',50),('PES1UG24CS108',92),('PES1UG24CS109',70),
             ('PES1UG24CS110',80),('PES1UG24CS111',62),('PES1UG24CS112',87)) AS q(srn, present_pct)
  ON q.srn = e.srn;

-- ============================================================
-- Login accounts (demo passwords, hashed with bcrypt via pgcrypto)
--   admin@pes.edu / Admin@123
--   every faculty email / Mentor@123
--   every student email / Student@123
-- ============================================================
INSERT INTO app_user (email, password_hash, full_name, role)
VALUES ('admin@pes.edu', crypt('Admin@123', gen_salt('bf', 10)), 'Department Admin', 'ADMIN');

INSERT INTO app_user (email, password_hash, full_name, role, faculty_id)
SELECT email, crypt('Mentor@123', gen_salt('bf', 10)), name, 'MENTOR', faculty_id FROM faculty;

INSERT INTO app_user (email, password_hash, full_name, role, srn)
SELECT email, crypt('Student@123', gen_salt('bf', 10)), name, 'STUDENT', srn FROM student;
