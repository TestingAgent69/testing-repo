export function getTodayInfo() {
  const now = new Date();
  return {
    // full JS Date object
    date: now,
    // e.g. "Sunday"
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    // full ISO string, e.g. "2025-05-17T13:45:30.000Z"
    iso: now.toISOString(),
    // timezone offset like "+05:30"
    timezoneOffset: (() => {
      const off = now.getTimezoneOffset();
      const sign = off <= 0 ? '+' : '-';
      const hrs = String(Math.abs(Math.floor(off / 60))).padStart(2, '0');
      const mins = String(Math.abs(off % 60)).padStart(2, '0');
      return `UTC${sign}${hrs}:${mins}`;
    })(),
  };
}
