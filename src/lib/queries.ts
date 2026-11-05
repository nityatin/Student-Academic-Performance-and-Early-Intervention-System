import { pool } from "./pg";
import { getMongoDb } from "./mongo";
import type { Session } from "./token";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface StudentRow {
  srn: string;
  name: string;
  semester: number;
  section: string;
  mentor: string | null;
  attendance_pct: number | null;
  avg_score_pct: number | null;
  risk_level: RiskLevel | null;
}

const OVERVIEW_COLS = `srn, name, semester, section, mentor,
  attendance_pct::float AS attendance_pct, avg_score_pct::float AS avg_score_pct, risk_level`;

// ---------- role scoping ----------
// ADMIN sees every row, MENTOR only their mentees, STUDENT only themselves.
// Adds a WHERE fragment and pushes its parameter onto `params`.
function scopeSql(s: Session, params: unknown[], mentorCol: string, srnCol: string): string {
  if (s.role === "ADMIN") return "TRUE";
  if (s.role === "MENTOR") {
    params.push(s.facultyId);
    return `${mentorCol} = $${params.length}`;
  }
  params.push(s.srn);
  return `${srnCol} = $${params.length}`;
}

export async function canAccessStudent(s: Session, srn: string): Promise<boolean> {
  if (s.role === "ADMIN") return true;
  if (s.role === "STUDENT") return s.srn === srn;
  const { rowCount } = await pool.query("SELECT 1 FROM student WHERE srn = $1 AND mentor_id = $2", [
    srn,
    s.facultyId,
  ]);
  return (rowCount ?? 0) > 0;
}

// ---------- students ----------
export async function listStudents(s: Session, q?: string, risk?: string): Promise<StudentRow[]> {
  const params: unknown[] = [];
  const where: string[] = [scopeSql(s, params, "mentor_id", "srn")];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR srn ILIKE $${params.length})`);
  }
  if (risk && ["LOW", "MEDIUM", "HIGH"].includes(risk)) {
    params.push(risk);
    where.push(`risk_level = $${params.length}`);
  }
  const { rows } = await pool.query<StudentRow>(
    `SELECT ${OVERVIEW_COLS} FROM v_student_overview
     WHERE ${where.join(" AND ")}
     ORDER BY CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, srn`,
    params
  );
  return rows;
}

// ---------- dashboard (ADMIN and MENTOR) ----------
export async function getDashboard(s: Session) {
  const p1: unknown[] = [];
  const w1 = scopeSql(s, p1, "mentor_id", "srn");
  const p2: unknown[] = [];
  const w2 = scopeSql(s, p2, "mentor_id", "srn");
  const p3: unknown[] = [];
  const w3 = scopeSql(s, p3, "st.mentor_id", "i.srn");
  const p4: unknown[] = [];
  const w4 = scopeSql(s, p4, "mentor_id", "srn");

  const [counts, atRisk, openInt, srnRows, audit] = await Promise.all([
    pool.query(
      `SELECT risk_level, COUNT(*)::int AS n FROM v_student_overview
       WHERE ${w1} AND risk_level IS NOT NULL GROUP BY risk_level`,
      p1
    ),
    pool.query<StudentRow>(
      `SELECT ${OVERVIEW_COLS} FROM v_student_overview
       WHERE ${w2} AND risk_level IN ('HIGH','MEDIUM')
       ORDER BY CASE risk_level WHEN 'HIGH' THEN 1 ELSE 2 END, avg_score_pct`,
      p2
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM intervention i JOIN student st ON st.srn = i.srn
       WHERE i.status IN ('OPEN','IN_PROGRESS') AND ${w3}`,
      p3
    ),
    pool.query(`SELECT srn FROM student WHERE ${w4}`, p4),
    s.role === "ADMIN"
      ? pool.query(`SELECT detail, logged_at FROM audit_log ORDER BY logged_at DESC LIMIT 5`)
      : Promise.resolve({ rows: [] as { detail: string; logged_at: string }[] }),
  ]);

  const byRisk: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const r of counts.rows) byRisk[r.risk_level as RiskLevel] = r.n;

  // MongoDB aggregation: most common concern tags, limited to the students this user may see
  let topTags: { tag: string; count: number }[] = [];
  try {
    const mdb = await getMongoDb();
    const pipeline: object[] = [];
    if (s.role !== "ADMIN") {
      pipeline.push({ $match: { srn: { $in: srnRows.rows.map((r) => r.srn) } } });
    }
    pipeline.push(
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 6 }
    );
    const agg = await mdb.collection("counselling_notes").aggregate(pipeline).toArray();
    topTags = agg.map((a) => ({ tag: String(a._id), count: Number(a.count) }));
  } catch {
    topTags = [];
  }

  return {
    byRisk,
    atRisk: atRisk.rows,
    openInterventions: openInt.rows[0].n as number,
    audit: audit.rows as { detail: string; logged_at: string }[],
    topTags,
  };
}

// ---------- student detail ----------
export interface NoteView {
  _id: string;
  author: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string | null;
  canEdit: boolean;
}

// Returns null when the student does not exist or this user may not see them.
export async function getStudentDetail(s: Session, srn: string, tag?: string) {
  if (!(await canAccessStudent(s, srn))) return null;

  const overview = await pool.query<StudentRow>(
    `SELECT ${OVERVIEW_COLS} FROM v_student_overview WHERE srn = $1`,
    [srn]
  );
  if (overview.rowCount === 0) return null;

  const [courses, scores, interventions] = await Promise.all([
    pool.query(
      `SELECT c.course_code, c.title, f.name AS faculty,
              COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE at.status = 'PRESENT')
                       / NULLIF(COUNT(at.*), 0), 1), 0)::float AS attendance_pct
       FROM enrollment e
       JOIN course_offering o ON o.offering_id = e.offering_id
       JOIN course c ON c.course_code = o.course_code
       JOIN faculty f ON f.faculty_id = o.faculty_id
       LEFT JOIN attendance at ON at.enrollment_id = e.enrollment_id
       WHERE e.srn = $1
       GROUP BY c.course_code, c.title, f.name
       ORDER BY c.course_code`,
      [srn]
    ),
    pool.query(
      `SELECT o.course_code, a.name AS assessment, sc.marks_obtained::float AS marks,
              a.max_marks::float AS max_marks
       FROM score sc
       JOIN enrollment e ON e.enrollment_id = sc.enrollment_id
       JOIN assessment a ON a.assessment_id = sc.assessment_id
       JOIN course_offering o ON o.offering_id = e.offering_id
       WHERE e.srn = $1
       ORDER BY o.course_code, a.assessment_id`,
      [srn]
    ),
    pool.query(
      `SELECT i.intervention_id, i.risk_level, i.action_type, i.status, i.opened_on, i.closed_on,
              f.name AS faculty
       FROM intervention i LEFT JOIN faculty f ON f.faculty_id = i.faculty_id
       WHERE i.srn = $1 ORDER BY i.opened_on DESC, i.intervention_id DESC`,
      [srn]
    ),
  ]);

  let notes: NoteView[] = [];
  let allTags: string[] = [];
  let plan: {
    goal: string;
    steps: { id: string; title: string; done: boolean }[];
    resources: { type: string; name: string }[];
  } | null = null;
  try {
    const mdb = await getMongoDb();
    const filter = tag ? { srn, tags: tag } : { srn };
    const rawNotes = await mdb.collection("counselling_notes").find(filter).sort({ createdAt: -1 }).toArray();
    notes = rawNotes.map((n) => ({
      _id: String(n._id),
      author: n.author,
      text: n.text,
      tags: n.tags ?? [],
      createdAt: new Date(n.createdAt).toISOString(),
      updatedAt: n.updatedAt ? new Date(n.updatedAt).toISOString() : null,
      canEdit: s.role === "ADMIN" || (s.role === "MENTOR" && n.authorEmail === s.email),
    }));
    allTags = ((await mdb.collection("counselling_notes").distinct("tags", { srn })) as string[]).sort();
    const p = await mdb.collection("intervention_plans").findOne({ srn });
    if (p) {
      plan = {
        goal: p.goal,
        steps: (p.steps ?? []).map((st: { id?: string; title: string; done: boolean }, i: number) => ({
          id: st.id ?? `legacy-${i}`,
          title: st.title,
          done: !!st.done,
        })),
        resources: p.resources ?? [],
      };
    }
  } catch {
    /* MongoDB unavailable: page still renders the SQL data */
  }

  return {
    student: overview.rows[0],
    courses: courses.rows,
    scores: scores.rows,
    interventions: interventions.rows,
    notes,
    allTags,
    plan,
    canManage: s.role === "ADMIN" || s.role === "MENTOR",
  };
}

// ---------- interventions (ADMIN and MENTOR) ----------
export async function listInterventions(s: Session, status?: string) {
  const params: unknown[] = [];
  const where: string[] = [scopeSql(s, params, "st.mentor_id", "i.srn")];
  if (status && ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
    params.push(status);
    where.push(`i.status = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT i.intervention_id, i.srn, st.name AS student, i.risk_level, i.action_type, i.status,
            i.opened_on, i.closed_on, f.name AS faculty
     FROM intervention i
     JOIN student st ON st.srn = i.srn
     LEFT JOIN faculty f ON f.faculty_id = i.faculty_id
     WHERE ${where.join(" AND ")}
     ORDER BY CASE i.status WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END, i.opened_on DESC`,
    params
  );
  return rows;
}
