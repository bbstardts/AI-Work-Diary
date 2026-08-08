import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, FileText, Bot, MessageCircle, Settings as SettingsIcon, Plus, Search, Lock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { DiaryProvider, useDiary } from '@/contexts/DiaryContext';
import LockScreen from '@/components/LockScreen';
import EntryForm from '@/components/EntryForm';
import EntryCard from '@/components/EntryCard';
import EntryDetail from '@/components/EntryDetail';
import AIPanel from '@/components/AIPanel';
import AIChat from '@/components/AIChat';
import WeeklyReport from '@/components/WeeklyReport';
import SettingsPanel from '@/components/Settings';
import { fmt, weekRangeFor, entriesInWeek } from '@/lib/dateUtils';
import { base44 } from '@/api/base44Client';
import { checkAndNotify } from '@/lib/reminder';

const TABS = [
  { key: 'diary', label: 'Diary', icon: BookOpen },
  { key: 'report', label: 'Report', icon: FileText },
  { key: 'chat', label: 'Ask', icon: MessageCircle },
  { key: 'ai', label: 'AI', icon: Bot },
  { key: 'settings', label: 'Settings', icon: SettingsIcon }
];

function DiaryView({ entries, onOpen }) {
  const { deleteEntry } = useDiary();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const departments = useMemo(() => {
    const set = new Set(entries.map((e) => e.department).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entries.filter((e) => {
      if (dept !== 'all' && e.department !== dept) return false;
      if (!q) return true;
      return [e.date, e.department, e.tasks, e.problems, e.solutions, e.observations]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [entries, query, dept]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const key = e.date || 'No date';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const handleNew = () => { setEditing(null); setShowForm(true); };
  const handleEdit = (entry) => { setEditing(entry); setShowForm(true); };

  // The floating "+" button lives outside DiaryView; bridge via a window event.
  useEffect(() => {
    const handler = () => handleNew();
    window.addEventListener('open-new-entry', handler);
    return () => window.removeEventListener('open-new-entry', handler);
  }, []);

  const handleDelete = (entry) => {
    if (window.confirm(`Delete the entry from ${entry.date}? This cannot be undone.`)) {
      deleteEntry(entry.id);
      toast({ title: 'Entry deleted' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries…"
            className="pl-9 bg-background"
          />
        </div>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 text-sm"
        >
          {departments.map((d) => (
            <option key={d} value={d}>{d === 'all' ? 'All depts' : d}</option>
          ))}
        </select>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No entries yet</p>
          <p className="text-sm">Tap the + button to record your first day.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5" />
                {fmt(new Date(date), 'EEE, MMM d, yyyy')}
                <span className="opacity-50">· {items.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map((e) => (
                  <EntryCard key={e.id} entry={e} onOpen={onOpen} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <EntryForm entry={editing} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function Shell() {
  const { locked, ready, settings, setLocked, entries, reports, saveReport } = useDiary();
  const { toast } = useToast();
  const [tab, setTab] = useState('diary');
  const [detail, setDetail] = useState(null);
  const [editFromDetail, setEditFromDetail] = useState(null);
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Open the diary tab by default on Sunday so the weekly report is one tap away.
  useEffect(() => {
    if (ready && new Date().getDay() === 0 && entries.length > 0) setTab('report');
  }, [ready]);

  // Check the "write today's entry" reminder whenever the app opens or
  // comes back to the foreground (e.g. swiped back in from the home screen).
  useEffect(() => {
    if (!ready) return;
    checkAndNotify(entries);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkAndNotify(entries);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ready, entries]);

  // Every Sunday, automatically generate the Mon–Sat weekly report in the background
  // if it doesn't already exist — no button tap required.
  useEffect(() => {
    if (!ready) return;
    const today = new Date();
    if (today.getDay() !== 0) return; // only runs on Sunday

    const lastWeekAnchor = new Date(today.getTime() - 7 * 86400000);
    const range = weekRangeFor(lastWeekAnchor);
    const alreadyExists = reports.some((r) => r.weekStart === range.weekStart);
    if (alreadyExists) return;

    const weekEntries = entriesInWeek(entries, lastWeekAnchor);
    if (weekEntries.length === 0) return; // nothing to report on

    let cancelled = false;
    setAutoGenerating(true);
    base44.functions
      .invoke('aiAssistant', {
        action: 'weekly_report',
        entries: weekEntries,
        weekStart: range.weekStart,
        weekEnd: range.weekEnd
      })
      .then((res) => {
        if (cancelled) return;
        const report = {
          ...res.data,
          weekStart: range.weekStart,
          weekEnd: range.weekEnd,
          generatedAt: new Date().toISOString()
        };
        saveReport(report);
        toast({ title: 'Weekly report ready', description: `${range.weekStart} – ${range.weekEnd} summary generated automatically.` });
      })
      .catch(() => {
        // Silent fail is fine here — user can still generate manually from the Report tab
        // (e.g. no internet connection available for the automatic Sunday run).
      })
      .finally(() => {
        if (!cancelled) setAutoGenerating(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (locked) return <LockScreen />;

  const openDetail = (entry) => setDetail(entry);
  const editFromDetailEntry = (entry) => { setDetail(null); setEditFromDetail(entry); };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-display font-bold">
              W
            </div>
            <div>
              <h1 className="font-display font-bold leading-tight">Work Diary AI</h1>
              {settings.name && <p className="text-xs text-muted-foreground leading-tight">{settings.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {autoGenerating && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Generating weekly report…
              </span>
            )}
            {settings.pin && (
              <button
                onClick={() => setLocked(true)}
                className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                title="Lock now"
              >
                <Lock className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {tab === 'diary' && <DiaryView entries={entries} onOpen={openDetail} />}
        {tab === 'report' && <WeeklyReport />}
        {tab === 'chat' && <AIChat />}
        {tab === 'ai' && <AIPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </main>

      {/* Floating new-entry button (diary tab only) */}
      {tab === 'diary' && (
        <button
          onClick={() => {
            const event = new CustomEvent('open-new-entry');
            window.dispatchEvent(event);
          }}
          className="fixed bottom-24 right-4 sm:right-1/2 sm:translate-x-[22rem] z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {detail && (
        <EntryDetail entry={detail} onClose={() => setDetail(null)} onEdit={editFromDetailEntry} />
      )}
      {editFromDetail && (
        <EntryForm entry={editFromDetail} onClose={() => setEditFromDetail(null)} />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <DiaryProvider>
      <Shell />
    </DiaryProvider>
  );
}