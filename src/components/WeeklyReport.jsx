import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Loader2,
  FileText,
  FileType,
  FileDown,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useDiary } from '@/contexts/DiaryContext';
import { base44 } from '@/api/base44Client';
import { isOffline, OFFLINE_TOAST } from '@/lib/diaryStorage';
import { weekRangeFor, entriesInWeek, fmt } from '@/lib/dateUtils';
import {
  exportReportPdf,
  exportReportWord,
  exportReportText
} from '@/lib/exporters';

export default function WeeklyReport() {
  const { entries, reports, saveReport } = useDiary();
  const { toast } = useToast();
  const [anchor, setAnchor] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => weekRangeFor(anchor), [anchor]);
  const weekEntries = useMemo(() => entriesInWeek(entries, anchor), [entries, anchor]);
  const saved = reports.find((r) => r.weekStart === range.weekStart);

  // If today is Sunday and a report for last week is missing, default anchor to last week.
  useEffect(() => {
    const today = new Date();
    if (today.getDay() === 0) {
      // Sunday — the Mon-Sat to report is last week's.
      setAnchor(new Date(today.getTime() - 7 * 86400000));
    }
  }, []);

  const generate = async () => {
    if (weekEntries.length === 0) {
      toast({ title: 'No entries for Mon–Sat of that week', variant: 'destructive' });
      return;
    }
    if (isOffline()) {
      toast(OFFLINE_TOAST);
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiAssistant', {
        action: 'weekly_report',
        entries: weekEntries,
        weekStart: range.weekStart,
        weekEnd: range.weekEnd
      });
      const report = { ...res.data, weekStart: range.weekStart, weekEnd: range.weekEnd, generatedAt: new Date().toISOString() };
      saveReport(report);
      toast({ title: 'Weekly report generated' });
    } catch (err) {
      toast({ title: 'Report generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const share = (exporter, label) => {
    if (!saved) return;
    try {
      exporter(saved);
      toast({ title: `${label} exported` });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    }
  };

  const shiftWeek = (dir) => setAnchor((d) => new Date(d.getTime() + dir * 7 * 86400000));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Weekly Report</h1>
          <p className="text-sm text-muted-foreground">Monday through Saturday summary.</p>
        </div>
      </header>

      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-3">
        <button onClick={() => shiftWeek(-1)} className="p-2 rounded-lg hover:bg-secondary">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="font-display font-semibold">{range.weekStart} – {range.weekEnd}</div>
          <div className="text-xs text-muted-foreground">
            {weekEntries.length} entr{weekEntries.length === 1 ? 'y' : 'ies'} this week
          </div>
        </div>
        <button onClick={() => shiftWeek(1)} className="p-2 rounded-lg hover:bg-secondary">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <Button onClick={generate} disabled={loading} variant={saved ? 'outline' : 'default'} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {loading ? 'Generating…' : saved ? 'Regenerate report' : 'Generate weekly report'}
      </Button>

      {saved && (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">{saved.title}</h2>
              <p className="text-xs text-muted-foreground">
                Generated {saved.generatedAt ? fmt(new Date(saved.generatedAt), 'MMM d, yyyy') : ''}
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          </div>

          {saved.summary && <p className="text-sm leading-relaxed text-muted-foreground">{saved.summary}</p>}

          <Section title="Achievements" items={saved.achievements} tone="good" />
          <Section title="Challenges" items={saved.challenges} tone="warning" />
          <Section title="Resolutions" items={saved.resolutions} tone="info" />
          <Section title="Recurring problems" items={saved.recurring_problems} tone="warning" />
          {saved.productivity && (
            <div className="space-y-1">
              <h3 className="font-display font-semibold text-sm">Productivity</h3>
              <p className="text-sm text-muted-foreground">{saved.productivity}</p>
            </div>
          )}
          <Section title="Recommendations" items={saved.recommendations} tone="info" />

          {saved.daily_summaries?.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-display font-semibold text-sm">Daily summaries</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {saved.daily_summaries.map((d, i) => (
                  <div key={i} className="rounded-xl bg-secondary/50 p-3 border border-border/60">
                    <div className="text-xs font-semibold text-primary mb-1">
                      {d.date}{d.department ? ' — ' + d.department : ''}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{d.professional_summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
            <Button size="sm" variant="outline" onClick={() => share(exportReportPdf, 'PDF')}>
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => share(exportReportWord, 'Word')}>
              <FileType className="w-4 h-4 mr-2" /> Word
            </Button>
            <Button size="sm" variant="outline" onClick={() => share(exportReportText, 'Text')}>
              <FileText className="w-4 h-4 mr-2" /> Text
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, tone }) {
  if (!items?.length) return null;
  const tones = {
    good: 'border-emerald-200 dark:border-emerald-500/20',
    warning: 'border-amber-200 dark:border-amber-500/20',
    info: 'border-blue-200 dark:border-blue-500/20'
  };
  return (
    <div className={`rounded-xl border ${tones[tone] || tones.info} p-3`}>
      <h3 className="font-display font-semibold text-sm mb-2">{title}</h3>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2"><span className="opacity-50">•</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}