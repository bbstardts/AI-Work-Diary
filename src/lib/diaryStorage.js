// Offline-first local storage for Work Diary AI.
// All data lives in the browser (localStorage) so it persists and works offline.

const ENTRIES_KEY = 'wda_entries_v1';
const REPORTS_KEY = 'wda_reports_v1';
const SETTINGS_KEY = 'wda_settings_v1';

export function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function persistEntries(entries) {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to persist entries (storage may be full):', e);
  }
}

export function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function persistReports(reports) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function persistSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Checks the network before any AI call — used by every AI feature (Ask AI, Rewrite,
// Insights, Weekly Report) so the offline message is worded and behaves identically
// everywhere instead of each screen handling it slightly differently.
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export const OFFLINE_TOAST = {
  title: 'You are offline',
  description: 'AI features need an internet connection. Everything else in your diary still works offline.',
  variant: 'destructive'
};

export function uid() {

  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

// Downscale + compress an image file to a JPEG data URL so it fits in localStorage.
export function compressImage(file, maxSize = 1000, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}