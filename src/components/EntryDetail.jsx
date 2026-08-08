import React from 'react';
import {
  X, Edit2, Download, FileDown, FileText,
  Building2, Clock, ClipboardList, PackageOpen, PackageCheck,
  AlertTriangle, Wrench, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportEntryPdf, exportEntryWord, exportEntryText } from '@/lib/exporters';

const FIELDS = [
  { key: 'tasks', label: 'Tasks completed', icon: ClipboardList },
  { key: 'itemsReceived', label: 'Items received', icon: PackageCheck },
  { key: 'itemsIssued', label: 'Items issued', icon: PackageOpen },
  { key: 'problems', label: 'Problems encountered', icon: AlertTriangle },
  { key: 'solutions', label: 'Solutions taken', icon: Wrench },
  { key: 'observations', label: 'Observations', icon: Eye }
];

export default function EntryDetail({ entry, onClose, onEdit }) {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border/60">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-card/90 backdrop-blur border-b border-border/60">
          <div>
            <h2 className="text-xl font-display font-bold">{entry.date}</h2>
            {entry.time && (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {entry.time}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {entry.department && (
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">
              <Building2 className="w-4 h-4" /> {entry.department}
            </div>
          )}

          {FIELDS.map((f) => {
            const value = entry[f.key];
            if (!value) return null;
            const Icon = f.icon;
            return (
              <div key={f.key} className="space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" /> {f.label}
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</p>
              </div>
            );
          })}

          {entry.photos?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {entry.photos.map((p, i) => (
                  <a key={i} href={p} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-border">
                    <img src={p} alt={`Photo ${i + 1}`} className="w-full h-32 object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-2 px-5 py-4 bg-card/90 backdrop-blur border-t border-border/60">
          <Button variant="outline" onClick={() => onEdit(entry)} className="flex-1">
            <Edit2 className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="ghost" onClick={() => exportEntryText(entry)} title="Text">
            <FileText className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={() => exportEntryWord(entry)} title="Word">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={() => exportEntryPdf(entry)} title="PDF">
            <FileDown className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}