// ========================================
// Timeline Component — Liquid Fill Design
// ========================================

import { timeToMinutes, currentTimeStr, durationText } from '../utils/date.js';
import { getIcon } from '../utils/icons.js';

const SEGMENT_GAP = 48;    // px gap between schedule segments
const MIN_BUBBLE_H = 70;   // min px height for a schedule bubble
const PX_PER_MIN = 1.6;    // px per minute of schedule duration

/**
 * Render timeline for a given date's schedules.
 *
 * New design:
 * - Only renders segments that have schedules (no full 24h grid)
 * - Time labels only at schedule boundaries (start / end)
 * - "Liquid fill" effect: passed time → bright/saturated, future → dim
 * - Current time indicator with time text
 * - Icons inside bubbles
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Array}    options.schedules   - schedule items (sorted by startTime)
 * @param {boolean}  options.showFill    - show liquid fill (home page only)
 * @param {boolean}  options.showCheck   - show checkboxes
 * @param {boolean}  options.isPast      - is this a past date
 * @param {Function} options.onCheck     - callback(id, checked)
 * @param {Function} options.onClick     - callback(schedule)
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

  if (schedules.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>今日沒有排程</p>
      </div>
    `;
    return;
  }

  // Current time in minutes (mapped to 4:00-28:00 range for overnight)
  const now = new Date();
  let nowMin = now.getHours() * 60 + now.getMinutes();
  const START_HOUR = 4;
  if (now.getHours() < START_HOUR) nowMin += 24 * 60;

  // Pre-process schedules: map times to a continuous range
  const items = schedules.map(item => {
    let startMin = timeToMinutes(item.startTime);
    let endMin = timeToMinutes(item.endTime);

    if (startMin < START_HOUR * 60) startMin += 24 * 60;
    if (item.isOvernight || endMin <= startMin) {
      endMin += 24 * 60;
    }
    if (endMin < START_HOUR * 60) endMin += 24 * 60;

    const durationMin = endMin - startMin;
    const height = Math.max(durationMin * PX_PER_MIN, MIN_BUBBLE_H);

    return { ...item, startMin, endMin, durationMin, height };
  });

  // Sort by start time
  items.sort((a, b) => a.startMin - b.startMin);

  // Build layout: calculate y positions
  let yPos = 0;
  const layoutItems = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Time label for this schedule's start
    const labelY = yPos;
    const bubbleY = yPos + 20; // leave room for the top time label

    layoutItems.push({
      ...item,
      labelY,
      bubbleY,
      bubbleHeight: item.height,
    });

    yPos = bubbleY + item.height + SEGMENT_GAP;
  }

  const totalHeight = yPos + 40; // extra bottom padding

  // -- Determine where "now" falls in this layout --
  let currentTimeY = null;
  let currentTimeText = null;
  if (showFill) {
    const nowTimeStr = currentTimeStr();

    // Find which segment "now" is in, or between
    for (let i = 0; i < layoutItems.length; i++) {
      const it = layoutItems[i];
      if (nowMin >= it.startMin && nowMin <= it.endMin) {
        // Inside this schedule
        const progress = (nowMin - it.startMin) / (it.endMin - it.startMin);
        currentTimeY = it.bubbleY + progress * it.bubbleHeight;
        currentTimeText = nowTimeStr;
        break;
      } else if (nowMin < it.startMin) {
        // Before this schedule
        if (i === 0) {
          // Before first schedule
          currentTimeY = 0;
        } else {
          // Between prev and this — map linearly in the gap
          const prev = layoutItems[i - 1];
          const gapStart = prev.bubbleY + prev.bubbleHeight;
          const gapEnd = it.bubbleY;
          const gapTimeStart = prev.endMin;
          const gapTimeEnd = it.startMin;
          const progress = (nowMin - gapTimeStart) / (gapTimeEnd - gapTimeStart);
          currentTimeY = gapStart + progress * (gapEnd - gapStart);
        }
        currentTimeText = nowTimeStr;
        break;
      }
    }

    // If now is after all schedules
    if (currentTimeY === null) {
      const last = layoutItems[layoutItems.length - 1];
      if (nowMin > last.endMin) {
        currentTimeY = last.bubbleY + last.bubbleHeight + 20;
        currentTimeText = nowTimeStr;
      }
    }
  }

  // ---- Build HTML ----
  let html = `<div class="tl-container" style="height: ${totalHeight}px;">`;

  // Vertical track line
  if (layoutItems.length > 0) {
    const trackTop = layoutItems[0].bubbleY;
    const lastItem = layoutItems[layoutItems.length - 1];
    const trackBottom = lastItem.bubbleY + lastItem.bubbleHeight;
    const trackHeight = trackBottom - trackTop;

    // Filled portion of track (liquid)
    let fillHeight = 0;
    if (showFill && currentTimeY !== null) {
      fillHeight = Math.max(0, Math.min(currentTimeY - trackTop, trackHeight));
    }

    html += `<div class="tl-track" style="top: ${trackTop}px; height: ${trackHeight}px;">`;
    if (showFill) {
      html += `<div class="tl-track-filled" style="height: ${fillHeight}px;"></div>`;
    }
    html += `</div>`;
  }

  // Render each schedule item
  for (let i = 0; i < layoutItems.length; i++) {
    const it = layoutItems[i];

    // Determine fill state
    let state = '';
    if (showFill) {
      if (nowMin >= it.endMin) {
        state = 'passed';  // fully passed → bright
      } else if (nowMin >= it.startMin) {
        state = 'active';  // currently in progress
      } else {
        state = 'future';  // not yet → dim
      }
    } else if (isPast) {
      state = it.completed ? 'past-done' : 'past-undone';
    }

    // Start time label
    const startLabel = it.startTime;
    html += `<div class="tl-time-label ${showFill && nowMin >= it.startMin ? 'tl-passed' : ''}" style="top: ${it.labelY}px;">${startLabel}</div>`;

    // End time label (only if it differs from the next item's start, or is last)
    const isLast = i === layoutItems.length - 1;
    const nextItem = !isLast ? layoutItems[i + 1] : null;
    const showEndLabel = isLast || it.endMin !== nextItem?.startMin;
    if (showEndLabel) {
      const endLabelY = it.bubbleY + it.bubbleHeight + 2;
      const endTimeDisplay = it.isOvernight && it.endMin >= 24 * 60
        ? formatTime(it.endMin - 24 * 60) + ' ⁺¹'
        : it.endTime;
      html += `<div class="tl-time-label ${showFill && nowMin >= it.endMin ? 'tl-passed' : ''}" style="top: ${endLabelY}px;">${endTimeDisplay}</div>`;
    }

    // Bubble
    const bubbleClasses = [
      'tl-bubble',
      state ? `tl-${state}` : '',
      it.completed ? 'tl-completed' : '',
    ].filter(Boolean).join(' ');

    const duration = durationText(it.startTime, it.endTime, it.isOvernight);
    const overnightBadge = it.isOvernight ? `<span class="overnight-badge">⁺¹</span>` : '';

    // Remaining time for active items
    let remainingHtml = '';
    if (state === 'active' && !it.completed) {
      const remainMin = it.endMin - nowMin;
      if (remainMin > 0) {
        const rh = Math.floor(remainMin / 60);
        const rm = remainMin % 60;
        remainingHtml = `<div class="tl-remaining">剩餘 ${rh > 0 ? rh + '小時' : ''}${rm}分</div>`;
      }
    }

    // Active progress bar inside bubble
    let progressHtml = '';
    if (state === 'active' && showFill) {
      const progress = ((nowMin - it.startMin) / (it.endMin - it.startMin)) * 100;
      progressHtml = `<div class="tl-bubble-fill" style="height: ${progress}%;"></div>`;
    }

    html += `
      <div class="${bubbleClasses}" style="top: ${it.bubbleY}px; height: ${it.bubbleHeight}px;" data-id="${it.id}">
        ${progressHtml}
        <div class="tl-bubble-icon">${getIcon(it.icon || 'default')}</div>
        <div class="tl-content" data-action="edit">
          <div class="tl-title">${it.title}</div>
          <div class="tl-meta">
            ${it.startTime}–${it.endTime} ${overnightBadge}
            <span class="tl-duration">(${duration})</span>
          </div>
          ${remainingHtml}
        </div>
        ${showCheck ? `
          <div class="tl-check">
            <div class="checkbox ${it.completed ? 'checked' : ''}" data-action="check" data-id="${it.id}">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        ` : (isPast && it.completed ? `
          <div class="tl-check">
            <div class="checkbox checked">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        ` : '')}
      </div>
    `;
  }

  // Current time indicator
  if (showFill && currentTimeY !== null && currentTimeText) {
    html += `
      <div class="tl-now" style="top: ${currentTimeY}px;">
        <div class="tl-now-dot"></div>
        <div class="tl-now-line"></div>
        <div class="tl-now-text">${currentTimeText}</div>
      </div>
    `;
  }

  html += `</div>`; // end tl-container

  container.innerHTML = html;

  // ---- Bind events ----
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
      const wrap = el.closest('.tl-bubble');
      const id = wrap?.dataset.id;
      const item = schedules.find(s => s.id === id);
      if (item && onClick) onClick(item);
    });
  });

  // Auto-scroll to current time
  if (showFill && currentTimeY !== null) {
    const scrollTarget = Math.max(0, currentTimeY - container.clientHeight / 3);
    container.scrollTop = scrollTarget;
  }
}

function formatTime(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default renderTimeline;
