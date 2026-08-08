import { format, startOfWeek, addDays, isWithinInterval, parseISO } from 'date-fns';

// Monday-based weeks (the diary covers Mon–Sat, with reports generated on Sunday).
export function startOfWeekMon(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function fmt(date, pattern = 'yyyy-MM-dd') {
  return format(date, pattern);
}

// Given an anchor date, return the Mon–Sat range that the report covers, plus the Sunday it's due.
export function weekRangeFor(date) {
  const monday = startOfWeekMon(date);
  const saturday = addDays(monday, 5);
  const sunday = addDays(monday, 6);
  return {
    monday,
    saturday,
    sunday,
    weekStart: fmt(monday),
    weekEnd: fmt(saturday)
  };
}

// All dates Monday..Saturday of the given week (inclusive).
export function weekDayDates(date) {
  const monday = startOfWeekMon(date);
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
}

export function entriesInWeek(entries, date) {
  const { monday, saturday } = weekRangeFor(date);
  const start = parseISO(fmt(monday));
  const end = addDays(parseISO(fmt(saturday)), 1);
  return entries.filter((e) => {
    if (!e.date) return false;
    try {
      const d = parseISO(e.date);
      return isWithinInterval(d, { start, end });
    } catch {
      return false;
    }
  });
}