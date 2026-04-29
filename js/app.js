// ========================================
// TimeQuest — Main App Entry
// ========================================

import { SwipeHandler } from './swipe.js';
import { initHome, getHomeFabAction, refreshHome } from './pages/home.js';
import { initSchedule, getScheduleFabAction, getTemplateModeToggle, refreshSchedule } from './pages/schedule.js';
import { initHabits, getHabitsFabAction, refreshHabits } from './pages/habits.js';
import { uiIcon } from './utils/icons.js';
import db from './db.js';

// ========================================
// State
// ========================================

let currentPage = 'home';
let swipeHandlers = {};
let currentSubPageIndex = { home: 0, schedule: 0, habits: 0 };

// ========================================
// Init
// ========================================

async function init() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.log('SW registration failed:', e);
    }
  }
  
  // Initialize pages
  await initHome();
  await initSchedule();
  await initHabits();
  
  // Setup swipe handlers
  setupSwipeHandlers();
  
  // Setup tab bar
  setupTabBar();
  
  // Setup FAB
  setupFab();
  
  // Setup schedule mode toggle button
  setupScheduleToggle();
  
  console.log('TimeQuest initialized');
}

// ========================================
// Swipe Handlers
// ========================================

function setupSwipeHandlers() {
  const pages = ['home', 'schedule', 'habits'];
  
  pages.forEach((page) => {
    const container = document.getElementById(`${page}-swipe`);
    if (!container) return;
    
    swipeHandlers[page] = new SwipeHandler(container, {
      onSwipe: (index) => {
        currentSubPageIndex[page] = index;
        updateFab();
        updateScheduleToggle();
      },
    });
  });
}

// ========================================
// Tab Bar
// ========================================

function setupTabBar() {
  const tabs = document.querySelectorAll('.tab-item');
  
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.tab;
      if (page === currentPage) return;
      
      switchPage(page);
    });
  });
}

function switchPage(page) {
  // Update tabs
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${page}"]`).classList.add('active');
  
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  
  currentPage = page;
  
  // Refresh the page content
  if (page === 'home') refreshHome();
  else if (page === 'schedule') refreshSchedule();
  else if (page === 'habits') refreshHabits();
  
  updateFab();
  updateScheduleToggle();
}

// ========================================
// FAB
// ========================================

const fabBtn = document.getElementById('fab-btn');
let currentFabAction = null;

function setupFab() {
  fabBtn.addEventListener('click', () => {
    if (currentFabAction) currentFabAction();
  });
  updateFab();
}

function updateFab() {
  const subIdx = currentSubPageIndex[currentPage];
  
  let action = null;
  if (currentPage === 'home') {
    action = getHomeFabAction(subIdx);
  } else if (currentPage === 'schedule') {
    action = getScheduleFabAction(subIdx);
  } else if (currentPage === 'habits') {
    action = getHabitsFabAction(subIdx);
  }
  
  currentFabAction = action;
  
  if (action) {
    fabBtn.classList.remove('hidden');
  } else {
    fabBtn.classList.add('hidden');
  }
}

// ========================================
// Schedule Mode Toggle (Template/Schedule)
// ========================================

let scheduleToggleEl = null;

function setupScheduleToggle() {
  // Create toggle button element
  scheduleToggleEl = document.createElement('button');
  scheduleToggleEl.className = 'fab-mini';
  scheduleToggleEl.id = 'schedule-mode-toggle';
  scheduleToggleEl.innerHTML = uiIcon('template', 16);
  scheduleToggleEl.style.position = 'fixed';
  scheduleToggleEl.style.bottom = `calc(var(--tab-bar-height) + var(--safe-area-bottom) + 24px)`;
  scheduleToggleEl.style.right = '80px';
  scheduleToggleEl.style.zIndex = 'var(--z-fab)';
  scheduleToggleEl.style.display = 'none';
  
  document.getElementById('app').appendChild(scheduleToggleEl);
  
  scheduleToggleEl.addEventListener('click', () => {
    const toggle = getTemplateModeToggle();
    toggle.toggle();
    updateScheduleToggle();
    updateFab();
  });
  
  updateScheduleToggle();
}

function updateScheduleToggle() {
  if (!scheduleToggleEl) return;
  
  const show = currentPage === 'schedule' && currentSubPageIndex.schedule === 0;
  scheduleToggleEl.style.display = show ? 'flex' : 'none';
  
  if (show) {
    const toggle = getTemplateModeToggle();
    scheduleToggleEl.innerHTML = toggle.isTemplateMode
      ? uiIcon('calendar', 16)
      : uiIcon('template', 16);
    scheduleToggleEl.title = toggle.isTemplateMode ? '切換到排程' : '切換到模板';
  }
}

// ========================================
// Data Export / Import
// ========================================

async function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    schedules: [],
    tasks: [],
    habits: [],
    habitLogs: [],
    templates: [],
  };
  
  // We need to read all stores - use raw IndexedDB
  const dbInstance = await getDBInstance();
  
  for (const storeName of ['schedules', 'tasks', 'habits', 'habitLogs', 'templates']) {
    const tx = dbInstance.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    data[storeName] = await idbGetAll(store);
  }
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `timequest_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.schedules) {
        alert('無效的備份檔案');
        return;
      }
      
      const dbInstance = await getDBInstance();
      
      for (const storeName of ['schedules', 'tasks', 'habits', 'habitLogs', 'templates']) {
        if (!data[storeName]) continue;
        const tx = dbInstance.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        for (const item of data[storeName]) {
          store.put(item);
        }
        
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
      }
      
      alert('匯入成功！');
      
      // Refresh all pages
      refreshHome();
      refreshSchedule();
      refreshHabits();
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
  };
  
  input.click();
}

function getDBInstance() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TimeQuestDB');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Expose to global for easy access
window.TimeQuest = {
  exportData,
  importData,
};

// Also add a long-press on the tab bar to access settings
let longPressTimer = null;
document.getElementById('tab-bar').addEventListener('touchstart', (e) => {
  longPressTimer = setTimeout(() => {
    showDataMenu();
  }, 1000);
}, { passive: true });

document.getElementById('tab-bar').addEventListener('touchend', () => {
  clearTimeout(longPressTimer);
}, { passive: true });

document.getElementById('tab-bar').addEventListener('touchmove', () => {
  clearTimeout(longPressTimer);
}, { passive: true });

function showDataMenu() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  
  titleEl.textContent = '資料管理';
  bodyEl.innerHTML = `
    <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
      長按標籤列可開啟此選單。資料僅儲存在此裝置上，請定期備份。
    </p>
  `;
  footerEl.innerHTML = `
    <button class="btn btn-secondary" id="data-export">${uiIcon('inbox', 14)} 匯出 JSON</button>
    <button class="btn btn-primary" id="data-import">${uiIcon('inbox', 14)} 匯入 JSON</button>
  `;
  
  overlay.classList.add('active');
  
  document.getElementById('data-export').onclick = () => {
    overlay.classList.remove('active');
    exportData();
  };
  document.getElementById('data-import').onclick = () => {
    overlay.classList.remove('active');
    importData();
  };
}

// ========================================
// Start
// ========================================

document.addEventListener('DOMContentLoaded', init);
