/**
 * MARIO TENNIS 64 - NATIVE GAMEPAD MANAGER (XBOX, PLAYSTATION, NINTENDO SWITCH, USB)
 * Directly hooks physical controllers into the WebAssembly N64 core via simulateInput.
 */
class GamepadManager {
  constructor() {
    this.gamepads = {};
    this.prevButtonStates = { 0: {}, 1: {} };
    this.deadzone = 0.22;
    this.polling = false;
    this.notifiedGamepads = new Set();

    // Controller slot assignments (slot 0 = Player 1, slot 1 = Player 2)
    this.slotAssignments = { 0: null, 1: null };

    // Start scanning immediately
    this.initEvents();
    this.startPolling();
  }

  initEvents() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[Gamepad] Conectado: ${e.gamepad.id} (slot ${e.gamepad.index})`);
      this.assignGamepad(e.gamepad);
      this.updateUILabels();
      this.notifyConnected(e.gamepad);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[Gamepad] Desconectado: ${e.gamepad.id}`);
      this.unassignGamepad(e.gamepad.index);
      this.updateUILabels();
      if (window.app) {
        window.app.showToast(`Mando desconectado (${e.gamepad.id.split('(')[0].trim()})`, 'warning');
      }
    });

    // Also scan on user interactions to detect already-connected gamepads
    ['click', 'keydown', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, () => this.scanExistingGamepads(), { passive: true });
    });
  }

  scanExistingGamepads() {
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < rawPads.length; i++) {
      const pad = rawPads[i];
      if (pad) {
        this.assignGamepad(pad);
        this.updateUILabels();
        this.notifyConnected(pad);
      }
    }
  }

  notifyConnected(pad) {
    if (this.notifiedGamepads.has(pad.id)) return;
    this.notifiedGamepads.add(pad.id);

    const cleanName = pad.id.includes('Xbox') ? 'Xbox Controller' : pad.id.split('(')[0].trim();
    const slot = this.slotAssignments[0] === pad.index ? 1 : (this.slotAssignments[1] === pad.index ? 2 : 1);

    if (window.app) {
      window.app.showToast(`🎮 ¡Mando ${cleanName} detectado para Jugador ${slot}!`, 'success');
    }
    if (window.soundEngine) {
      window.soundEngine.playFanfare();
    }
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
    this.notifiedGamepads.clear();
  }

  startPolling() {
    if (this.polling) return;
    this.polling = true;
    const pollLoop = () => {
      this.pollGamepads();
      if (this.polling) {
        requestAnimationFrame(pollLoop);
      }
    };
    requestAnimationFrame(pollLoop);
  }

  pollGamepads() {
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    // Auto-detect and assign any newly active gamepads
    for (let i = 0; i < rawPads.length; i++) {
      const pad = rawPads[i];
      if (pad && this.slotAssignments[0] === null) {
        this.assignGamepad(pad);
        this.updateUILabels();
        this.notifyConnected(pad);
      }
    }

    for (let slot = 0; slot < 2; slot++) {
      const padIndex = this.slotAssignments[slot];
      if (padIndex === null || padIndex === undefined) continue;
      const pad = rawPads[padIndex];
      if (!pad) continue;

      this.processGamepadInput(slot, pad);
    }
  }

  processGamepadInput(slot, pad) {
    const b = pad.buttons;
    const a = pad.axes;
    const prev = this.prevButtonStates[slot] || {};

    // Standard Gamepad (Xbox, PlayStation, etc.) to Mario Tennis N64 inputs
    const stickX = Math.abs(a[0] || 0) > this.deadzone ? a[0] : 0;
    const stickY = Math.abs(a[1] || 0) > this.deadzone ? a[1] : 0;

    const current = {
      BTN_A: (b[0] && b[0].pressed) ? 1 : 0,                                 // Xbox A
      BTN_B: ((b[1] && b[1].pressed) || (b[2] && b[2].pressed)) ? 1 : 0,    // Xbox B o X
      BTN_Z: ((b[6] && b[6].pressed) || (b[4] && b[4].pressed) || (b[3] && b[3].pressed)) ? 1 : 0, // LT, LB o Y
      BTN_R: ((b[7] && b[7].pressed) || (b[5] && b[5].pressed)) ? 1 : 0,    // RT o RB
      START: (b[9] && b[9].pressed) ? 1 : 0,                                 // Start / Menú
      UP: (stickY < -0.35 || (b[12] && b[12].pressed)) ? 1 : 0,
      DOWN: (stickY > 0.35 || (b[13] && b[13].pressed)) ? 1 : 0,
      LEFT: (stickX < -0.35 || (b[14] && b[14].pressed)) ? 1 : 0,
      RIGHT: (stickX > 0.35 || (b[15] && b[15].pressed)) ? 1 : 0
    };

    // If Guest in Netplay, send to Host via WebRTC
    const isGuest = window.netplayEngine && window.netplayEngine.role === 'guest';

    const sendInput = (btnName, value) => {
      if (isGuest) {
        if (window.netplayEngine.conn && window.netplayEngine.conn.open) {
          window.netplayEngine.conn.send({
            type: MT_CONFIG.PACKET.INPUT,
            input: { btn: btnName, val: value }
          });
        }
      } else {
        this.injectIntoEmulator(slot, btnName, value);
      }
    };

    // Check each button transition (press or release)
    for (const btn of ['BTN_A', 'BTN_B', 'BTN_Z', 'BTN_R', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT']) {
      if (current[btn] !== prev[btn]) {
        sendInput(btn, current[btn]);
      }
    }

    this.prevButtonStates[slot] = current;
  }

  injectIntoEmulator(playerSlot, btnName, value) {
    if (!window.EJS_emulator || !window.EJS_emulator.gameManager) return;
    const gm = window.EJS_emulator.gameManager;

    const N64_BTN_MAP = {
      BTN_A: 8,       // A Button
      BTN_B: 0,       // B Button
      BTN_Z: 12,      // Z Trigger
      BTN_R: 11,      // R Trigger
      START: 3,       // Start
      UP: 19,         // Stick Up
      DOWN: 18,       // Stick Down
      LEFT: 17,       // Stick Left
      RIGHT: 16,      // Stick Right
      DPAD_UP: 4,     // D-Pad Up
      DPAD_DOWN: 5,   // D-Pad Down
      DPAD_LEFT: 6,   // D-Pad Left
      DPAD_RIGHT: 7   // D-Pad Right
    };

    const btnIndex = N64_BTN_MAP[btnName];
    if (btnIndex === undefined) return;

    if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(btnName)) {
      const analogVal = value ? 32767 : 0;
      gm.simulateInput(playerSlot, btnIndex, analogVal);

      // Also trigger D-pad for crisp menu navigation
      const dpadBtn = N64_BTN_MAP[`DPAD_${btnName}`];
      if (dpadBtn !== undefined) {
        gm.simulateInput(playerSlot, dpadBtn, value);
      }
    } else {
      gm.simulateInput(playerSlot, btnIndex, value);
    }
  }

  // Trigger brief rumble on Xbox controller (dual-rumble)
  rumble(slot = 0, strong = 0.5, weak = 0.5, duration = 150) {
    const padIndex = this.slotAssignments[slot];
    if (padIndex === null || padIndex === undefined) return;
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = rawPads[padIndex];
    if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) {
      pad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: weak,
        strongMagnitude: strong
      }).catch(() => {});
    }
  }

  updateUILabels() {
    const p1Label = document.getElementById('p1-device-label');
    const p2Label = document.getElementById('p2-device-label');

    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];

    const gpP1Status = document.getElementById('gp-p1-status');
    const gpP1Name = document.getElementById('gp-p1-name');
    const gpP2Status = document.getElementById('gp-p2-status');
    const gpP2Name = document.getElementById('gp-p2-name');

    if (p1Label) {
      const p1Index = this.slotAssignments[0];
      const p1Pad = p1Index !== null ? rawPads[p1Index] : null;
      if (p1Pad) {
        const name = p1Pad.id.includes('Xbox') ? '🎮 Mando Xbox 360/One' : '🎮 Mando USB/BT';
        p1Label.innerHTML = `<span style="color: #10b981; font-weight: 700;">${name}</span>`;
        if (gpP1Status) gpP1Status.innerHTML = '<span style="color: #10b981; font-weight: 700;">● Mando Conectado</span>';
        if (gpP1Name) gpP1Name.textContent = p1Pad.id;
      } else {
        p1Label.textContent = 'Teclado / Gamepad';
        if (gpP1Status) gpP1Status.textContent = 'Teclado Activo';
        if (gpP1Name) gpP1Name.textContent = 'Teclado Estándar';
      }
    }

    if (p2Label) {
      const p2Index = this.slotAssignments[1];
      const p2Pad = p2Index !== null ? rawPads[p2Index] : null;
      if (p2Pad) {
        const name = p2Pad.id.includes('Xbox') ? '🎮 Mando Xbox 360/One' : '🎮 Mando USB/BT';
        p2Label.innerHTML = `<span style="color: #10b981; font-weight: 700;">${name}</span>`;
        if (gpP2Status) gpP2Status.innerHTML = '<span style="color: #10b981; font-weight: 700;">● Mando Conectado</span>';
        if (gpP2Name) gpP2Name.textContent = p2Pad.id;
      }
    }
  }

  onInput(callback) {
    // For backwards compatibility
  }
}

// Global Gamepad Instance
window.gamepadManager = new GamepadManager();
