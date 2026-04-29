// ========================================
// IndexedDB Database Layer
// ========================================

const DB_NAME = 'TimeQuestDB';
const DB_VERSION = 1;

const STORES = {
  schedules: 'schedules',
  tasks: 'tasks',
  habits: 'habits',
  habitLogs: 'habitLogs',
  templates: 'templates',
};

let dbInstance = null;

/**
 * Open and initialize the database
 */
function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      // Schedules store
      if (!db.objectStoreNames.contains(STORES.schedules)) {
        const store = db.createObjectStore(STORES.schedules, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      
      // Tasks store
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        const store = db.createObjectStore(STORES.tasks, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('parentId', 'parentId', { unique: false });
        store.createIndex('habitId', 'habitId', { unique: false });
      }
      
      // Habits store
      if (!db.objectStoreNames.contains(STORES.habits)) {
        db.createObjectStore(STORES.habits, { keyPath: 'id' });
      }
      
      // Habit logs store
      if (!db.objectStoreNames.contains(STORES.habitLogs)) {
        const store = db.createObjectStore(STORES.habitLogs, { keyPath: 'id' });
        store.createIndex('habitId', 'habitId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('habitId_date', ['habitId', 'date'], { unique: true });
      }
      
      // Templates store
      if (!db.objectStoreNames.contains(STORES.templates)) {
        const store = db.createObjectStore(STORES.templates, { keyPath: 'id' });
        store.createIndex('dayOfWeek', 'dayOfWeek', { unique: false });
      }
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
  });
}

/**
 * Generic: get a transaction and store
 */
async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

/**
 * Generic: wrap IDBRequest in a promise
 */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ========================================
// CRUD Operations
// ========================================

export const db = {
  // ---- Schedules ----
  async getSchedulesByDate(date) {
    const store = await getStore(STORES.schedules);
    const index = store.index('date');
    const items = await promisify(index.getAll(date));
    return items.sort((a, b) => {
      const aMin = timeToMin(a.startTime);
      const bMin = timeToMin(b.startTime);
      return aMin - bMin;
    });
  },
  
  async addSchedule(schedule) {
    const store = await getStore(STORES.schedules, 'readwrite');
    return promisify(store.put(schedule));
  },
  
  async updateSchedule(schedule) {
    const store = await getStore(STORES.schedules, 'readwrite');
    return promisify(store.put(schedule));
  },
  
  async deleteSchedule(id) {
    const store = await getStore(STORES.schedules, 'readwrite');
    return promisify(store.delete(id));
  },
  
  // ---- Tasks ----
  async getTasksByDate(date) {
    const store = await getStore(STORES.tasks);
    const index = store.index('date');
    const items = await promisify(index.getAll(date));
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  
  async getUnscheduledTasks() {
    const store = await getStore(STORES.tasks);
    const all = await promisify(store.getAll());
    return all.filter(t => t.date === null && !t.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  
  async getSubtasks(parentId) {
    const store = await getStore(STORES.tasks);
    const index = store.index('parentId');
    const items = await promisify(index.getAll(parentId));
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  
  async addTask(task) {
    const store = await getStore(STORES.tasks, 'readwrite');
    return promisify(store.put(task));
  },
  
  async updateTask(task) {
    const store = await getStore(STORES.tasks, 'readwrite');
    return promisify(store.put(task));
  },
  
  async deleteTask(id) {
    const store = await getStore(STORES.tasks, 'readwrite');
    // Also delete subtasks
    const subtasks = await this.getSubtasks(id);
    for (const st of subtasks) {
      await this.deleteTask(st.id);
    }
    return promisify(store.delete(id));
  },
  
  // ---- Habits ----
  async getAllHabits() {
    const store = await getStore(STORES.habits);
    const items = await promisify(store.getAll());
    return items;
  },
  
  async getActiveHabits() {
    const all = await this.getAllHabits();
    return all.filter(h => h.active);
  },
  
  async addHabit(habit) {
    const store = await getStore(STORES.habits, 'readwrite');
    return promisify(store.put(habit));
  },
  
  async updateHabit(habit) {
    const store = await getStore(STORES.habits, 'readwrite');
    return promisify(store.put(habit));
  },
  
  async deleteHabit(id) {
    const store = await getStore(STORES.habits, 'readwrite');
    return promisify(store.delete(id));
  },
  
  // ---- Habit Logs ----
  async getHabitLog(habitId, date) {
    const store = await getStore(STORES.habitLogs);
    const index = store.index('habitId_date');
    return promisify(index.get([habitId, date]));
  },
  
  async getHabitLogsByHabit(habitId) {
    const store = await getStore(STORES.habitLogs);
    const index = store.index('habitId');
    return promisify(index.getAll(habitId));
  },
  
  async getHabitLogsByDate(date) {
    const store = await getStore(STORES.habitLogs);
    const index = store.index('date');
    return promisify(index.getAll(date));
  },
  
  async setHabitLog(log) {
    const store = await getStore(STORES.habitLogs, 'readwrite');
    return promisify(store.put(log));
  },
  
  // ---- Templates ----
  async getTemplatesByDay(dayOfWeek) {
    const store = await getStore(STORES.templates);
    const index = store.index('dayOfWeek');
    const items = await promisify(index.getAll(dayOfWeek));
    return items.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
  },
  
  async addTemplate(template) {
    const store = await getStore(STORES.templates, 'readwrite');
    return promisify(store.put(template));
  },
  
  async updateTemplate(template) {
    const store = await getStore(STORES.templates, 'readwrite');
    return promisify(store.put(template));
  },
  
  async deleteTemplate(id) {
    const store = await getStore(STORES.templates, 'readwrite');
    return promisify(store.delete(id));
  },
  
  async getAllTemplates() {
    const store = await getStore(STORES.templates);
    return promisify(store.getAll());
  },
};

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default db;
