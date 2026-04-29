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
    this.maxWidth = container.offsetWidth;
    
    this._bindEvents();
  }
  
  _bindEvents() {
    this.container.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
    this.container.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.container.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: true });
    
    // Update max width on resize
    window.addEventListener('resize', () => {
      this.maxWidth = this.container.offsetWidth;
      this._updatePosition(false);
    });
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
    const offset = -(this.currentIndex * this.maxWidth);
    this.track.style.transform = `translateX(${offset}px)`;
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
