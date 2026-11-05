// NoSQL commands (run automatically by the mongo container, or manually with mongosh)
const d = db.getSiblingDB("sapeis");

// Least-privilege account for the web app: read/write on this one database only.
// Its password comes from the MONGO_APP_PASSWORD environment variable (see .env).
const appPassword = process.env.MONGO_APP_PASSWORD;
if (!appPassword) throw new Error("MONGO_APP_PASSWORD is not set");
if (!d.getUser("sapeis_app")) {
  d.createUser({ user: "sapeis_app", pwd: appPassword, roles: [{ role: "readWrite", db: "sapeis" }] });
}

d.counselling_notes.drop();
d.intervention_plans.drop();

d.createCollection("counselling_notes");
d.createCollection("intervention_plans");

d.counselling_notes.createIndex({ srn: 1, createdAt: -1 });
d.counselling_notes.createIndex({ tags: 1 });
d.intervention_plans.createIndex({ srn: 1 }, { unique: true });

d.counselling_notes.insertMany([
  { srn: "PES1UG24CS103", author: "Dr. Shilpa S", authorEmail: "shilpa.s@pes.edu", text: "Missed three consecutive weeks of classes. Mentions long commute and difficulty with OS concepts.", tags: ["attendance", "commute", "os"], createdAt: new Date("2026-09-20") },
  { srn: "PES1UG24CS103", author: "Dr. Shilpa S", authorEmail: "shilpa.s@pes.edu", text: "Agreed to attend weekly doubt-clearing sessions and submit pending assignments.", tags: ["follow-up", "assignments"], createdAt: new Date("2026-10-04") },
  { srn: "PES1UG24CS107", author: "Prof. Meena K", authorEmail: "meena.k@pes.edu", text: "Struggling with Computer Networks and Linear Algebra. Family issues affecting focus.", tags: ["personal", "networks", "maths"], createdAt: new Date("2026-09-25") },
  { srn: "PES1UG24CS111", author: "Dr. Rohan Iyer", authorEmail: "rohan.iyer@pes.edu", text: "Low ISA-1 marks. Needs a structured study plan; open to peer tutoring.", tags: ["marks", "peer-tutoring"], createdAt: new Date("2026-10-01") },
  { srn: "PES1UG24CS105", author: "Dr. Arvind Rao", authorEmail: "arvind.rao@pes.edu", text: "Borderline attendance. Part-time club commitments overlapping with lab hours.", tags: ["attendance", "clubs"], createdAt: new Date("2026-10-06") }
]);

d.intervention_plans.insertMany([
  { srn: "PES1UG24CS103", goal: "Raise attendance above 75% and clear OS backlog topics by ISA-2",
    steps: [ { id: "st1", title: "Weekly mentor check-in", done: true },
             { id: "st2", title: "OS doubt-clearing sessions", done: false },
             { id: "st3", title: "Submit pending assignments", done: false } ],
    resources: [ { type: "peer-tutor", name: "Aarav Sharma" } ], updatedAt: new Date("2026-10-04") },
  { srn: "PES1UG24CS107", goal: "Stabilise performance in CN and Linear Algebra",
    steps: [ { id: "st4", title: "Counselling referral", done: true },
             { id: "st5", title: "Remedial classes for Linear Algebra", done: false } ],
    resources: [], updatedAt: new Date("2026-09-25") },
  { srn: "PES1UG24CS111", goal: "Improve ISA-2 score above 55%",
    steps: [ { id: "st6", title: "Peer tutoring pairing", done: false },
             { id: "st7", title: "Biweekly progress review", done: false } ],
    resources: [ { type: "peer-tutor", name: "Ishita Verma" } ], updatedAt: new Date("2026-10-01") }
]);

print("Seeded: " + d.counselling_notes.countDocuments() + " notes, " + d.intervention_plans.countDocuments() + " plans");
