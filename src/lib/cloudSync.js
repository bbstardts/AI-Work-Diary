// Cloud backup/restore for Work Diary AI.
// The app stays offline-first: everything keeps working from localStorage regardless.
// This is an *optional* sync layer — it pushes/pulls to the same Base44 account
// already used for login and AI, so no second service or config is needed.

import { base44 } from '@/api/base44Client';

const LAST_BACKUP_KEY = 'wda_last_backup_v1';

export function getLastBackupTime() {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

function setLastBackupTime() {
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

// Push all local entries + reports to the user's Base44 account.
// Existing cloud records (matched by local_id / weekStart) are updated in place
// rather than duplicated.
export async function backupNow(entries, reports) {
  const [cloudEntries, cloudReports] = await Promise.all([
    base44.entities.DiaryEntry.list(),
    base44.entities.DiaryReport.list()
  ]);
  const entryByLocalId = new Map(cloudEntries.map((c) => [c.local_id, c]));
  const reportByWeek = new Map(cloudReports.map((c) => [c.weekStart, c]));

  const toCreateEntries = [];
  for (const e of entries) {
    const payload = {
      local_id: e.id,
      date: e.date,
      time: e.time,
      department: e.department,
      tasks: e.tasks,
      itemsReceived: e.itemsReceived,
      itemsIssued: e.itemsIssued,
      problems: e.problems,
      solutions: e.solutions,
      observations: e.observations,
      photos: e.photos || [],
      updated_at: e.updated_date || new Date().toISOString()
    };
    const existing = entryByLocalId.get(e.id);
    if (existing) {
      // Skip the round trip if nothing changed since the last backup.
      if (existing.updated_at !== payload.updated_at) {
        await base44.entities.DiaryEntry.update(existing.id, payload);
      }
    } else {
      toCreateEntries.push(payload);
    }
  }
  if (toCreateEntries.length > 0) {
    await base44.entities.DiaryEntry.bulkCreate(toCreateEntries);
  }

  const toCreateReports = [];
  for (const r of reports) {
    if (!reportByWeek.has(r.weekStart)) {
      toCreateReports.push(r);
    }
  }
  if (toCreateReports.length > 0) {
    await base44.entities.DiaryReport.bulkCreate(toCreateReports);
  }

  setLastBackupTime();
  return { entriesBackedUp: entries.length, reportsBackedUp: reports.length };
}

// Pull everything from the cloud so it can be merged into local storage
// (e.g. after reinstalling the app or moving to a new device).
export async function restoreFromCloud() {
  const [cloudEntries, cloudReports] = await Promise.all([
    base44.entities.DiaryEntry.list(),
    base44.entities.DiaryReport.list()
  ]);

  const entries = cloudEntries.map((c) => ({
    id: c.local_id,
    date: c.date,
    time: c.time,
    department: c.department,
    tasks: c.tasks,
    itemsReceived: c.itemsReceived,
    itemsIssued: c.itemsIssued,
    problems: c.problems,
    solutions: c.solutions,
    observations: c.observations,
    photos: c.photos || [],
    updated_date: c.updated_at,
    created_date: c.updated_at
  }));

  const reports = cloudReports.map((c) => ({
    weekStart: c.weekStart,
    weekEnd: c.weekEnd,
    title: c.title,
    summary: c.summary,
    achievements: c.achievements || [],
    challenges: c.challenges || [],
    resolutions: c.resolutions || [],
    recurring_problems: c.recurring_problems || [],
    productivity: c.productivity,
    recommendations: c.recommendations || [],
    daily_summaries: c.daily_summaries || [],
    generatedAt: c.generatedAt
  }));

  return { entries, reports };
}
