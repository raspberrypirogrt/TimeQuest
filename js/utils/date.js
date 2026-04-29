// ========================================
// Date Utilities
// ========================================

const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function todayStr() {
  return formatDate(new Date());
}

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string to Date
 */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format date for display: "2026年4月29日"
 */
export function formatDateDisplay(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * Get weekday name: "週三"
 */
export function getWeekdayName(dateStr) {
  const d = parseDate(dateStr);
  return WEEKDAY_NAMES[d.getDay()];
}

/**
 * Get short weekday: "三"
 */
export function getWeekdayShort(dayIndex) {
  return WEEKDAY_SHORT[dayIndex];
}

/**
 * Get the week containing the given date (Sun-Sat)
 */
export function getWeekDates(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    dates.push(formatDate(dd));
  }
  return dates;
}

/**
 * Get all dates in a month for calendar display (6 rows)
 */
export function getMonthCalendar(year, month) {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  
  // Previous month days
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: formatDate(new Date(year, month - 1, prevMonthDays - i)),
      day: prevMonthDays - i,
      otherMonth: true,
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: formatDate(new Date(year, month, i)),
      day: i,
      otherMonth: false,
    });
  }
  
  // Next month days to fill 6 rows
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: formatDate(new Date(year, month + 1, i)),
      day: i,
      otherMonth: true,
    });
  }
  
  return days;
}

/**
 * Check if a date string is today
 */
export function isToday(dateStr) {
  return dateStr === todayStr();
}

/**
 * Check if a date is in the past
 */
export function isPast(dateStr) {
  return dateStr < todayStr();
}

/**
 * Check if a date is in the future
 */
export function isFuture(dateStr) {
  return dateStr > todayStr();
}

/**
 * Add days to a date string
 */
export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

/**
 * Calculate duration text from time range
 */
export function durationText(start, end, isOvernight) {
  let [sh, sm] = start.split(':').map(Number);
  let [eh, em] = end.split(':').map(Number);
  
  let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (isOvernight || totalMinutes < 0) totalMinutes += 24 * 60;
  
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  if (hours === 0) return `${mins}分鐘`;
  if (mins === 0) return `${hours}小時`;
  return `${hours}小時${mins}分`;
}

/**
 * Get current time as "HH:MM"
 */
export function currentTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Convert "HH:MM" to minutes since midnight
 */
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Get month display name
 */
export function getMonthDisplay(year, month) {
  return `${year}年${month + 1}月`;
}

/**
 * Generate a UUID v4
 */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
