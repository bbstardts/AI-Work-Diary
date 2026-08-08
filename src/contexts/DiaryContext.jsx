import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  loadEntries,
  persistEntries,
  loadReports,
  persistReports,
  loadSettings,
  persistSettings,
  uid
} from '@/lib/diaryStorage';

const DiaryContext = createContext(null);

export function DiaryProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [reports, setReports] = useState([]);
  const [settings, setSettings] = useState({ theme: 'system', name: '', pin: '', biometric: false });
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const e = loadEntries();
    const r = loadReports();
    const s = loadSettings();
    setEntries(e);
    setReports(r);
    setSettings((prev) => ({ ...prev, ...s }));
    // If a PIN is set, the app starts locked.
    setLocked(!!s.pin);
    setReady(true);
  }, []);

  // Persist entries whenever they change (after hydration).
  useEffect(() => {
    if (ready) persistEntries(entries);
  }, [entries, ready]);

  useEffect(() => {
    if (ready) persistReports(reports);
  }, [reports, ready]);

  useEffect(() => {
    if (ready) persistSettings(settings);
  }, [settings, ready]);

  // Apply theme to <html>.
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
      root.classList.toggle('dark', isDark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = apply;
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, [settings.theme]);

  const addEntry = useCallback((data) => {
    const now = new Date().toISOString();
    const entry = { id: uid(), created_date: now, updated_date: now, ...data };
    setEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const updateEntry = useCallback((id, data) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, ...data, updated_date: new Date().toISOString() } : e
      )
    );
  }, []);

  const deleteEntry = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Merge entries restored from cloud backup with what's on-device.
  // Cloud copies are matched to local ones by id; the most recently updated wins.
  const restoreEntries = useCallback((cloudEntries) => {
    setEntries((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      for (const ce of cloudEntries) {
        const existing = byId.get(ce.id);
        if (!existing || new Date(ce.updated_date || 0) > new Date(existing.updated_date || 0)) {
          byId.set(ce.id, ce);
        }
      }
      return Array.from(byId.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    });
  }, []);

  const restoreReports = useCallback((cloudReports) => {
    setReports((prev) => {
      const byWeek = new Map(prev.map((r) => [r.weekStart, r]));
      for (const cr of cloudReports) {
        if (!byWeek.has(cr.weekStart)) byWeek.set(cr.weekStart, cr);
      }
      return Array.from(byWeek.values());
    });
  }, []);

  const saveReport = useCallback((report) => {
    setReports((prev) => {
      const exists = prev.find((r) => r.weekStart === report.weekStart);
      if (exists) {
        return prev.map((r) => (r.weekStart === report.weekStart ? report : r));
      }
      return [...prev, report];
    });
  }, []);

  const setTheme = useCallback((theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setPin = useCallback((pin) => {
    setSettings((prev) => ({ ...prev, pin }));
    // Setting/clearing a PIN shouldn't auto-lock the running session.
  }, []);

  const value = {
    entries,
    reports,
    settings,
    locked,
    ready,
    setLocked,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntries,
    restoreReports,
    saveReport,
    setTheme,
    setPin,
    setSettings
  };

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used within DiaryProvider');
  return ctx;
}