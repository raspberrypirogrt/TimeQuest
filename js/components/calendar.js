// ========================================
// Calendar Component (for Habits page)
// ========================================

import { getMonthCalendar, getMonthDisplay, isToday, formatDate } from '../utils/date.js';
import { uiIcon } from '../utils/icons.js';

/**
 * Render a calendar
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {number} options.year
 * @param {number} options.month - 0-indexed
 * @param {Set} options.habitDoneDates - dates where habit was completed
 * @param {Set} options.activationDoneDates - dates where only activation was done
 * @param {Function} options.onMonthChange - callback(year, month)
 */
export function renderCalendar(container, options = {}) {
  const {
    year,
    month,
    habitDoneDates = new Set(),
    activationDoneDates = new Set(),
    onMonthChange,
  } = options;
  
  const days = getMonthCalendar(year, month);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  
  let html = `
    <div class="calendar">
      <div class="calendar-header">
        <span class="calendar-month">${getMonthDisplay(year, month)}</span>
        <div class="calendar-nav">
          <button class="calendar-nav-btn" data-action="prev">
            ${uiIcon('chevronLeft', 14)}
          </button>
          <button class="calendar-nav-btn" data-action="next">
            ${uiIcon('chevronRight', 14)}
          </button>
        </div>
      </div>
      <div class="calendar-weekdays">
        ${weekdays.map(w => `<span class="calendar-weekday">${w}</span>`).join('')}
      </div>
      <div class="calendar-days">
  `;
  
  days.forEach((dayInfo) => {
    const classes = [
      'calendar-day',
      dayInfo.otherMonth ? 'other-month' : '',
      isToday(dayInfo.date) ? 'today' : '',
      habitDoneDates.has(dayInfo.date) ? 'habit-done' : '',
      !habitDoneDates.has(dayInfo.date) && activationDoneDates.has(dayInfo.date) ? 'activation-done' : '',
    ].filter(Boolean).join(' ');
    
    html += `<div class="${classes}">${dayInfo.day}</div>`;
  });
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Month navigation
  container.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (onMonthChange) onMonthChange(newYear, newMonth);
  });
  
  container.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (onMonthChange) onMonthChange(newYear, newMonth);
  });
}

export default renderCalendar;
