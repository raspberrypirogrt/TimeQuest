// ========================================
// Timeline Component
// ========================================

import { timeToMinutes, currentTimeStr, durationText } from '../utils/date.js';
import { getIcon } from '../utils/icons.js';

const HOUR_HEIGHT = 80; // px per hour
const START_HOUR = 4;   // 04:00
const END_HOUR = 28;    // next day 04:00
const TOTAL_HOURS = END_HOUR - START_HOUR; // 24 hours displayed

/**
 * Render timeline for a given date's schedules
 * @param {Object} options
 * @param {Array} options.schedules - schedule items
 * @param {boolean} options.showFill - whether to show time progress fill
 * @param {boolean} options.showCheck - whether to show checkboxes
 * @param {boolean} options.isPast - whether this day is in the past
 * @param {Function} options.onCheck - callback(id, checked)
 * @param {Function} options.onClick - callback(schedule)
 */
export function renderTimeline(container, options = {}) {
  const {
    schedules = [],
    showFill = false,
    showCheck = true,
    isPast = false,
    onCheck,
    onClick,
  } = options;
  
  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT;
  
  let html = `<div class="timeline-container" style="height: ${totalHeight}px; position: relative;">`;
  
  // Hour labels and grid lines
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const top = (h - START_HOUR) * HOUR_HEIGHT;
    const displayHour = h >= 24 ? h - 24 : h;
    const label = `${String(displayHour).padStart(2, '0')}:00`;
    const overnightMark = h >= 24 ? '<span class="overnight-badge">⁺¹</span>' : '';
    
    // Check if this hour matches current time
    const now = new Date();
    const currentHour = now.getHours();
    const mappedCurrentHour = currentHour < START_HOUR ? currentHour + 24 : currentHour;
    const isCurrentHour = showFill && h === mappedCurrentHour;
    
    if (h < END_HOUR) {
      html += `<div class="timeline-hour-label ${isCurrentHour ? 'current-time' : ''}" style="top: ${top}px;">${label}${overnightMark}</div>`;
    }
  }
  
  // Track
  html += `<div class="timeline-track">`;
  
  // Filled portion (up to current time)
  if (showFill) {
    const now = new Date();
    let currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (now.getHours() < START_HOUR) currentMinutes += 24 * 60;
    const startMinutes = START_HOUR * 60;
    const totalMinutes = TOTAL_HOURS * 60;
    const fillPercent = Math.min(100, Math.max(0, ((currentMinutes - startMinutes) / totalMinutes) * 100));
    html += `<div class="timeline-track-filled" style="height: ${fillPercent}%;"></div>`;
  }
  
  html += `</div>`; // end track
  
  // Current time indicator
  if (showFill) {
    const now = new Date();
    let currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (now.getHours() < START_HOUR) currentMinutes += 24 * 60;
    const currentTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    
    html += `
      <div class="timeline-current-indicator" style="top: ${currentTop}px;">
        <div class="timeline-current-dot"></div>
        <div class="timeline-current-line"></div>
      </div>
    `;
    
    // Update the nearest hour label to show current time
  }
  
  // Schedule items (bubbles)
  schedules.forEach((item) => {
    let startMin = timeToMinutes(item.startTime);
    let endMin = timeToMinutes(item.endTime);
    
    // Map times to 4:00-28:00 range
    if (startMin < START_HOUR * 60) startMin += 24 * 60;
    if (item.isOvernight || endMin <= startMin) {
      endMin += 24 * 60;
    }
    if (endMin < START_HOUR * 60) endMin += 24 * 60;
    
    // Clamp to visible range
    const visibleStart = Math.max(startMin, START_HOUR * 60);
    const visibleEnd = Math.min(endMin, END_HOUR * 60);
    if (visibleStart >= END_HOUR * 60) return; // off-screen
    
    const top = ((visibleStart - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 50);
    const bubbleHeight = Math.max(height - 10, 44);
    
    const now = new Date();
    let nowMin = now.getHours() * 60 + now.getMinutes();
    if (now.getHours() < START_HOUR) nowMin += 24 * 60;
    
    const isFilled = showFill && startMin < nowMin;
    const isActiveNow = showFill && startMin <= nowMin && endMin > nowMin;
    
    const dimmed = isPast && !item.completed;
    const itemClasses = [
      'timeline-item',
      item.completed ? 'completed' : '',
      dimmed ? 'dimmed' : '',
    ].filter(Boolean).join(' ');
    
    const overnightBadge = item.isOvernight ? `<span class="overnight-badge">⁺¹</span>` : '';
    const duration = durationText(item.startTime, item.endTime, item.isOvernight);
    
    // Remaining time for active items
    let remainingHtml = '';
    if (isActiveNow && !item.completed) {
      const remainMin = endMin - nowMin;
      if (remainMin > 0) {
        const rh = Math.floor(remainMin / 60);
        const rm = remainMin % 60;
        remainingHtml = `<div class="timeline-remaining">剩餘 ${rh > 0 ? rh + '小時' : ''}${rm}分</div>`;
      }
    }
    
    html += `
      <div class="timeline-bubble-wrap ${itemClasses}" style="top: ${top}px; height: ${height}px;" data-id="${item.id}">
        <div class="timeline-bubble ${isFilled ? 'filled' : ''} ${isActiveNow ? 'active-now' : ''}" style="height: ${bubbleHeight}px;">
          <span class="timeline-bubble-icon">${getIcon(item.icon || 'default')}</span>
        </div>
        <div class="timeline-content" data-action="edit">
          <div class="timeline-time-text">
            ${item.startTime}–${item.endTime} ${overnightBadge}
            <span class="duration">(${duration})</span>
          </div>
          <div class="timeline-title">${item.title}</div>
          ${remainingHtml}
        </div>
        ${showCheck ? `
          <div class="timeline-check">
            <div class="checkbox ${item.completed ? 'checked' : ''}" data-action="check" data-id="${item.id}">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        ` : (isPast && item.completed ? `
          <div class="timeline-check">
            <div class="checkbox checked">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        ` : '')}
      </div>
    `;
  });
  
  html += `</div>`; // end timeline-container
  
  container.innerHTML = html;
  
  // Bind events
  container.querySelectorAll('[data-action="check"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      const isChecked = el.classList.contains('checked');
      el.classList.toggle('checked');
      el.classList.add('just-checked');
      setTimeout(() => el.classList.remove('just-checked'), 400);
      if (onCheck) onCheck(id, !isChecked);
    });
  });
  
  container.querySelectorAll('[data-action="edit"]').forEach((el) => {
    el.addEventListener('click', () => {
      const wrap = el.closest('.timeline-bubble-wrap');
      const id = wrap?.dataset.id;
      const item = schedules.find(s => s.id === id);
      if (item && onClick) onClick(item);
    });
  });
  
  // Auto-scroll to current time if showFill
  if (showFill) {
    const now = new Date();
    let currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (now.getHours() < START_HOUR) currentMinutes += 24 * 60;
    const scrollTo = Math.max(0, ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 200);
    container.scrollTop = scrollTo;
  }
}

export default renderTimeline;
