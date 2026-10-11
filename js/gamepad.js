/**
 * MARIO TENNIS 64 - GAMEPAD API & CONTROLLER MANAGER
 * Detects physical controllers (Xbox, PS4/PS5, Switch Pro, USB) and maps
 * them to Mario Tennis N64 inputs for both Player 1 and Player 2.
 */
class GamepadManager {
  constructor() {
    this.gamepads = {};
    this.prevButtonStates = {};
    this.polling = false;
    this.deadzone = 0.22;
    this.listeners = [];

    // Controller slot assignments (index 0 = P1, index 1 = P2)
    this.slotAssignments = { 0: null, 1: null };

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[Gamepad] Conectado: ${e.gamepad.id} en índice ${e.gamepad.index}`);
      this.assignGamepad(e.gamepad);
      this.startPolling();
      if (window.soundEngine) window.soundEngine.playBeep(880, 'sine', 0.1);
      this.triggerChange();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[Gamepad] Desconectado: ${e.gamepad.id}`);
      this.unassignGamepad(e.gamepad.index);
      this.triggerChange();
    });
  }

  assignGamepad(gamepad) {
    if (this.slotAssignments[0] === null) {
      this.slotAssignments[0] = gamepad.index;
    } else if (this.slotAssignments[1] === null && this.slotAssignments[0] !== gamepad.index) {
      this.slotAssignments[1] = gamepad.index;
    }
  }

  unassignGamepad(index) {
    if (this.slotAssignments[0] === index) this.slotAssignments[0] = null;
    if (this.slotAssignments[1] === index) this.slotAssignments[1] = null;
  }

  startPolling() {
    if (this.polling) return;
    this.polling = true;
    const poll = () => {
      this.scanGamepads();
      if (this.polling) {
        requestAnimationFrame(poll);
      }
    };
    requestAnimationFrame(poll);
  }

  stopPolling() {
    this.polling = false;
  }

  scanGamepads() {
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < rawPads.length; i++) {
      const pad = rawPads[i];
      if (!pad) continue;

      const playerSlot = this.slotAssignments[0] === pad.index ? 0 : 
                         (this.slotAssignments[1] === pad.index ? 1 : -1);

      if (playerSlot !== -1) {
        const state = this.parseGamepadState(pad);
        this.processInput(playerSlot, state);
      }
    }
  }

  parseGamepadState(pad) {
    // Standard gamepad layout mapping to N64
    const b = pad.buttons;
    const a = pad.axes;

    const stickX = Math.abs(a[0] || 0) > this.deadzone ? a[0] : 0;
    const stickY = Math.abs(a[1] || 0) > this.deadzone ? a[1] : 0;

    return {
      id: pad.id,
      index: pad.index,
      stickX,
      stickY,
      // N64 inputs
      btnA: b[0] ? b[0].pressed : false, // Bottom button (A / Cross)
      btnB: b[2] ? b[2].pressed : (b[1] ? b[1].pressed : false), // Left or Right button (X / Square / Circle)
      btnZ: (b[6] && b[6].pressed) || (b[4] && b[4].pressed), // LT or LB
      btnR: (b[7] && b[7].pressed) || (b[5] && b[5].pressed), // RT or RB
      btnStart: b[9] ? b[9].pressed : false, // Start / Options
      dpadUp: b[12] ? b[12].pressed : false,
      dpadDown: b[13] ? b[13].pressed : false,
      dpadLeft: b[14] ? b[14].pressed : false,
      dpadRight: b[15] ? b[15].pressed : false
    };
  }

  processInput(slot, state) {
    const key = `p${slot}`;
    const prev = this.prevButtonStates[key] || {};

    const mapping = MT_CONFIG.DEFAULT_CONTROLS[slot];
    if (!mapping) return;

    // Helper to simulate keyboard events for EmulatorJS injection
    const simulateKey = (code, pressed, wasPressed) => {
      if (pressed && !wasPressed) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      } else if (!pressed && wasPressed) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      }
    };

    // Buttons
    simulateKey(mapping.BTN_A, state.btnA, prev.btnA);
    simulateKey(mapping.BTN_B, state.btnB, prev.btnB);
    simulateKey(mapping.BTN_Z, state.btnZ, prev.btnZ);
    simulateKey(mapping.BTN_R, state.btnR, prev.btnR);
    simulateKey(mapping.BTN_START, state.btnStart, prev.btnStart);

    // Directional (Analog Stick to digital D-pad / Arrow keys)
    const up = state.stickY < -0.4 || state.dpadUp;
    const down = state.stickY > 0.4 || state.dpadDown;
    const left = state.stickX < -0.4 || state.dpadLeft;
    const right = state.stickX > 0.4 || state.dpadRight;

    simulateKey(mapping.STICK_UP, up, prev.up);
    simulateKey(mapping.STICK_DOWN, down, prev.down);
    simulateKey(mapping.STICK_LEFT, left, prev.left);
    simulateKey(mapping.STICK_RIGHT, right, prev.right);

    // Cache previous state
    this.prevButtonStates[key] = {
      ...state,
      up, down, left, right
    };

    // Notify listeners (e.g. Netplay Guest streaming)
    for (const cb of this.listeners) {
      cb(slot, state);
    }
  }

  onInput(callback) {
    this.listeners.push(callback);
  }

  triggerChange() {
    const event = new CustomEvent('gamepadslotschanged', {
      detail: { slots: this.slotAssignments }
    });
    window.dispatchEvent(event);
  }

  getStatus(slot) {
    const padIndex = this.slotAssignments[slot];
    if (padIndex === null || padIndex === undefined) {
      return { connected: false, name: "Teclado / Virtual" };
    }
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = rawPads[padIndex];
    if (!pad) return { connected: false, name: "Teclado / Virtual" };
    return { connected: true, name: pad.id };
  }
}

// Global Gamepad Instance
window.gamepadManager = new GamepadManager();
