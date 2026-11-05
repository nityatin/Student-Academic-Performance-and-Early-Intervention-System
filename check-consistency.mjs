// Cross-database consistency check: every MongoDB document must point at data that exists in PostgreSQL.
//   node --env-file=.env scripts/check-consistency.mjs          report only
//   node --env-file=.env scripts/check-consistency.mjs --fix    also delete orphaned MongoDB documents
import pg from "pg";
import { MongoClient } from "mongodb";

// Node's --env-file does not expand ${VAR}, so do it here.
const expand = (v) => (v ?? "").replace(/\$\{(\w+)\}/g, (_, n) => process.env[n] ?? "");
const dbUrl = expand(process.env.DATABASE_URL);
const mongoUrl = expand(process.env.MONGODB_URI);
const mongoDbName = process.env.MONGODB_DB ?? "sapeis";
const fix = process.argv.includes("--fix");

if (!dbUrl || !mongoUrl) {
  console.error("DATABASE_URL / MONGODB_URI missing. Run with: node --env-file=.env scripts/check-consistency.mjs");
  process.exit(2);
}

const results = [];
const record = (name, bad, detail = "") =>
  results.push({ check: name, result: bad === 0 ? "PASS" : "FAIL", problems: bad, detail });

const sql = new pg.Client({ connectionString: dbUrl });
const mongo = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
try {
  await sql.connect();
  await mongo.connect();
} catch (e) {
  console.error("Could not connect to the databases:", e.message);
  process.exit(2);
}

const mdb = mongo.db(mongoDbName);
const students = new Set((await sql.query("SELECT srn FROM student")).rows.map((r) => r.srn));
const staff = new Set((await sql.query("SELECT email FROM app_user WHERE role IN ('ADMIN','MENTOR')")).rows.map((r) => r.email));

for (const coll of ["counselling_notes", "intervention_plans"]) {
  const docs = await mdb.collection(coll).find({}, { projection: { srn: 1 } }).toArray();
  const orphans = docs.filter((d) => !students.has(d.srn));
  record(`${coll}: every srn exists in PostgreSQL student`, orphans.length, orphans.map((o) => o.srn).join(", "));
  if (fix && orphans.length) {
    const r = await mdb.collection(coll).deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
    console.log(`fixed: deleted ${r.deletedCount} orphaned document(s) from ${coll}`);
  }
}

const notes = await mdb.collection("counselling_notes").find({}, { projection: { authorEmail: 1 } }).toArray();
record("counselling_notes: every author is an admin or mentor account", notes.filter((n) => !staff.has(n.authorEmail)).length);

const plans = await mdb.collection("intervention_plans").find({}).toArray();
const badPlans = plans.filter((p) => {
  const ids = (p.steps ?? []).map((s) => s.id);
  return ids.some((i) => !i) || new Set(ids).size !== ids.length;
});
record("intervention_plans: every step has a unique id", badPlans.length, badPlans.map((p) => p.srn).join(", "));

console.table(results);
const failed = results.some((r) => r.result === "FAIL") && !fix;
await sql.end();
await mongo.close();
process.exit(failed ? 1 : 0);
