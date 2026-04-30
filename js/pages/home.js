// ========================================
// Home Page — Timeline + Tasks
// ========================================

import db from '../db.js';
import { todayStr, formatDateDisplay, getWeekdayName, uuid, getWeekDates, parseDate, getWeekdayShort, isToday, addDays } from '../utils/date.js';
import { ICON_LIST, getIcon, uiIcon } from '../utils/icons.js';
import { renderTimeline } from '../components/timeline.js';
import { renderTaskList } from '../components/taskList.js';
import { renderWeekSelector } from '../components/weekSelector.js';
import modalManager from '../components/modal.js';

let currentDate = todayStr();

export async function initHome() {
  await renderHomeTimeline();
  await renderHomeTasks();

  // Refresh timeline every minute
  setInterval(() => {
    if (document.getElementById('page-home').classList.contains('active')) {
      renderHomeTimeline();
    }
  }, 60000);
}

// ========================================
// Home Timeline Sub-page
// ========================================

async function renderHomeTimeline() {
  const container = document.getElementById('home-timeline');
  const today = todayStr();

  // Overnight logic: also fetch schedules from "yesterday" that are overnight
  const yesterday = addDays(today, -1);
  const todaySchedules = await db.getSchedulesByDate(today);
  const yesterdaySchedules = await db.getSchedulesByDate(yesterday);

  // Include overnight schedules from yesterday
  const overnightFromYesterday = yesterdaySchedules.filter(s => s.isOvernight);
  const schedules = [...overnightFromYesterday, ...todaySchedules];

  // Build header
  const dateDisplay = formatDateDisplay(today);
  const weekday = getWeekdayName(today);

  // Week strip data
  const weekDates = getWeekDates(today);

  let headerHtml = `
    <div class="page-header">
      <div class="page-date">${dateDisplay}</div>
      <div class="page-weekday">${weekday}</div>
    </div>
  `;

  // Week strip
  headerHtml += '<div class="week-strip">';
  weekDates.forEach((dateStr) => {
    const d = parseDate(dateStr);
    const dayOfWeek = d.getDay();
    const dayNum = d.getDate();
    const isTodayDate = isToday(dateStr);

    headerHtml += `
      <div class="week-day ${isTodayDate ? 'today' : ''}">
        <span class="week-day-label">${getWeekdayShort(dayOfWeek)}</span>
        <span class="week-day-num">${dayNum}</span>
        <div class="week-day-dots"></div>
      </div>
    `;
  });
  headerHtml += '</div>';

  // Create a stable container structure
  container.innerHTML = headerHtml + '<div id="home-timeline-body"></div>';

  const body = document.getElementById('home-timeline-body');

  renderTimeline(body, {
    schedules,
    showFill: true,
    showCheck: true,
    isPast: false,
    onCheck: async (id, checked) => {
      // Find in either list
      const item = todaySchedules.find(s => s.id === id) || overnightFromYesterday.find(s => s.id === id);
      if (item) {
        item.completed = checked;
        await db.updateSchedule(item);
      }
    },
    onClick: (item) => {
      openScheduleEditModal(item, () => renderHomeTimeline());
    },
  });
}

// ========================================
// Home Tasks Sub-page
// ========================================

async function renderHomeTasks() {
  const container = document.getElementById('home-tasks');
  const today = todayStr();
  const dateDisplay = formatDateDisplay(today);
  const weekday = getWeekdayName(today);

  const tasks = await db.getTasksByDate(today);

  // Also generate habit tasks for today
  const habits = await db.getActiveHabits();
  const dayOfWeek = new Date().getDay();

  for (const habit of habits) {
    if (!habit.repeatDays || !habit.repeatDays.includes(dayOfWeek)) continue;

    // Check if a habit task already exists for today
    const existing = tasks.find(t => t.habitId === habit.id && t.date === today);
    if (!existing) {
      // Create habit task for today
      const habitTask = {
        id: uuid(),
        date: today,
        title: habit.title,
        category: 'habit',
        deadline: null,
        completed: false,
        habitId: habit.id,
        parentId: null,
        order: Date.now(),
        createdAt: Date.now(),
      };
      await db.addTask(habitTask);
      // Add activation subtask if present
      if (habit.activationAction) {
        const activationTask = {
          id: uuid(),
          date: today,
          title: habit.activationAction,
          category: 'habit',
          deadline: null,
          completed: false,
          habitId: habit.id,
          parentId: habitTask.id,
          order: Date.now() + 1,
          createdAt: Date.now() + 1,
        };
        await db.addTask(activationTask);
        tasks.push(activationTask);
      }
    }
  }

  const topLevel = tasks.filter(t => !t.parentId);

  // Build subtasks map
  const subtasksMap = {};
  for (const task of topLevel) {
    subtasksMap[task.id] = await db.getSubtasks(task.id);
  }

  let headerHtml = `
    <div class="page-header">
      <div class="page-date">${dateDisplay}</div>
      <div class="page-weekday">${weekday}</div>
    </div>
  `;

  container.innerHTML = headerHtml + '<div id="home-tasks-body"></div>';

  const body = document.getElementById('home-tasks-body');

  renderTaskList(body, {
    tasks: topLevel,
    subtasksMap,
    hideCompleted: true,
    onCheck: async (id, checked) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.completed = checked;
        await db.updateTask(task);

        // If this is a habit task, also update the habit log
        if (task.habitId) {
          const log = await db.getHabitLog(task.habitId, today) || {
            id: uuid(),
            habitId: task.habitId,
            date: today,
            habitDone: false,
            activationDone: false,
          };
          log.habitDone = checked;
          await db.setHabitLog(log);
        }
      }
    },
    onSubCheck: async (id, checked) => {
      // Find subtask across all subtask arrays
      for (const subs of Object.values(subtasksMap)) {
        const sub = subs.find(s => s.id === id);
        if (sub) {
          sub.completed = checked;
          await db.updateTask(sub);
          
          // If this subtask is a habit activation action, update habit log
          if (sub.category === 'habit' && sub.habitId) {
            const date = sub.date || todayStr();
            const log = await db.getHabitLog(sub.habitId, date) || {
              id: uuid(),
              habitId: sub.habitId,
              date: date,
              habitDone: false,
              activationDone: false,
            };
            log.activationDone = checked;
            await db.setHabitLog(log);
          }
          break;
        }
      }
    },
    onClick: (task) => {
      openTaskEditModal(task, () => renderHomeTasks());
    },
  });
}

// ========================================
// FAB handler for Home
// ========================================

export function getHomeFabAction(subPageIndex) {
  if (subPageIndex === 0) {
    return () => openScheduleAddModal(todayStr(), () => renderHomeTimeline());
  } else {
    return () => openTaskAddModal(todayStr(), () => renderHomeTasks());
  }
}

// ========================================
// Schedule Add/Edit Modals
// ========================================

export async function openScheduleAddModal(date, onDone) {
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
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">新增</button>
    `,
  });

  // Icon picker logic
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
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const isOvernight = endMin <= startMin;

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

export async function openScheduleEditModal(item, onDone) {
  const iconGrid = ICON_LIST.map((ic) => `
    <button class="icon-option ${ic.key === (item.icon || 'default') ? 'selected' : ''}" data-icon="${ic.key}" title="${ic.label}">
      ${getIcon(ic.key)}
    </button>
  `).join('');

  modalManager.open({
    title: '編輯排程',
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
    await db.deleteSchedule(item.id);
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

    item.startTime = startTime;
    item.endTime = endTime;
    item.title = title;
    item.icon = icon;
    item.isOvernight = isOvernight;

    await db.updateSchedule(item);
    modalManager.close();
    if (onDone) onDone();
  };
}

// ========================================
// Task Add/Edit Modals
// ========================================

export async function openTaskAddModal(date, onDone) {
  modalManager.open({
    title: '新增任務',
    body: `
      <div class="form-group">
        <label class="form-label">任務名稱</label>
        <input type="text" class="form-input" id="modal-input-title" placeholder="輸入任務名稱...">
      </div>
      <div class="form-group">
        <label class="form-label">完成期限（選填）</label>
        <input type="date" class="form-input" id="modal-deadline" value="${date}">
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
      date,
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
          date,
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

export async function openTaskEditModal(task, onDone) {
  const subtasks = await db.getSubtasks(task.id);
  
  const subtasksHtml = subtasks.map(sub => `
    <div class="subtask-edit-item" data-id="${sub.id}">
      <input type="text" class="form-input subtask-input" value="${sub.title}">
      <button class="btn-icon text-danger subtask-delete-btn">${uiIcon('trash', 14)}</button>
    </div>
  `).join('');

  modalManager.open({
    title: '編輯任務',
    body: `
      <div class="form-group">
        <label class="form-label">任務名稱</label>
        <input type="text" class="form-input" id="modal-input-title" value="${task.title}">
      </div>
      <div class="form-group">
        <label class="form-label">完成期限</label>
        <input type="date" class="form-input" id="modal-deadline" value="${task.deadline || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">子任務</label>
        <div id="modal-subtasks-list" class="subtasks-list">
          ${subtasksHtml}
        </div>
        <button class="btn btn-secondary btn-small" id="modal-add-subtask" style="margin-top: 8px;">+ 新增子任務</button>
      </div>
    `,
    footer: `
      <button class="btn btn-danger btn-small" id="modal-delete">${uiIcon('trash', 14)} 刪除</button>
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">儲存</button>
    `,
  });

  document.getElementById('modal-add-subtask').onclick = () => {
    const list = document.getElementById('modal-subtasks-list');
    const div = document.createElement('div');
    div.className = 'subtask-edit-item';
    div.dataset.id = 'new_' + Date.now();
    div.innerHTML = `
      <input type="text" class="form-input subtask-input" placeholder="子任務名稱">
      <button class="btn-icon text-danger subtask-delete-btn">${uiIcon('trash', 14)}</button>
    `;
    list.appendChild(div);
    div.querySelector('.subtask-delete-btn').onclick = () => div.remove();
  };

  document.querySelectorAll('.subtask-delete-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.target.closest('.subtask-edit-item').remove();
    };
  });

  document.getElementById('modal-delete').onclick = async () => {
    await db.deleteTask(task.id);
    modalManager.close();
    if (onDone) onDone();
  };

  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const title = document.getElementById('modal-input-title').value.trim();
    const deadline = document.getElementById('modal-deadline').value || null;

    if (!title) return;

    task.title = title;
    task.deadline = deadline;
    await db.updateTask(task);

    const items = document.querySelectorAll('.subtask-edit-item');
    const updatedSubtaskIds = new Set();
    
    for (const item of items) {
      const id = item.dataset.id;
      const subTitle = item.querySelector('.subtask-input').value.trim();
      if (!subTitle) continue;
      
      if (id.startsWith('new_')) {
        await db.addTask({
          id: uuid(),
          date: task.date,
          title: subTitle,
          category: task.category,
          deadline: task.deadline,
          completed: false,
          habitId: null,
          parentId: task.id,
          order: Date.now(),
          createdAt: Date.now(),
        });
      } else {
        const existingSub = subtasks.find(s => s.id === id);
        if (existingSub) {
          if (existingSub.title !== subTitle) {
            existingSub.title = subTitle;
            await db.updateTask(existingSub);
          }
          updatedSubtaskIds.add(id);
        }
      }
    }
    
    for (const sub of subtasks) {
      if (!updatedSubtaskIds.has(sub.id)) {
        await db.deleteTask(sub.id);
      }
    }

    modalManager.close();
    if (onDone) onDone();
  };
}

// ========================================
// Helpers
// ========================================

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

export function refreshHome() {
  renderHomeTimeline();
  renderHomeTasks();
}

export default { initHome, getHomeFabAction, refreshHome };
