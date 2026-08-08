// Export helpers: PDF (jsPDF), Word (.doc HTML blob), and plain text.
import { jsPDF } from 'jspdf';

function downloadBlob(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/\n/g, '<br/>');
}

const FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'department', label: 'Department' },
  { key: 'tasks', label: 'Tasks completed' },
  { key: 'itemsReceived', label: 'Items received' },
  { key: 'itemsIssued', label: 'Items issued' },
  { key: 'problems', label: 'Problems encountered' },
  { key: 'solutions', label: 'Solutions taken' },
  { key: 'observations', label: 'Observations' }
];

export function entryToText(entry) {
  const lines = ['WORK DIARY ENTRY', '====================', ''];
  FIELDS.forEach((f) => lines.push(`${f.label}: ${entry[f.key] || '-'}`));
  if (entry.photos && entry.photos.length) {
    lines.push('', `Photos attached: ${entry.photos.length}`);
  }
  return lines.join('\n');
}

export function exportEntryText(entry) {
  downloadBlob(entryToText(entry), `diary-${entry.date || 'entry'}.txt`, 'text/plain');
}

export function exportEntryWord(entry) {
  const rows = FIELDS.map(
    (f) =>
      `<p><strong>${f.label}:</strong> ${escapeHtml(entry[f.key] || '-')}</p>`
  ).join('');
  const photos = (entry.photos || [])
    .map((p) => `<img src="${p}" style="max-width:320px;border-radius:8px;margin:4px;"/>`)
    .join('');
  const html =
    `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Work Diary Entry</title><style>body{font-family:Calibri,sans-serif;color:#222;}h1{color:#4f46e5;}</style></head><body>` +
    `<h1>Work Diary Entry</h1>${rows}${photos ? `<h3>Photos</h3>${photos}` : ''}</body></html>`;
  downloadBlob(html, `diary-${entry.date || 'entry'}.doc`, 'application/msword');
}

export function exportEntryPdf(entry) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Work Diary Entry', margin, y);
  y += 10;
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(2);
  doc.line(margin, y, margin + maxWidth, y);
  y += 20;
  doc.setFontSize(11);
  FIELDS.forEach((f) => {
    doc.setFont('helvetica', 'bold');
    const label = `${f.label}:`;
    const value = String(entry[f.key] || '-');
    const wrapped = doc.splitTextToSize(value, maxWidth - 90);
    if (y + 16 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(wrapped, margin + 90, y);
    y += Math.max(16, wrapped.length * 14);
    y += 4;
  });
  if (entry.photos && entry.photos.length) {
    if (y + 60 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`Photos attached: ${entry.photos.length}`, margin, y);
  }
  doc.save(`diary-${entry.date || 'entry'}.pdf`);
}

export function reportToText(report) {
  const lines = [
    report.title || 'WEEKLY REPORT',
    '============================',
    '',
    report.summary || '',
    '',
    'ACHIEVEMENTS',
    '------------',
    ...(report.achievements || []).map((a) => '- ' + a),
    '',
    'CHALLENGES',
    '----------',
    ...(report.challenges || []).map((a) => '- ' + a),
    '',
    'RESOLUTIONS',
    '-----------',
    ...(report.resolutions || []).map((a) => '- ' + a),
    '',
    'RECURRING PROBLEMS',
    '-----------------',
    ...(report.recurring_problems || []).map((a) => '- ' + a),
    '',
    'PRODUCTIVITY',
    '------------',
    report.productivity || '',
    '',
    'RECOMMENDATIONS',
    '---------------',
    ...(report.recommendations || []).map((a) => '- ' + a),
    '',
    'DAILY SUMMARIES',
    '---------------',
    ...(report.daily_summaries || []).map(
      (d) => `[${d.date}] ${d.department || ''}\n${d.professional_summary}`
    )
  ];
  return lines.join('\n');
}

export function exportReportText(report) {
  downloadBlob(reportToText(report), `weekly-report-${report.weekStart || ''}.txt`, 'text/plain');
}

export function exportReportWord(report) {
  const list = (arr) => (arr || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('');
  const daily = (report.daily_summaries || [])
    .map(
      (d) =>
        `<p><strong>${escapeHtml(d.date)} ${d.department ? '— ' + escapeHtml(d.department) : ''}</strong><br/>${escapeHtml(d.professional_summary)}</p>`
    )
    .join('');
  const html =
    `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${escapeHtml(
      report.title || 'Weekly Report'
    )}</title><style>body{font-family:Calibri,sans-serif;color:#222;}h1{color:#4f46e5;}h2{color:#4338ca;border-bottom:1px solid #ddd;padding-bottom:2px;}</style></head><body>` +
    `<h1>${escapeHtml(report.title || 'Weekly Report')}</h1><p><em>${escapeHtml(report.weekStart || '')} to ${escapeHtml(
      report.weekEnd || ''
    )}</em></p>` +
    `<h2>Summary</h2><p>${escapeHtml(report.summary || '')}</p>` +
    `<h2>Achievements</h2><ul>${list(report.achievements)}</ul>` +
    `<h2>Challenges</h2><ul>${list(report.challenges)}</ul>` +
    `<h2>Resolutions</h2><ul>${list(report.resolutions)}</ul>` +
    `<h2>Recurring Problems</h2><ul>${list(report.recurring_problems)}</ul>` +
    `<h2>Productivity</h2><p>${escapeHtml(report.productivity || '')}</p>` +
    `<h2>Recommendations</h2><ul>${list(report.recommendations)}</ul>` +
    `<h2>Daily Summaries</h2>${daily}` +
    `</body></html>`;
  downloadBlob(html, `weekly-report-${report.weekStart || ''}.doc`, 'application/msword');
}

export function exportReportPdf(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const heading = (text, size = 13) => {
    if (y + 24 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(67, 56, 202);
    doc.text(text, margin, y);
    y += size + 6;
    doc.setTextColor(40, 40, 40);
  };
  const paragraph = (text) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const wrapped = doc.splitTextToSize(String(text || ''), maxWidth);
    wrapped.forEach((line) => {
      if (y + 14 > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 14;
    });
    y += 4;
  };
  const bullets = (arr) => {
    if (!arr || arr.length === 0) {
      paragraph('None');
      return;
    }
    arr.forEach((a) => {
      const lines = doc.splitTextToSize('• ' + a, maxWidth - 12);
      lines.forEach((line, i) => {
        if (y + 14 > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        if (i === 0) {
          doc.text('•', margin, y);
          doc.text(a.length > 0 ? line.slice(2) : line, margin + 12, y);
        } else {
          doc.text(line, margin + 12, y);
        }
        y += 14;
      });
      y += 2;
    });
    y += 4;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text(report.title || 'Weekly Report', margin, y);
  y += 16;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`${report.weekStart || ''} to ${report.weekEnd || ''}`, margin, y);
  y += 18;
  doc.setTextColor(40, 40, 40);

  heading('Summary');
  paragraph(report.summary);
  heading('Achievements');
  bullets(report.achievements);
  heading('Challenges');
  bullets(report.challenges);
  heading('Resolutions');
  bullets(report.resolutions);
  heading('Recurring Problems');
  bullets(report.recurring_problems);
  heading('Productivity');
  paragraph(report.productivity);
  heading('Recommendations');
  bullets(report.recommendations);
  heading('Daily Summaries');
  (report.daily_summaries || []).forEach((d) => {
    heading(`${d.date}${d.department ? ' — ' + d.department : ''}`, 11);
    paragraph(d.professional_summary);
  });

  doc.save(`weekly-report-${report.weekStart || ''}.pdf`);
}