import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, TrendingUp, Lightbulb, Bot, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useDiary } from '@/contexts/DiaryContext';
import { base44 } from '@/api/base44Client';
import { isOffline, OFFLINE_TOAST } from '@/lib/diaryStorage';

function ListBlock({ icon: Icon, title, items, tone }) {
  const tones = {
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300',
    good: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.info}`}>
      <div className="flex items-center gap-2 mb-2 font-display font-semibold">
        <Icon className="w-4 h-4" /> {title}
      </div>
      {items?.length ? (
        <ul className="space-y-1.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="opacity-50">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm opacity-70">Nothing notable yet.</p>
      )}
    </div>
  );
}

export default function AIPanel() {
  const { entries } = useDiary();
  const { toast } = useToast();
  const [mode, setMode] = useState('insights'); // 'insights' | 'rewrite'
  const [selectedEntry, setSelectedEntry] = useState(entries[0]?.id || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (mode === 'rewrite' && !selectedEntry) return;
    if (entries.length === 0) {
      toast({ title: 'No entries to analyze yet', variant: 'destructive' });
      return;
    }
    if (isOffline()) {
      toast(OFFLINE_TOAST);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload =
        mode === 'rewrite'
          ? { action: 'rewrite', entry: entries.find((e) => e.id === selectedEntry) }
          : { action: 'insights', entries };
      const res = await base44.functions.invoke('aiAssistant', payload);
      setResult(res.data);
    } catch (err) {
      toast({ title: 'AI request failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyRewritten = () => {
    if (!result?.rewritten) return;
    navigator.clipboard.writeText(result.rewritten);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Rewrite entries, spot recurring issues & track productivity.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode('insights')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            mode === 'insights' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Insights & patterns
        </button>
        <button
          onClick={() => setMode('rewrite')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            mode === 'rewrite' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Rewrite an entry
        </button>
      </div>

      {mode === 'rewrite' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Select entry</label>
          <select
            value={selectedEntry}
            onChange={(e) => setSelectedEntry(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {entries.length === 0 && <option value="">No entries yet</option>}
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.date} {e.department ? '— ' + e.department : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {loading ? 'Thinking…' : mode === 'rewrite' ? 'Rewrite professionally' : 'Analyze my diary'}
      </Button>

      {loading && !result && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing your work entries…
        </div>
      )}

      {result && mode === 'rewrite' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Professional rewrite</h2>
            <Button size="sm" variant="ghost" onClick={copyRewritten}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Textarea
            readOnly
            value={result.rewritten}
            className="min-h-[180px] bg-background leading-relaxed"
          />
        </div>
      )}

      {result && mode === 'insights' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ListBlock icon={AlertTriangle} title="Recurring issues" items={result.recurring_issues} tone="warning" />
          <ListBlock icon={TrendingUp} title="Patterns detected" items={result.patterns} tone="info" />
          <ListBlock icon={Sparkles} title="Productivity notes" items={result.productivity_notes} tone="good" />
          <ListBlock icon={Lightbulb} title="Recommendations" items={result.recommendations} tone="good" />
        </div>
      )}
    </div>
  );
}