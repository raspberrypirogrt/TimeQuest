// ========================================
// Schedule Page — Weekly Timeline + Tasks
// ========================================

import db from '../db.js';
import { todayStr, formatDateDisplay, getWeekdayName, uuid, isPast, isToday, parseDate, addDays, getWeekDates, getWeekdayShort } from '../utils/date.js';
import { ICON_LIST, getIcon, uiIcon } from '../utils/icons.js';
import { renderTimeline } from '../components/timeline.js';
import { renderTaskList } from '../components/taskList.js';
import { renderWeekSelector } from '../components/weekSelector.js';
import { openScheduleAddModal, openScheduleEditModal, openTaskEditModal } from './home.js';
import modalManager from '../components/modal.js';

let selectedDate = todayStr();
let isTemplateMode = false;
let taskViewMode = 'today'; // 'today' or 'pool'

export async function initSchedule() {
  await renderScheduleTimeline();
  await renderScheduleTasks();
}

// ========================================
// Schedule Timeline Sub-page
// ========================================

async function renderScheduleTimeline() {
  const container = document.getElementById('schedule-timeline');
  const pastDay = isPast(selectedDate) && !isToday(selectedDate);

  // Overnight logic: also fetch overnight schedules from previous day
  const prevDay = addDays(selectedDate, -1);
  const daySchedules = await db.getSchedulesByDate(selectedDate);
  const prevDaySchedules = await db.getSchedulesByDate(prevDay);
  const overnightFromPrev = prevDaySchedules.filter(s => s.isOvernight);
  const schedules = [...overnightFromPrev, ...daySchedules];

  // Build header with week selector
  let headerHtml = `
    <div class="page-header">
      <div class="page-date">${formatDateDisplay(selectedDate)}</div>
      <div class="page-weekday">${getWeekdayName(selectedDate)}</div>
    </div>
    <div id="schedule-week-selector"></div>
  `;

  if (isTemplateMode) {
    const dow = parseDate(selectedDate).getDay();
    const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    headerHtml += `<div class="schedule-mode-label">${uiIcon('template', 14)} 預設模板 — ${dayNames[dow]}</div>`;
  }

  container.innerHTML = headerHtml + '<div id="schedule-timeline-body"></div>';

  // Render week selector with prev/next week navigation
  const weekContainer = document.getElementById('schedule-week-selector');
  const weekDates = getWeekDates(selectedDate);

  // Build dot map
  const dotMap = {};
  for (const d of weekDates) {
    const scheds = await db.getSchedulesByDate(d);
    const tasks = await db.getTasksByDate(d);
    const dots = [];
    if (scheds.length > 0) dots.push('schedule');
    if (tasks.some(t => t.category === 'progress')) dots.push('task');
    if (tasks.some(t => t.category === 'habit')) dots.push('habit');
    if (dots.length > 0) dotMap[d] = dots;
  }

  renderWeekSelector(weekContainer, {
    selectedDate,
    dotMap,
    showWeekNav: true,
    onSelect: (date) => {
      selectedDate = date;
      renderScheduleTimeline();
      renderScheduleTasks();
    },
    onWeekChange: (newDate) => {
      selectedDate = newDate;
      renderScheduleTimeline();
      renderScheduleTasks();
    },
  });

  const body = document.getElementById('schedule-timeline-body');

  if (isTemplateMode) {
    // Template mode
    const dow = parseDate(selectedDate).getDay();
    const templates = await db.getTemplatesByDay(dow);

    const templateAsSchedules = templates.map(t => ({
      id: t.id,
      startTime: t.startTime,
      endTime: t.endTime,
      isOvernight: t.isOvernight,
      title: t.title,
      icon: t.icon,
      completed: false,
    }));

    renderTimeline(body, {
      schedules: templateAsSchedules,
      showFill: false,
      showCheck: false,
      showFullTimeline: true,
      isPast: false,
      onClick: (item) => {
        openTemplateEditModal(item, parseDate(selectedDate).getDay(), () => renderScheduleTimeline());
      },
    });
  } else {
    // Normal schedule mode
    // No checkboxes on schedule page — only show completion status for past days
    renderTimeline(body, {
      schedules,
      showFill: false,
      showCheck: false,    // Never show checkboxes on schedule page
      showFullTimeline: true,
      isPast: pastDay,
      onCheck: null,
      onClick: (item) => {
        if (!pastDay) {
          openScheduleEditModal(item, () => renderScheduleTimeline());
        }
      },
    });
  }
}

// ========================================
// Schedule Tasks Sub-page
// ========================================

async function renderScheduleTasks() {
  const container = document.getElementById('schedule-tasks');

  let headerHtml = `
    <div class="page-header">
      <div class="page-date">${formatDateDisplay(selectedDate)}</div>
      <div class="page-weekday">${getWeekdayName(selectedDate)}</div>
    </div>
    <div class="segment-control" id="schedule-task-toggle">
      <button class="segment-btn ${taskViewMode === 'today' ? 'active' : ''}" data-mode="today">當天任務</button>
      <button class="segment-btn ${taskViewMode === 'pool' ? 'active' : ''}" data-mode="pool">任務池</button>
    </div>
  `;

  container.innerHTML = headerHtml + '<div id="schedule-tasks-body"></div>';

  // Toggle binding
  container.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      taskViewMode = btn.dataset.mode;
      renderScheduleTasks();
    });
  });

  const body = document.getElementById('schedule-tasks-body');

  if (taskViewMode === 'today') {
    const tasks = await db.getTasksByDate(selectedDate);
    const topLevel = tasks.filter(t => !t.parentId);

    const subtasksMap = {};
    for (const task of topLevel) {
      subtasksMap[task.id] = await db.getSubtasks(task.id);
    }

    renderTaskList(body, {
      tasks: topLevel,
      subtasksMap,
      hideCompleted: false,
      onCheck: async (id, checked) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
          task.completed = checked;
          await db.updateTask(task);
        }
      },
      onSubCheck: async (id, checked) => {
        for (const subs of Object.values(subtasksMap)) {
          const sub = subs.find(s => s.id === id);
          if (sub) {
            sub.completed = checked;
            await db.updateTask(sub);
            break;
          }
        }
      },
      onClick: (task) => {
        openTaskEditModal(task, () => renderScheduleTasks());
      },
    });
  } else {
    // Task pool
    await renderTaskPool(body);
  }
}

async function renderTaskPool(container) {
  const tasks = await db.getUnscheduledTasks();
  // Only top-level tasks in pool
  const topLevel = tasks.filter(t => !t.parentId);

  if (topLevel.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          ${uiIcon('inbox', 48).replace(/<\/?svg[^>]*>/g, '')}
        </svg>
        <p>任務池是空的<br>點擊 + 新增任務到任務池</p>
      </div>
    `;
    return;
  }

  // Build subtasks map
  const subtasksMap = {};
  for (const task of topLevel) {
    subtasksMap[task.id] = tasks.filter(t => t.parentId === task.id);
  }

  let html = '<div class="task-list stagger-in">';

  topLevel.forEach((task) => {
    const categoryTag = task.category === 'habit'
      ? `<span class="tag tag-habit">習慣</span>`
      : `<span class="tag tag-progress">進度</span>`;
    const subtasks = subtasksMap[task.id] || [];
    const hasSubtasks = subtasks.length > 0;

    html += `
      <div class="task-pool-item" data-id="${task.id}">
        ${hasSubtasks ? `
          <button class="task-expand-btn" data-action="expand-pool" data-id="${task.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ` : '<div style="width: 8px;"></div>'}
        <div class="task-item-info" data-action="edit-pool" data-id="${task.id}">
          <div class="task-item-top">
            ${categoryTag}
            <span class="task-item-title">${task.title}</span>
          </div>
          ${task.deadline ? `<div class="task-item-meta"><span class="task-item-deadline">${uiIcon('clock', 12)} ${task.deadline}</span></div>` : ''}
        </div>
        <button class="task-pool-add-btn" data-action="add-today" data-id="${task.id}" title="加入當天">
          ${uiIcon('plus', 14)}
        </button>
      </div>
    `;

    // Subtasks (hidden by default)
    if (hasSubtasks) {
      html += `<div class="task-subtasks" data-parent="${task.id}" style="display: none;">`;
      subtasks.forEach((sub) => {
        html += `
          <div class="task-subtask" data-id="${sub.id}">
            <div class="task-item-info">
              <span class="task-item-title">${sub.title}</span>
            </div>
            <div class="checkbox ${sub.completed ? 'checked' : ''}" data-action="pool-subcheck" data-id="${sub.id}">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  });

  html += '</div>';
  container.innerHTML = html;

  // Bind add-to-today
  container.querySelectorAll('[data-action="add-today"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const task = topLevel.find(t => t.id === id);
      if (task) {
        task.date = selectedDate;
        await db.updateTask(task);
        // Also move subtasks
        const subs = subtasksMap[task.id] || [];
        for (const sub of subs) {
          sub.date = selectedDate;
          await db.updateTask(sub);
        }
        renderScheduleTasks();
      }
    });
  });

  // Bind click on task info → open edit modal
  container.querySelectorAll('[data-action="edit-pool"]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const task = topLevel.find(t => t.id === id);
      if (task) {
        openTaskEditModal(task, () => renderScheduleTasks());
      }
    });
  });

  // Bind expand
  container.querySelectorAll('[data-action="expand-pool"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      el.classList.toggle('expanded');
      const subtasksEl = container.querySelector(`[data-parent="${id}"]`);
      if (subtasksEl) {
        subtasksEl.style.display = subtasksEl.style.display === 'none' ? 'block' : 'none';
      }
    });
  });

  // Bind subtask check
  container.querySelectorAll('[data-action="pool-subcheck"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      const isChecked = el.classList.contains('checked');
      el.classList.toggle('checked');
      // Find subtask and update
      for (const subs of Object.values(subtasksMap)) {
        const sub = subs.find(s => s.id === id);
        if (sub) {
          sub.completed = !isChecked;
          await db.updateTask(sub);
          break;
        }
      }
    });
  });
}

// ========================================
// Template Modals
// ========================================

async function openTemplateEditModal(item, dayOfWeek, onDone) {
  const iconGrid = ICON_LIST.map((ic) => `
    <button class="icon-option ${ic.key === (item.icon || 'default') ? 'selected' : ''}" data-icon="${ic.key}" title="${ic.label}">
      ${getIcon(ic.key)}
    </button>
  `).join('');

  modalManager.open({
    title: '編輯模板',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">開始時間</label>
          <input type="time" class="form-input" id="modal-start-time" value="${item.startTime}">
        </div>
        <div class="form-time-separator">–</div>
        <div class="form-group">
          <label class="form-label">結束時間</label>
          <input type="time" class="form-input" id="modal-end-time" value="${item.endTime}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">事項名稱</label>
        <input type="text" class="form-input" id="modal-input-title" value="${item.title}">
      </div>
      <div class="form-group">
        <label class="form-label">圖示</label>
        <div class="icon-picker" id="modal-icon-picker">
          ${iconGrid}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-danger btn-small" id="modal-delete">${uiIcon('trash', 14)} 刪除</button>
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">儲存</button>
    `,
  });

  setupIconPicker();

  document.getElementById('modal-delete').onclick = async () => {
    await db.deleteTemplate(item.id);
    modalManager.close();
    if (onDone) onDone();
  };

  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const startTime = document.getElementById('modal-start-time').value;
    const endTime = document.getElementById('modal-end-time').value;
    const title = document.getElementById('modal-input-title').value.trim();
    const icon = document.querySelector('.icon-option.selected')?.dataset.icon || 'default';

    if (!title) return;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const isOvernight = (eh * 60 + em) <= (sh * 60 + sm);

    await db.updateTemplate({
      id: item.id,
      dayOfWeek,
      startTime,
      endTime,
      isOvernight,
      title,
      icon,
    });

    modalManager.close();
    if (onDone) onDone();
  };
}

async function openTemplateAddModal(dayOfWeek, onDone) {
  const iconGrid = ICON_LIST.map((ic, i) => `
    <button class="icon-option ${i === 0 ? 'selected' : ''}" data-icon="${ic.key}" title="${ic.label}">
      ${getIcon(ic.key)}
    </button>
  `).join('');

  modalManager.open({
    title: '新增模板',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">開始時間</label>
          <input type="time" class="form-input" id="modal-start-time" value="09:00">
        </div>
        <div class="form-time-separator">–</div>
        <div class="form-group">
          <label class="form-label">結束時間</label>
          <input type="time" class="form-input" id="modal-end-time" value="10:00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">事項名稱</label>
        <input type="text" class="form-input" id="modal-input-title" placeholder="輸入事項名稱...">
      </div>
      <div class="form-group">
        <label class="form-label">圖示</label>
        <div class="icon-picker" id="modal-icon-picker">
          ${iconGrid}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">新增</button>
    `,
  });

  setupIconPicker();

  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const startTime = document.getElementById('modal-start-time').value;
    const endTime = document.getElementById('modal-end-time').value;
    const title = document.getElementById('modal-input-title').value.trim();
    const icon = document.querySelector('.icon-option.selected')?.dataset.icon || 'default';

    if (!title) return;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const isOvernight = (eh * 60 + em) <= (sh * 60 + sm);

    await db.addTemplate({
      id: uuid(),
      dayOfWeek,
      startTime,
      endTime,
      isOvernight,
      title,
      icon,
    });

    modalManager.close();
    if (onDone) onDone();
  };
}

// ========================================
// Apply Template to Date
// ========================================

async function applyTemplate(date) {
  const dow = parseDate(date).getDay();
  const templates = await db.getTemplatesByDay(dow);

  for (const t of templates) {
    await db.addSchedule({
      id: uuid(),
      date,
      startTime: t.startTime,
      endTime: t.endTime,
      isOvernight: t.isOvernight || false,
      title: t.title,
      icon: t.icon,
      completed: false,
      createdAt: Date.now(),
    });
  }
}

// ========================================
// FAB handler for Schedule
// ========================================

export function getScheduleFabAction(subPageIndex) {
  if (subPageIndex === 0) {
    // Timeline sub-page
    const pastDay = isPast(selectedDate) && !isToday(selectedDate);
    if (pastDay && !isTemplateMode) return null; // No FAB for past days in schedule mode

    if (isTemplateMode) {
      return () => {
        const dow = parseDate(selectedDate).getDay();
        openTemplateAddModal(dow, () => renderScheduleTimeline());
      };
    } else {
      return () => openScheduleAddWithTemplate(selectedDate, () => renderScheduleTimeline());
    }
  } else {
    // Tasks sub-page — always add to task pool (date = null)
    return () => openTaskPoolAddModal(() => renderScheduleTasks());
  }
}

// New task add modal that adds to task pool (date = null)
async function openTaskPoolAddModal(onDone) {
  modalManager.open({
    title: '新增任務到任務池',
    body: `
      <div class="form-group">
        <label class="form-label">任務名稱</label>
        <input type="text" class="form-input" id="modal-input-title" placeholder="輸入任務名稱...">
      </div>
      <div class="form-group">
        <label class="form-label">完成期限（選填）</label>
        <input type="date" class="form-input" id="modal-deadline">
      </div>
      <div class="form-group">
        <label class="form-label">子任務</label>
        <div id="modal-subtasks-list" class="subtasks-list"></div>
        <button class="btn btn-secondary btn-small" id="modal-add-subtask" style="margin-top: 8px;">+ 新增子任務</button>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">新增</button>
    `,
  });

  document.getElementById('modal-add-subtask').onclick = () => {
    const list = document.getElementById('modal-subtasks-list');
    const div = document.createElement('div');
    div.className = 'subtask-edit-item';
    div.innerHTML = `
      <input type="text" class="form-input subtask-input" placeholder="子任務名稱">
      <button class="btn-icon text-danger subtask-delete-btn">${uiIcon('trash', 14)}</button>
    `;
    list.appendChild(div);
    div.querySelector('.subtask-delete-btn').onclick = () => div.remove();
  };

  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const title = document.getElementById('modal-input-title').value.trim();
    const deadline = document.getElementById('modal-deadline').value || null;

    if (!title) return;

    const taskId = uuid();
    await db.addTask({
      id: taskId,
      date: null,  // null = task pool, not assigned to any day
      title,
      category: 'progress',
      deadline,
      completed: false,
      habitId: null,
      parentId: null,
      order: Date.now(),
      createdAt: Date.now(),
    });

    const subtaskInputs = document.querySelectorAll('.subtask-input');
    for (const input of subtaskInputs) {
      const subTitle = input.value.trim();
      if (subTitle) {
        await db.addTask({
          id: uuid(),
          date: null,
          title: subTitle,
          category: 'progress',
          deadline,
          completed: false,
          habitId: null,
          parentId: taskId,
          order: Date.now(),
          createdAt: Date.now(),
        });
      }
    }

    modalManager.close();
    if (onDone) onDone();
  };
}

async function openScheduleAddWithTemplate(date, onDone) {
  const iconGrid = ICON_LIST.map((ic, i) => `
    <button class="icon-option ${i === 0 ? 'selected' : ''}" data-icon="${ic.key}" title="${ic.label}">
      ${getIcon(ic.key)}
    </button>
  `).join('');

  modalManager.open({
    title: '新增排程',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">開始時間</label>
          <input type="time" class="form-input" id="modal-start-time" value="09:00">
        </div>
        <div class="form-time-separator">–</div>
        <div class="form-group">
          <label class="form-label">結束時間</label>
          <input type="time" class="form-input" id="modal-end-time" value="10:00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">事項名稱</label>
        <input type="text" class="form-input" id="modal-input-title" placeholder="輸入事項名稱...">
      </div>
      <div class="form-group">
        <label class="form-label">圖示</label>
        <div class="icon-picker" id="modal-icon-picker">
          ${iconGrid}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="modal-apply-template">${uiIcon('template', 14)} 套用預設</button>
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">新增</button>
    `,
  });

  setupIconPicker();

  document.getElementById('modal-apply-template').onclick = async () => {
    await applyTemplate(date);
    modalManager.close();
    if (onDone) onDone();
  };

  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const startTime = document.getElementById('modal-start-time').value;
    const endTime = document.getElementById('modal-end-time').value;
    const title = document.getElementById('modal-input-title').value.trim();
    const icon = document.querySelector('.icon-option.selected')?.dataset.icon || 'default';

    if (!title) return;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const isOvernight = (eh * 60 + em) <= (sh * 60 + sm);

    await db.addSchedule({
      id: uuid(),
      date,
      startTime,
      endTime,
      isOvernight,
      title,
      icon,
      completed: false,
      createdAt: Date.now(),
    });

    modalManager.close();
    if (onDone) onDone();
  };
}

// ========================================
// Template Mode Toggle
// ========================================

export function getTemplateModeToggle() {
  return {
    isTemplateMode,
    toggle: () => {
      isTemplateMode = !isTemplateMode;
      renderScheduleTimeline();
    },
  };
}

function setupIconPicker() {
  const picker = document.getElementById('modal-icon-picker');
  if (!picker) return;
  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-option');
    if (!btn) return;
    picker.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
}

export function refreshSchedule() {
  renderScheduleTimeline();
  renderScheduleTasks();
}

export default { initSchedule, getScheduleFabAction, getTemplateModeToggle, refreshSchedule };
