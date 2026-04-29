// ========================================
// Modal Component
// ========================================

const overlay = document.getElementById('modal-overlay');
const modal = document.getElementById('modal');
const titleEl = document.getElementById('modal-title');
const bodyEl = document.getElementById('modal-body');
const footerEl = document.getElementById('modal-footer');
const closeBtn = document.getElementById('modal-close');

let isOpen = false;

function open({ title, body, footer }) {
  titleEl.textContent = title || '';
  bodyEl.innerHTML = body || '';
  footerEl.innerHTML = footer || '';
  
  overlay.classList.add('active');
  isOpen = true;
  
  // Focus first input
  setTimeout(() => {
    const firstInput = bodyEl.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }, 300);
  
  return new Promise((resolve) => {
    modal._resolve = resolve;
  });
}

function close(result = null) {
  overlay.classList.remove('active');
  isOpen = false;
  if (modal._resolve) {
    modal._resolve(result);
    modal._resolve = null;
  }
}

// Close on overlay click
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) close();
});

// Close button
closeBtn.addEventListener('click', () => close());

export const modalManager = { open, close, isOpen: () => isOpen };
export default modalManager;
