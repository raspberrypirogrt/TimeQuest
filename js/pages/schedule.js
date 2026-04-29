// ========================================
// Schedule Page — Weekly Timeline + Tasks
// ========================================

import db from '../db.js';
import { todayStr, formatDateDisplay, getWeekdayName, uuid, isPast, isToday, parseDate, addDays, getWeekDates, getWeekdayShort } from '../utils/date.js';
import { ICON_LIST, getIcon, uiIcon } from '../utils/icons.js';
import { renderTimeline } from '../components/timeline.js';
import { renderTaskList } from '../components/taskList.js';
import { renderWeekSelector } from '../components/weekSelector.js';
import { openScheduleAddModal, openScheduleEditModal, openTaskAddModal, openTaskEditModal } from './home.js';
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
  
  // Render week selector
  const weekContainer = document.getElementById('schedule-week-selector');
  const weekDates = getWeekDates(selectedDate);
  
  // Build dot map
  const dotMap = {};
  for (const d of weekDates) {
    const schedules = await db.getSchedulesByDate(d);
    const tasks = await db.getTasksByDate(d);
    const dots = [];
    if (schedules.length > 0) dots.push('schedule');
    if (tasks.some(t => t.category === 'progress')) dots.push('task');
    if (tasks.some(t => t.category === 'habit')) dots.push('habit');
    if (dots.length > 0) dotMap[d] = dots;
  }
  
  renderWeekSelector(weekContainer, {
    selectedDate,
    dotMap,
    onSelect: (date) => {
      selectedDate = date;
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
      isPast: false,
      onClick: (item) => {
        openTemplateEditModal(item, parseDate(selectedDate).getDay(), () => renderScheduleTimeline());
      },
    });
  } else {
    // Schedule mode
    const schedules = await db.getSchedulesByDate(selectedDate);
    
    renderTimeline(body, {
      schedules,
      showFill: isToday(selectedDate),
      showCheck: !pastDay,
      isPast: pastDay,
      onCheck: async (id, checked) => {
        const item = schedules.find(s => s.id === id);
        if (item) {
          item.completed = checked;
          await db.updateSchedule(item);
        }
      },
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
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          ${uiIcon('inbox', 48).replace(/<\/?svg[^>]*>/g, '')}
        </svg>
        <p>任務池是空的</p>
      </div>
    `;
    return;
  }
  
  let html = '<div class="task-list stagger-in">';
  
  tasks.forEach((task) => {
    const categoryTag = task.category === 'habit'
      ? `<span class="tag tag-habit">習慣</span>`
      : `<span class="tag tag-progress">進度</span>`;
    
    html += `
      <div class="task-pool-item" data-id="${task.id}">
        <div class="task-item-info">
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
  });
  
  html += '</div>';
  container.innerHTML = html;
  
  // Bind add-to-today
  container.querySelectorAll('[data-action="add-today"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.date = selectedDate;
        await db.updateTask(task);
        renderScheduleTasks();
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
        <input type="text" class="form-input" id="modal-title" value="${item.title}">
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
    const title = document.getElementById('modal-title').value.trim();
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
        <input type="text" class="form-input" id="modal-title" placeholder="輸入事項名稱...">
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
    const title = document.getElementById('modal-title').value.trim();
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
    // Tasks sub-page
    if (taskViewMode === 'today') {
      return () => openTaskAddModal(selectedDate, () => renderScheduleTasks());
    }
    return null; // No FAB for pool view
  }
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
        <input type="text" class="form-input" id="modal-title" placeholder="輸入事項名稱...">
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
    const title = document.getElementById('modal-title').value.trim();
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
