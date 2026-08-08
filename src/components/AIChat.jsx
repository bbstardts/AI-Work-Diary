import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle, Sparkles, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useDiary } from '@/contexts/DiaryContext';
import { base44 } from '@/api/base44Client';
import { OFFLINE_TOAST } from '@/lib/diaryStorage';

const SUGGESTIONS = [
  'What happened this week?',
  'Any recurring problems lately?',
  'Summarize last Monday',
  'What items did I receive this month?'
];

export default function AIChat() {
  const { entries } = useDiary();
  const { toast } = useToast();
  const [messages, setMessages] = useState([]); // [{role, content}]
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (question) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;

    if (entries.length === 0) {
      toast({ title: 'No diary entries saved yet', description: 'Add some entries first so I have something to search through.', variant: 'destructive' });
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast(OFFLINE_TOAST);
      return;
    }

    const nextMessages = [...messages, { role: 'user', content: q }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiAssistant', {
        action: 'chat',
        entries,
        question: q,
        history: nextMessages
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (err) {
      toast({ title: 'AI request failed', description: err.message, variant: 'destructive' });
      setMessages((prev) => prev.slice(0, -1)); // roll back the user message that failed to get a response
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-11.5rem)]">
      <header className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Ask AI</h1>
          <p className="text-sm text-muted-foreground">Ask anything about what you've saved.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">Ask me anything about your diary</p>
            <p className="text-sm mb-5">I'll search through everything you've saved and answer specifically.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary hover:bg-secondary/70 text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-secondary text-foreground rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching your diary…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 pt-3 border-t border-border/60 mt-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your saved entries…"
            className="min-h-[44px] max-h-32 resize-none bg-background"
            rows={1}
          />
          <Button onClick={() => ask()} disabled={loading || !input.trim()} size="icon" className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
