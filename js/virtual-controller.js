/**
 * MARIO TENNIS 64 - VIRTUAL TOUCH CONTROLLER
 * Provides floating analog stick & responsive touch buttons for mobile / tablet screens.
 */
class VirtualTouchController {
  constructor() {
    this.container = document.getElementById('touch-controls');
    this.stickZone = document.getElementById('touch-stick-zone');
    this.stickThumb = document.getElementById('touch-stick-thumb');

    this.active = false;
    this.touchId = null;
    this.stickCenter = { x: 0, y: 0 };
    this.maxRadius = 45; // pixels

    this.prevDirection = { up: false, down: false, left: false, right: false };

    this.initJoystick();
    this.initButtons();
  }

  toggle() {
    if (!this.container) return;
    this.container.classList.toggle('hidden');
    return !this.container.classList.contains('hidden');
  }

  show() {
    if (this.container) this.container.classList.remove('hidden');
  }

  hide() {
    if (this.container) this.container.classList.add('hidden');
  }

  initJoystick() {
    if (!this.stickZone || !this.stickThumb) return;

    const onTouchStart = (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.touchId = touch.identifier;
      const rect = this.stickZone.getBoundingClientRect();
      this.stickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this.handleTouchMove(touch);
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.handleTouchMove(e.changedTouches[i]);
          break;
        }
      }
    };

    const onTouchEnd = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.resetStick();
          break;
        }
      }
    };

    this.stickZone.addEventListener('touchstart', onTouchStart, { passive: false });
    this.stickZone.addEventListener('touchmove', onTouchMove, { passive: false });
    this.stickZone.addEventListener('touchend', onTouchEnd, { passive: false });
    this.stickZone.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  handleTouchMove(touch) {
    const dx = touch.clientX - this.stickCenter.x;
    const dy = touch.clientY - this.stickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    this.stickThumb.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

    // Normalized vector (-1 to 1)
    const normX = clampedX / this.maxRadius;
    const normY = clampedY / this.maxRadius;

    this.updateDirections(normX, normY);
  }

  updateDirections(normX, normY) {
    const threshold = 0.35;
    const up = normY < -threshold;
    const down = normY > threshold;
    const left = normX < -threshold;
    const right = normX > threshold;

    const p1Keys = MT_CONFIG.DEFAULT_CONTROLS[0];

    const dispatchKey = (code, pressed, wasPressed) => {
      if (pressed && !wasPressed) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      } else if (!pressed && wasPressed) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      }
    };

    dispatchKey(p1Keys.STICK_UP, up, this.prevDirection.up);
    dispatchKey(p1Keys.STICK_DOWN, down, this.prevDirection.down);
    dispatchKey(p1Keys.STICK_LEFT, left, this.prevDirection.left);
    dispatchKey(p1Keys.STICK_RIGHT, right, this.prevDirection.right);

    this.prevDirection = { up, down, left, right };
  }

  resetStick() {
    this.touchId = null;
    this.stickThumb.style.transform = 'translate(0px, 0px)';
    this.updateDirections(0, 0);
  }

  initButtons() {
    const buttons = document.querySelectorAll('.touch-btn');
    buttons.forEach((btn) => {
      const keyCode = btn.getAttribute('data-key');
      if (!keyCode) return;

      const press = (e) => {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode, bubbles: true }));
        if (window.soundEngine) window.soundEngine.playRacketHit(btn.id === 'touch-btn-a');
      };

      const release = (e) => {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode, bubbles: true }));
      };

      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
    });
  }
}

// Global Virtual Controller Instance
window.virtualController = new VirtualTouchController();
