// Pure utility for database health inspection.
// Read-only. No side effects. No dependencies on UI, routes, or local storage.

import { DB } from "./store";

export type HealthIssue = {
  type:
    | "DUPLICATE"
    | "ORPHAN"
    | "INVALID_ID"
    | "SUSPICIOUS_CONTENT"
    | "MISSING_FIELD"
    | "INVALID_VALUE";
  description: string;
};

export type DatabaseHealthReport = {
  healthy: boolean;
  counts: {
    subjects: number;
    topics: number;
    quizzes: number;
    bookmarks: number;
    wrong_answers: number;
  };
  warnings: HealthIssue[];
  errors: HealthIssue[];
};

function isUUID(s: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(s);
}

export function runDatabaseHealthAudit(db: DB): DatabaseHealthReport {
  const report: DatabaseHealthReport = {
    healthy: true,
    counts: {
      subjects: db.subjects.length,
      topics: db.topics.length,
      quizzes: db.quizzes.length,
      bookmarks: db.bookmarks.length,
      wrong_answers: db.wrong_answers.length,
    },
    warnings: [],
    errors: [],
  };

  // 1. Duplicate Subject names
  const subjectNames = new Set<string>();
  for (const s of db.subjects) {
    if (!s.name.trim())
      report.errors.push({
        type: "INVALID_VALUE",
        description: `Empty subject name (ID: ${s.id})`,
      });
    else if (subjectNames.has(s.name))
      report.errors.push({ type: "DUPLICATE", description: `Duplicate subject name: ${s.name}` });
    else subjectNames.add(s.name);

    if (isUUID(s.name))
      report.warnings.push({
        type: "SUSPICIOUS_CONTENT",
        description: `Subject name looks like UUID: ${s.name} (ID: ${s.id})`,
      });
  }

  // 2. Duplicate Topic names inside same Subject
  for (const s of db.subjects) {
    const topicNames = new Set<string>();
    for (const t of db.topics.filter((t) => t.subject_id === s.id)) {
      if (!t.name.trim())
        report.errors.push({
          type: "INVALID_VALUE",
          description: `Empty topic name (ID: ${t.id})`,
        });
      else if (topicNames.has(t.name))
        report.errors.push({
          type: "DUPLICATE",
          description: `Duplicate topic name '${t.name}' in subject '${s.name}'`,
        });
      else topicNames.add(t.name);

      if (isUUID(t.name))
        report.warnings.push({
          type: "SUSPICIOUS_CONTENT",
          description: `Topic name looks like UUID: ${t.name} (ID: ${t.id})`,
        });
    }
  }

  // 3. Orphan Topics
  for (const t of db.topics) {
    if (!db.subjects.some((s) => s.id === t.subject_id)) {
      report.errors.push({
        type: "ORPHAN",
        description: `Orphan topic: ${t.name} (ID: ${t.id}) references missing subject ${t.subject_id}`,
      });
    }
    if (t.created_at <= 0 || isNaN(t.created_at))
      report.errors.push({
        type: "INVALID_VALUE",
        description: `Invalid timestamp in topic ${t.id}`,
      });
  }

  // 4. Orphan Quizzes
  for (const q of db.quizzes) {
    if (q.subject_id && !db.subjects.some((s) => s.id === q.subject_id)) {
      report.errors.push({
        type: "ORPHAN",
        description: `Orphan quiz: ${q.title} (ID: ${q.id}) references missing subject ${q.subject_id}`,
      });
    }
    if (q.topic_id && !db.topics.some((t) => t.id === q.topic_id)) {
      report.errors.push({
        type: "ORPHAN",
        description: `Orphan quiz: ${q.title} (ID: ${q.id}) references missing topic ${q.topic_id}`,
      });
    }
    if (isUUID(q.title))
      report.warnings.push({
        type: "SUSPICIOUS_CONTENT",
        description: `Quiz title looks like UUID: ${q.title} (ID: ${q.id})`,
      });
  }

  // 12 & 13. Invalid Bookmark/Wrong refs
  // Note: These refer to topic_name (string), not topic_id (UUID), so orphan check is different
  for (const b of db.bookmarks) {
    if (b.topic_name && !db.topics.some((t) => t.name === b.topic_name)) {
      report.warnings.push({
        type: "ORPHAN",
        description: `Bookmark references non-existent topic name: ${b.topic_name}`,
      });
    }
  }
  for (const w of db.wrong_answers) {
    if (w.topic_name && !db.topics.some((t) => t.name === w.topic_name)) {
      report.warnings.push({
        type: "ORPHAN",
        description: `Wrong answer references non-existent topic name: ${w.topic_name}`,
      });
    }
  }

  report.healthy = report.errors.length === 0;
  return report;
}
