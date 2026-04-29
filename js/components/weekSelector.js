// ========================================
// Week Selector Component (with prev/next week)
// ========================================

import { getWeekDates, getWeekdayShort, parseDate, isToday, formatDate, addDays } from '../utils/date.js';
import { uiIcon } from '../utils/icons.js';

/**
 * Render a week selector strip with prev/next week navigation
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} options.selectedDate - currently selected date (YYYY-MM-DD)
 * @param {Function} options.onSelect - callback(dateStr)
 * @param {Object} options.dotMap - { dateStr: ['schedule','task','habit'] } for indicator dots
 * @param {boolean} options.showWeekNav - show prev/next week buttons (default: false)
 * @param {Function} options.onWeekChange - callback(newAnchorDateStr) when week changes
 */
export function renderWeekSelector(container, options = {}) {
  const { selectedDate, onSelect, dotMap = {}, showWeekNav = false, onWeekChange } = options;

  const weekDates = getWeekDates(selectedDate);

  let html = '';

  if (showWeekNav) {
    html += `<div class="week-nav">`;
    html += `<button class="week-nav-btn" id="week-prev" title="上一週">${uiIcon('chevronLeft', 18)}</button>`;
  }

  html += '<div class="week-strip">';

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

  if (showWeekNav) {
    html += `<button class="week-nav-btn" id="week-next" title="下一週">${uiIcon('chevronRight', 18)}</button>`;
    html += `</div>`; // end week-nav
  }

  container.innerHTML = html;

  // Bind day click
  container.querySelectorAll('.week-day').forEach((el) => {
    el.addEventListener('click', () => {
      const date = el.dataset.date;
      if (onSelect) onSelect(date);
    });
  });

  // Bind week nav
  if (showWeekNav) {
    const prevBtn = container.querySelector('#week-prev');
    const nextBtn = container.querySelector('#week-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const newDate = addDays(selectedDate, -7);
        if (onWeekChange) onWeekChange(newDate);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const newDate = addDays(selectedDate, 7);
        if (onWeekChange) onWeekChange(newDate);
      });
    }
  }
}

export default renderWeekSelector;
