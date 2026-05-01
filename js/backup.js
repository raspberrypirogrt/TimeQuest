import db from './db.js';

/**
 * 匯出所有 IndexedDB 資料為 JSON 字串
 * @returns {Promise<string>}
 */
export async function exportData() {
  const data = {};
  
  // 使用 db.js 中定義的 store 名稱
  // STORES = { templates, schedules, tasks, habits, habitLogs }
  const stores = ['templates', 'schedules', 'tasks', 'habits', 'habitLogs'];
  
  for (const storeName of stores) {
    // 透過原生的 IndexedDB API 直接取得所有資料，或者實作一個 getAll 輔助函式
    // 這裡我們為了確保能抓到全部，先借助 db 內部的機制
    const items = await _getAllFromStore(storeName);
    data[storeName] = items;
  }
  
  // 加入匯出時間與版本號
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    data: data
  };
  
  return JSON.stringify(backup, null, 2);
}

/**
 * 從 JSON 字串匯入並覆寫所有資料
 * @param {string} jsonString 
 * @returns {Promise<void>}
 */
export async function importData(jsonString) {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.data) {
      throw new Error('無效的備份檔案格式');
    }
    
    const stores = ['templates', 'schedules', 'tasks', 'habits', 'habitLogs'];
    
    for (const storeName of stores) {
      if (backup.data[storeName]) {
        await _clearAndPutStore(storeName, backup.data[storeName]);
      }
    }
  } catch (err) {
    console.error('Import failed:', err);
    throw new Error('匯入失敗：' + err.message);
  }
}

// ------------------------------------------------------------------
// Internal helper functions to interact directly with IndexedDB
// since db.js might not expose generic clear/getAll for all stores.
// ------------------------------------------------------------------

function _getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TimeQuestDB');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function _getAllFromStore(storeName) {
  const database = await _getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function _clearAndPutStore(storeName, items) {
  const database = await _getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    // 清空現有資料
    const clearReq = store.clear();
    
    clearReq.onsuccess = () => {
      // 依序寫入新資料
      let i = 0;
      function putNext() {
        if (i < items.length) {
          store.put(items[i]).onsuccess = putNext;
          i++;
        } else {
          resolve();
        }
      }
      putNext();
    };
    
    clearReq.onerror = () => reject(clearReq.error);
    tx.onerror = () => reject(tx.error);
  });
}
