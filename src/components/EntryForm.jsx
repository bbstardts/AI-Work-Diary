import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDiary } from '@/contexts/DiaryContext';
import { compressImage } from '@/lib/diaryStorage';

const TODAY = new Date().toISOString().slice(0, 10);
const NOW = new Date().toTimeString().slice(0, 5);

const EMPTY = {
  date: TODAY,
  time: NOW,
  department: '',
  tasks: '',
  itemsReceived: '',
  itemsIssued: '',
  problems: '',
  solutions: '',
  observations: '',
  photos: []
};

// Auto-save the in-progress form to localStorage on every change, like Notepad —
// so if the app is swiped away / closed before hitting Save, nothing is lost.
// New entries and each edited entry get their own draft slot.
const draftKey = (entry) => (entry ? `wda_draft_edit_${entry.id}` : 'wda_draft_new');

function loadDraft(entry) {
  try {
    const raw = localStorage.getItem(draftKey(entry));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(entry, form) {
  try {
    localStorage.setItem(draftKey(entry), JSON.stringify(form));
  } catch {
    // Storage full or unavailable — the explicit Save button still works normally.
  }
}

function clearDraft(entry) {
  localStorage.removeItem(draftKey(entry));
}

export default function EntryForm({ entry, onClose }) {
  const { addEntry, updateEntry } = useDiary();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const draft = loadDraft(entry);
    const base = entry ? { ...EMPTY, ...entry } : { ...EMPTY, date: TODAY, time: NOW };
    setForm(draft || base);
  }, [entry]);

  // Persist every change immediately so a swipe-away / accidental close never loses text.
  useEffect(() => {
    saveDraft(entry, form);
  }, [form, entry]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusyPhoto(true);
    try {
      const compressed = await Promise.all(
        files.map((f) => compressImage(f).catch(() => null))
      );
      const ok = compressed.filter(Boolean);
      setForm((f) => ({ ...f, photos: [...f.photos, ...ok] }));
    } finally {
      setBusyPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = (i) =>
    setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.tasks.trim() && !form.problems.trim()) return;
    setSaving(true);
    // Simulate minimal async so the spinner shows cleanly; storage is sync.
    setTimeout(() => {
      if (entry) updateEntry(entry.id, form);
      else addEntry(form);
      clearDraft(entry);
      setSaving(false);
      onClose();
    }, 150);
  };

  const field = (key, label, placeholder, type = 'text') => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {type === 'textarea' ? (
        <Textarea
          id={key}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="resize-none bg-background"
        />
      ) : (
        <Input
          id={key}
          type={type}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          className="bg-background"
        />
      )}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="bg-card w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border/60">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-card/90 backdrop-blur border-b border-border/60">
          <h2 className="text-lg font-display font-semibold">
            {entry ? 'Edit entry' : 'New diary entry'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('date', 'Date', '', 'date')}
            {field('time', 'Time', '', 'time')}
          </div>
          {field('department', 'Department', 'e.g. Operations, Maintenance')}
          {field('tasks', 'Tasks completed', 'What did you do today?', 'textarea')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('itemsReceived', 'Items received', 'Quantities / details', 'textarea')}
            {field('itemsIssued', 'Items issued', 'Quantities / details', 'textarea')}
          </div>
          {field('problems', 'Problems encountered', 'What went wrong?', 'textarea')}
          {field('solutions', 'Solutions taken', 'How did you fix it?', 'textarea')}
          {field('observations', 'Observations', 'Notes & insights', 'textarea')}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Photos / attachments</Label>
            <div className="flex flex-wrap gap-2">
              {form.photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-secondary flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              >
                {busyPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[10px]">Add</span>
                  </>
                )}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handlePhotos}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 px-5 py-4 bg-card/90 backdrop-blur border-t border-border/60">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {entry ? 'Save changes' : 'Save entry'}
          </Button>
        </div>
      </div>
    </form>
  );
}