// MongoDB commands used by the project. Run interactively with:
//   docker exec -it sapeis-mongo mongosh sapeis
// then paste any block below.

// ---------- CREATE ----------
db.counselling_notes.insertOne({
  srn: "PES1UG24CS105", author: "Dr. Arvind Rao", authorEmail: "arvind.rao@pes.edu",
  text: "Agreed to reduce club hours during lab days.", tags: ["attendance", "follow-up"],
  createdAt: new Date()
});

// ---------- READ ----------
db.counselling_notes.find({ srn: "PES1UG24CS103" }).sort({ createdAt: -1 });          // all notes of a student
db.counselling_notes.find({ tags: "attendance" });                                      // filter by tag
db.counselling_notes.find({ srn: "PES1UG24CS103", tags: { $in: ["os", "marks"] } });    // any of several tags
db.counselling_notes.distinct("tags", { srn: "PES1UG24CS103" });                        // tag list for one student
db.intervention_plans.findOne({ srn: "PES1UG24CS103" });

// Aggregation: most common concern tags across all notes
db.counselling_notes.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } },
  { $limit: 6 }
]);

// ---------- UPDATE ----------
db.counselling_notes.updateOne(
  { srn: "PES1UG24CS103", tags: "follow-up" },
  { $set: { text: "Attended 2 of 3 doubt-clearing sessions.", updatedAt: new Date() }, $addToSet: { tags: "progress" } }
);
db.intervention_plans.updateOne(                                                        // tick one plan step (positional operator)
  { srn: "PES1UG24CS103", "steps.id": "st2" },
  { $set: { "steps.$.done": true, updatedAt: new Date() } }
);
db.intervention_plans.updateOne(                                                        // add a plan step
  { srn: "PES1UG24CS103" },
  { $push: { steps: { id: "st99", title: "Mock ISA-2 practice test", done: false } } }
);

// ---------- DELETE ----------
db.intervention_plans.updateOne({ srn: "PES1UG24CS103" }, { $pull: { steps: { id: "st99" } } });  // remove one step
db.counselling_notes.deleteOne({ srn: "PES1UG24CS105", tags: "follow-up" });                      // remove a note
