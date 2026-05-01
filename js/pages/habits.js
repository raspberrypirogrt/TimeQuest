// ========================================
// Habits Page — Statistics + Management
// ========================================

import db from '../db.js';
import { todayStr, formatDate, parseDate, uuid, getWeekdayShort } from '../utils/date.js';
import { uiIcon } from '../utils/icons.js';
import { renderCalendar } from '../components/calendar.js';
import modalManager from '../components/modal.js';

let selectedHabitIndex = 0;
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

export async function initHabits() {
  await renderHabitStats();
  await renderHabitManage();
}

// ========================================
// Statistics Sub-page
// ========================================

async function renderHabitStats() {
  const container = document.getElementById('habits-stats');
  const habits = await db.getActiveHabits();
  
  if (habits.length === 0) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-date">習慣統計</div>
        <div class="version-badge">v15</div>
      </div>
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>尚未建立任何習慣<br>前往「習慣」頁面新增</p>
      </div>
    `;
    return;
  }
  
  // Ensure index is valid
  if (selectedHabitIndex >= habits.length) selectedHabitIndex = 0;
  
  const currentHabit = habits[selectedHabitIndex];
  const allLogs = await db.getHabitLogsByHabit(currentHabit.id);
  
  // Calculate stats
  let totalAllDone = 0;
  let totalActivationDone = 0;
  const habitDoneDates = new Set();
  const activationDoneDates = new Set();
  
  // Total across ALL habits
  let globalTotal = 0;
  for (const h of habits) {
    const logs = await db.getHabitLogsByHabit(h.id);
    globalTotal += logs.filter(l => l.habitDone).length;
  }
  
  allLogs.forEach(log => {
    if (log.habitDone) {
      totalAllDone++;
      habitDoneDates.add(log.date);
    }
    if (log.activationDone) {
      totalActivationDone++;
      if (!log.habitDone) {
        activationDoneDates.add(log.date);
      }
    }
  });
  
  // Calculate consecutive days
  let consecutive = 0;
  let checkDate = todayStr();
  while (true) {
    const log = allLogs.find(l => l.date === checkDate);
    if (log && log.habitDone) {
      consecutive++;
      const d = parseDate(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = formatDate(d);
    } else {
      break;
    }
  }
  
  let html = `
    <div class="page-header">
      <div class="page-date">習慣統計</div>
      <div class="version-badge">v15</div>
    </div>
    
    <div class="stats-hero">
      <div class="stats-hero-number">${globalTotal}</div>
      <div class="stats-hero-label">總達成次數</div>
    </div>
    
    <div class="habit-selector">
      <button class="habit-selector-arrow" id="habit-prev">
        ${uiIcon('chevronLeft', 18)}
      </button>
      <div class="habit-selector-name">${currentHabit.title}</div>
      <button class="habit-selector-arrow" id="habit-next">
        ${uiIcon('chevronRight', 18)}
      </button>
    </div>
    
    <div class="habit-stats-panel">
      <div class="stat-card">
        <div class="stat-card-number">${totalAllDone}</div>
        <div class="stat-card-label">達成次數</div>
        <div class="stat-card-sub">
          啟動 <span class="sub-number">${totalActivationDone}</span> 次
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-number">${consecutive}</div>
        <div class="stat-card-label">連續達成</div>
        <div class="stat-card-sub">
          啟動 <span class="sub-number">${totalActivationDone}</span> 次
        </div>
      </div>
    </div>
    
    <div id="habit-calendar-container" style="margin-top: 16px;"></div>
    
    <!-- Backup Section -->
    <div class="backup-section" style="margin-top: 32px; margin-bottom: 24px; padding: 16px; background: var(--color-bg-elevated); border-radius: var(--radius-md);">
      <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: 12px; font-weight: 600;">資料備份與還原</div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" id="btn-export-data" style="flex: 1;">
          ${uiIcon('download', 14)} 匯出備份 (JSON)
        </button>
        <button class="btn btn-secondary" id="btn-import-data" style="flex: 1; position: relative;">
          ${uiIcon('upload', 14)} 匯入還原
          <input type="file" id="input-import-file" accept=".json" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
        </button>
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 8px; text-align: center;">匯入會完全覆寫現有資料，請謹慎操作。</div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Calendar
  renderCalendar(document.getElementById('habit-calendar-container'), {
    year: calendarYear,
    month: calendarMonth,
    habitDoneDates,
    activationDoneDates,
    onMonthChange: (y, m) => {
      calendarYear = y;
      calendarMonth = m;
      renderHabitStats();
    },
  });
  
  // Habit selector navigation
  document.getElementById('habit-prev').addEventListener('click', () => {
    selectedHabitIndex = (selectedHabitIndex - 1 + habits.length) % habits.length;
    renderHabitStats();
  });
  
  document.getElementById('habit-next').addEventListener('click', () => {
    selectedHabitIndex = (selectedHabitIndex + 1) % habits.length;
    renderHabitStats();
  });
  
  // Backup Events
  document.getElementById('btn-export-data').addEventListener('click', async () => {
    try {
      const { exportData } = await import('../backup.js');
      const jsonData = await exportData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timequest-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('匯出失敗：' + e.message);
    }
  });
  
  document.getElementById('input-import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (confirm('警告：這將會清除目前所有的資料，並替換為備份檔的內容，確定要繼續嗎？')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const { importData } = await import('../backup.js');
          await importData(event.target.result);
          alert('資料還原成功！將重新載入頁面。');
          window.location.reload();
        } catch (err) {
          alert('還原失敗：' + err.message);
        }
      };
      reader.readAsText(file);
    }
    // reset input
    e.target.value = '';
  });
}

// ========================================
// Habit Management Sub-page
// ========================================

async function renderHabitManage() {
  const container = document.getElementById('habits-manage');
  const habits = await db.getAllHabits();
  
  let html = `
    <div class="page-header">
      <div class="page-date">管理習慣</div>
    </div>
  `;
  
  if (habits.length === 0) {
    html += `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>點擊右下角 + 新增習慣</p>
      </div>
    `;
  } else {
    html += '<div class="habit-list stagger-in">';
    
    habits.forEach((habit) => {
      const repeatText = getRepeatText(habit);
      
      html += `
        <div class="habit-card ${habit.active ? '' : 'inactive'}" data-id="${habit.id}" data-action="habit-click">
          <div class="habit-card-header">
            <div class="habit-card-title">${habit.title}</div>
          </div>
          <div class="habit-card-body">
            <div class="habit-card-activation">
              ${uiIcon('zap', 14)}
              <span>啟動動作：${habit.activationAction}</span>
            </div>
            <div class="habit-card-repeat">
              ${uiIcon('repeat', 12)}
              <span>${repeatText}</span>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  }
  
  container.innerHTML = html;
  
  // Bind click on card → open edit modal
  container.querySelectorAll('[data-action="habit-click"]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const habit = habits.find(h => h.id === id);
      if (habit) openHabitEditModal(habit, () => { renderHabitManage(); renderHabitStats(); });
    });
  });
}

// ========================================
// Habit Add/Edit Modals
// ========================================

function getRepeatDaysHtml(selectedDays = []) {
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  return `
    <div class="days-selector">
      ${dayLabels.map((label, i) => `
        <button class="day-toggle ${selectedDays.includes(i) ? 'active' : ''}" data-day="${i}">${label}</button>
      `).join('')}
    </div>
  `;
}

export async function openHabitAddModal(onDone) {
  modalManager.open({
    title: '新增習慣',
    body: `
      <div class="form-group">
        <label class="form-label">習慣名稱</label>
        <input type="text" class="form-input" id="modal-input-title" placeholder="例如：運動30分鐘">
      </div>
      <div class="form-group">
        <label class="form-label">啟動動作（必填）</label>
        <input type="text" class="form-input" id="modal-activation" placeholder="例如：換上運動服">
      </div>
      <div class="form-group">
        <label class="form-label">重複方式</label>
        <select class="form-input" id="modal-repeat-type">
          <option value="daily">每天</option>
          <option value="weekly">每週（全部）</option>
          <option value="custom">自訂</option>
        </select>
      </div>
      <div class="form-group" id="modal-days-group" style="display: none;">
        <label class="form-label">選擇重複日</label>
        ${getRepeatDaysHtml([])}
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">新增</button>
    `,
  });
  
  setupRepeatTypeToggle();
  setupDaysSelector();
  
  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const title = document.getElementById('modal-input-title').value.trim();
    const activation = document.getElementById('modal-activation').value.trim();
    const repeatType = document.getElementById('modal-repeat-type').value;
    
    if (!title || !activation) return;
    
    let repeatDays = [];
    if (repeatType === 'daily') {
      repeatDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (repeatType === 'weekly') {
      repeatDays = [0, 1, 2, 3, 4, 5, 6];
    } else {
      document.querySelectorAll('.day-toggle.active').forEach(el => {
        repeatDays.push(parseInt(el.dataset.day));
      });
    }
    
    await db.addHabit({
      id: uuid(),
      title,
      activationAction: activation,
      repeatType,
      repeatDays,
      active: true,
      createdAt: Date.now(),
    });
    
    modalManager.close();
    if (onDone) onDone();
  };
}

async function openHabitEditModal(habit, onDone) {
  modalManager.open({
    title: '編輯習慣',
    body: `
      <div class="form-group">
        <label class="form-label">習慣名稱</label>
        <input type="text" class="form-input" id="modal-input-title" value="${habit.title}">
      </div>
      <div class="form-group">
        <label class="form-label">啟動動作</label>
        <input type="text" class="form-input" id="modal-activation" value="${habit.activationAction}">
      </div>
      <div class="form-group">
        <label class="form-label">重複方式</label>
        <select class="form-input" id="modal-repeat-type">
          <option value="daily" ${habit.repeatType === 'daily' ? 'selected' : ''}>每天</option>
          <option value="weekly" ${habit.repeatType === 'weekly' ? 'selected' : ''}>每週（全部）</option>
          <option value="custom" ${habit.repeatType === 'custom' ? 'selected' : ''}>自訂</option>
        </select>
      </div>
      <div class="form-group" id="modal-days-group" style="display: ${habit.repeatType === 'custom' ? 'block' : 'none'};">
        <label class="form-label">選擇重複日</label>
        ${getRepeatDaysHtml(habit.repeatDays || [])}
      </div>
      <div class="form-group">
        <label class="form-label">狀態</label>
        <div class="segment-control">
          <button class="segment-btn ${habit.active ? 'active' : ''}" data-active="true">啟用</button>
          <button class="segment-btn ${!habit.active ? 'active' : ''}" data-active="false">停用</button>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-danger btn-small" id="modal-delete">${uiIcon('trash', 14)} 刪除</button>
      <button class="btn btn-secondary" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="modal-save">儲存</button>
    `,
  });
  
  setupRepeatTypeToggle();
  setupDaysSelector();
  
  // Active toggle
  let activeState = habit.active;
  document.querySelectorAll('[data-active]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-active]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeState = btn.dataset.active === 'true';
    });
  });
  
  document.getElementById('modal-delete').onclick = async () => {
    if (confirm('確定要刪除這個習慣嗎？')) {
      await db.deleteHabit(habit.id);
      modalManager.close();
      if (onDone) onDone();
    }
  };
  document.getElementById('modal-cancel').onclick = () => modalManager.close();
  document.getElementById('modal-save').onclick = async () => {
    const title = document.getElementById('modal-input-title').value.trim();
    const activation = document.getElementById('modal-activation').value.trim();
    const repeatType = document.getElementById('modal-repeat-type').value;
    
    if (!title || !activation) return;
    
    let repeatDays = [];
    if (repeatType === 'daily' || repeatType === 'weekly') {
      repeatDays = [0, 1, 2, 3, 4, 5, 6];
    } else {
      document.querySelectorAll('.day-toggle.active').forEach(el => {
        repeatDays.push(parseInt(el.dataset.day));
      });
    }
    
    habit.title = title;
    habit.activationAction = activation;
    habit.repeatType = repeatType;
    habit.repeatDays = repeatDays;
    habit.active = activeState;
    
    await db.updateHabit(habit);
    modalManager.close();
    if (onDone) onDone();
  };
}

// ========================================
// Helpers
// ========================================

function setupRepeatTypeToggle() {
  const select = document.getElementById('modal-repeat-type');
  const daysGroup = document.getElementById('modal-days-group');
  if (!select || !daysGroup) return;
  
  select.addEventListener('change', () => {
    daysGroup.style.display = select.value === 'custom' ? 'block' : 'none';
  });
}

function setupDaysSelector() {
  document.querySelectorAll('.day-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.classList.toggle('active');
    });
  });
}

function getRepeatText(habit) {
  if (habit.repeatType === 'daily') return '每天';
  if (habit.repeatType === 'weekly') return '每週';
  if (habit.repeatType === 'custom' && habit.repeatDays) {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    return '每週' + habit.repeatDays.map(d => dayNames[d]).join('、');
  }
  return '自訂';
}

// ========================================
// FAB handler for Habits
// ========================================

export function getHabitsFabAction(subPageIndex) {
  if (subPageIndex === 1) {
    return () => openHabitAddModal(() => { renderHabitManage(); renderHabitStats(); });
  }
  return null; // No FAB for stats page
}

export function refreshHabits() {
  renderHabitStats();
  renderHabitManage();
}

export default { initHabits, getHabitsFabAction, refreshHabits };
