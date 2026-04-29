// ========================================
// Week Selector Component
// ========================================

import { getWeekDates, getWeekdayShort, parseDate, isToday, formatDate } from '../utils/date.js';

/**
 * Render a week selector strip
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} options.selectedDate - currently selected date (YYYY-MM-DD)
 * @param {Function} options.onSelect - callback(dateStr)
 * @param {Object} options.dotMap - { dateStr: ['schedule','task','habit'] } for indicator dots
 */
export function renderWeekSelector(container, options = {}) {
  const { selectedDate, onSelect, dotMap = {} } = options;
  
  const weekDates = getWeekDates(selectedDate);
  
  let html = '<div class="week-strip">';
  
  weekDates.forEach((dateStr) => {
    const d = parseDate(dateStr);
    const dayOfWeek = d.getDay();
    const dayNum = d.getDate();
    const isTodayDate = isToday(dateStr);
    const isSelected = dateStr === selectedDate;
    const dots = dotMap[dateStr] || [];
    
    const classes = [
      'week-day',
      isTodayDate ? 'today' : '',
      isSelected && !isTodayDate ? 'selected' : '',
    ].filter(Boolean).join(' ');
    
    let dotsHtml = '<div class="week-day-dots">';
    dots.forEach(type => {
      dotsHtml += `<span class="week-day-dot ${type}"></span>`;
    });
    dotsHtml += '</div>';
    
    html += `
      <div class="${classes}" data-date="${dateStr}">
        <span class="week-day-label">${getWeekdayShort(dayOfWeek)}</span>
        <span class="week-day-num">${dayNum}</span>
        ${dotsHtml}
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
  
  // Bind click
  container.querySelectorAll('.week-day').forEach((el) => {
    el.addEventListener('click', () => {
      const date = el.dataset.date;
      if (onSelect) onSelect(date);
    });
  });
}

export default renderWeekSelector;
