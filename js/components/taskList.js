// ========================================
// Task List Component
// ========================================

import { uiIcon } from '../utils/icons.js';

/**
 * Render a task list
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Array} options.tasks - task items (top-level only)
 * @param {Object} options.subtasksMap - { parentId: [subtasks] }
 * @param {boolean} options.hideCompleted - hide completed tasks
 * @param {Function} options.onCheck - callback(taskId, checked)
 * @param {Function} options.onClick - callback(task)
 * @param {Function} options.onSubCheck - callback(subtaskId, checked)
 */
export function renderTaskList(container, options = {}) {
  const {
    tasks = [],
    subtasksMap = {},
    hideCompleted = true,
    onCheck,
    onClick,
    onSubCheck,
  } = options;
  
  const visibleTasks = hideCompleted ? tasks.filter(t => !t.completed) : tasks;
  
  if (visibleTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <p>目前沒有任務</p>
      </div>
    `;
    return;
  }
  
  let html = '<div class="task-list stagger-in">';
  
  visibleTasks.forEach((task) => {
    const subtasks = subtasksMap[task.id] || [];
    const hasSubtasks = subtasks.length > 0;
    const categoryTag = task.category === 'habit'
      ? `<span class="tag tag-habit">習慣</span>`
      : `<span class="tag tag-progress">進度</span>`;
    
    const deadlineHtml = task.deadline
      ? `<span class="task-item-deadline">${uiIcon('clock', 12)} ${formatDeadline(task.deadline)}</span>`
      : '';
    
    html += `
      <div class="task-item" data-id="${task.id}">
        ${hasSubtasks ? `
          <button class="task-expand-btn" data-action="expand" data-id="${task.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ` : '<div style="width: 8px;"></div>'}
        <div class="task-item-info" data-action="edit" data-id="${task.id}">
          <div class="task-item-top">
            ${categoryTag}
            <span class="task-item-title">${task.title}</span>
          </div>
          <div class="task-item-meta">
            ${deadlineHtml}
          </div>
        </div>
        <div class="checkbox ${task.completed ? 'checked' : ''}" data-action="check" data-id="${task.id}">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
    `;
    
    // Subtasks container (hidden by default)
    if (hasSubtasks) {
      html += `<div class="task-subtasks" data-parent="${task.id}" style="display: none;">`;
      subtasks.forEach((sub) => {
        if (hideCompleted && sub.completed) return;
        html += `
          <div class="task-subtask" data-id="${sub.id}">
            <div class="task-item-info">
              <span class="task-item-title">${sub.title}</span>
            </div>
            <div class="checkbox ${sub.completed ? 'checked' : ''}" data-action="subcheck" data-id="${sub.id}">
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
  
  // Bind events
  container.querySelectorAll('[data-action="check"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      const isChecked = el.classList.contains('checked');
      el.classList.toggle('checked');
      el.classList.add('just-checked');
      setTimeout(() => el.classList.remove('just-checked'), 400);
      
      if (!isChecked && hideCompleted) {
        const taskItem = el.closest('.task-item');
        if (taskItem) {
          taskItem.classList.add('completed');
          setTimeout(() => {
            taskItem.style.display = 'none';
            const subtasksEl = container.querySelector(`[data-parent="${id}"]`);
            if (subtasksEl) subtasksEl.style.display = 'none';
          }, 400);
        }
      }
      
      if (onCheck) onCheck(id, !isChecked);
    });
  });
  
  container.querySelectorAll('[data-action="subcheck"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      const isChecked = el.classList.contains('checked');
      el.classList.toggle('checked');
      el.classList.add('just-checked');
      setTimeout(() => el.classList.remove('just-checked'), 400);
      if (onSubCheck) onSubCheck(id, !isChecked);
    });
  });
  
  container.querySelectorAll('[data-action="expand"]').forEach((el) => {
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
  
  container.querySelectorAll('[data-action="edit"]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const task = tasks.find(t => t.id === id);
      if (task && onClick) onClick(task);
    });
  });
}

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d} 前`;
}

export default renderTaskList;
