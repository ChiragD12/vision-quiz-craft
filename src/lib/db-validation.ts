// Pure utility library for database validation.
// No side effects, no dependencies on React, routes, or local storage.

export function isUUID(s: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(s);
}

export type ValidationResult = { ok: true } | { ok: false; code: string; message: string };

export function validateTopic(db: any, topicId: string): ValidationResult {
  const exists = db.topics?.some((t: any) => t.id === topicId);
  return exists
    ? { ok: true }
    : { ok: false, code: "INVALID_TOPIC", message: `Topic ID ${topicId} not found.` };
}

export function validateSubject(db: any, subjectId: string): ValidationResult {
  const exists = db.subjects?.some((s: any) => s.id === subjectId);
  return exists
    ? { ok: true }
    : { ok: false, code: "INVALID_SUBJECT", message: `Subject ID ${subjectId} not found.` };
}

export function runDiagnosticValidation(db: any): any {
  const report = [];

  // Duplicates
  const subjectNames = new Set();
  for (const s of db.subjects || []) {
    if (subjectNames.has(s.name)) report.push(`Duplicate subject name: ${s.name}`);
    subjectNames.add(s.name);
  }

  // Orphan Topics
  for (const t of db.topics || []) {
    if (!db.subjects?.some((s: any) => s.id === t.subject_id)) {
      report.push(`Orphan topic: ${t.name} (ID: ${t.id})`);
    }
  }

  return { ok: report.length === 0, report };
}
