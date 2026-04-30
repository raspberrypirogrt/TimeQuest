// ========================================
// Swipe Handler — Touch gesture for sub-pages
// ========================================

export class SwipeHandler {
  constructor(container, options = {}) {
    this.container = container;
    this.track = container.querySelector('.swipe-track');
    this.indicators = container.closest('.page').querySelectorAll('.indicator-dot');
    this.currentIndex = 0;
    this.totalPages = this.track.children.length;
    this.onSwipe = options.onSwipe || (() => {});
    
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.isDragging = false;
    this.isHorizontal = null;
    
    this.threshold = 50;
    this.maxWidth = window.innerWidth;
    
    this._bindEvents();
  }
  
  _bindEvents() {
    this.container.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
    this.container.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.container.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: true });

    // Mouse drag support for desktop
    this.container.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));

    // Indicator dot click to navigate
    this.indicators.forEach((dot, i) => {
      dot.addEventListener('click', () => this.goTo(i));
      dot.style.cursor = 'pointer';
    });

    // Update max width on resize
    window.addEventListener('resize', () => {
      this.maxWidth = window.innerWidth;
      this._updatePosition(false);
    });
  }

  _onMouseDown(e) {
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentX = 0;
    this.isDragging = true;
    this.isHorizontal = null;
    this.track.classList.add('swiping');
    e.preventDefault();
  }

  _onMouseMove(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (this.isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      this.isHorizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (!this.isHorizontal) {
      this.isDragging = false;
      this.track.classList.remove('swiping');
      return;
    }

    this.currentX = dx;
    if ((this.currentIndex === 0 && dx > 0) ||
        (this.currentIndex === this.totalPages - 1 && dx < 0)) {
      this.currentX = dx * 0.3;
    }

    const offset = -(this.currentIndex * this.maxWidth) + this.currentX;
    this.track.style.transform = `translateX(${offset}px)`;
  }

  _onMouseUp() {
    if (!this.isDragging) return;
    this._onTouchEnd();
  }
  
  _onTouchStart(e) {
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentX = 0;
    this.isDragging = true;
    this.isHorizontal = null;
    this.track.classList.add('swiping');
  }
  
  _onTouchMove(e) {
    if (!this.isDragging) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    
    // Determine direction on first significant move
    if (this.isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      this.isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    
    if (!this.isHorizontal) {
      this.isDragging = false;
      this.track.classList.remove('swiping');
      return;
    }
    
    e.preventDefault();
    
    // Add resistance at edges
    this.currentX = dx;
    if ((this.currentIndex === 0 && dx > 0) || 
        (this.currentIndex === this.totalPages - 1 && dx < 0)) {
      this.currentX = dx * 0.3;
    }
    
    const offset = -(this.currentIndex * this.maxWidth) + this.currentX;
    this.track.style.transform = `translateX(${offset}px)`;
  }
  
  _onTouchEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.track.classList.remove('swiping');
    
    if (Math.abs(this.currentX) > this.threshold) {
      if (this.currentX > 0 && this.currentIndex > 0) {
        this.currentIndex--;
      } else if (this.currentX < 0 && this.currentIndex < this.totalPages - 1) {
        this.currentIndex++;
      }
    }
    
    this._updatePosition(true);
    this._updateIndicators();
    this.onSwipe(this.currentIndex);
  }
  
  _updatePosition(animate) {
    if (animate) {
      this.track.classList.remove('swiping');
    }
    // Use strictly 100vw to ensure perfect centering, independent of JS container width calculations
    const offset = -(this.currentIndex * 100);
    this.track.style.transform = `translateX(${offset}vw)`;
  }
  
  _updateIndicators() {
    this.indicators.forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentIndex);
    });
  }
  
  goTo(index) {
    if (index >= 0 && index < this.totalPages) {
      this.currentIndex = index;
      this._updatePosition(true);
      this._updateIndicators();
      this.onSwipe(this.currentIndex);
    }
  }
  
  getCurrentIndex() {
    return this.currentIndex;
  }
}

export default SwipeHandler;
