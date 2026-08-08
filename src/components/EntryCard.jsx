import React from 'react';
import { Edit2, Trash2, Building2, Clock, ImageIcon } from 'lucide-react';

export default function EntryCard({ entry, onEdit, onDelete, onOpen }) {
  const created = new Date();
  try { created.setTime(Date.parse(entry.date + 'T' + (entry.time || '00:00'))); } catch { /* keep */ }

  return (
    <div
      className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {entry.department && (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary mb-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {entry.department}
            </div>
          )}
          <h3 className="font-display font-semibold leading-tight truncate">
            {entry.date}
            {entry.time && (
              <span className="ml-2 text-sm font-normal text-muted-foreground inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {entry.time}
              </span>
            )}
          </h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {entry.tasks && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{entry.tasks}</p>
      )}

      {(entry.problems || entry.observations) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.problems && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              {entry.problems.split('\n')[0].slice(0, 40)}
            </span>
          )}
          {entry.observations && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
              Observation
            </span>
          )}
        </div>
      )}

      {entry.photos?.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="w-3.5 h-3.5" />
          {entry.photos.length} photo{entry.photos.length > 1 ? 's' : ''}
          <div className="flex gap-1 ml-1">
            {entry.photos.slice(0, 3).map((p, i) => (
              <img key={i} src={p} alt="" className="w-7 h-7 rounded object-cover border border-border" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}