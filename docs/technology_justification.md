# Technology justification

**PostgreSQL for the core records.** Students, courses, enrollments, marks and attendance are highly structured and interlinked. They need foreign keys, CHECK constraints, transactions and joins, so a relational database is the natural fit. PostgreSQL also gave us features the project uses directly: ENUM types, PL/pgSQL functions, stored procedures, triggers, recursive CTEs, window functions and the pgcrypto extension for bcrypt password hashing.

**MongoDB for counselling notes and improvement plans.** A note is free text with a variable number of tags, and a plan is a nested document with steps that change as the mentor works. Storing these as documents avoids a many-column or many-table design for loosely structured data, and the aggregation pipeline gives a simple way to count common concern tags. Each document carries the student's SRN, which ties it back to the relational record.

**Why both, not one.** Each database holds the kind of data it handles best: strict, constrained records in PostgreSQL, flexible narrative data in MongoDB. Only PostgreSQL decides who a student is and what their risk level is, so the NoSQL side can change shape without affecting grading logic.

**Next.js with TypeScript for frontend and backend.** Next.js Route Handlers act as the API layer, so one codebase, one language and one deployment cover pages and endpoints. TypeScript catches mismatched data shapes between the database layer and the UI at build time. Server components query the database directly, and client components call the Route Handlers for changes.

**Authentication and authorisation.** Passwords are stored as bcrypt hashes. A successful login issues a signed JWT in an HttpOnly, SameSite cookie that expires after 8 hours. Middleware redirects signed-out users, and every Route Handler re-checks the role and the record ownership, so the rules hold even if someone calls the API directly. Login attempts are throttled per email and IP.

**Docker Compose for setup.** One command starts both databases and loads the schema, data and Mongo seed, so the project runs identically on any machine.
