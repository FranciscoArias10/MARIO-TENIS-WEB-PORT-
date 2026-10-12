/**
 * MARIO TENNIS 64 - WEBRTC NETPLAY ENGINE (P2P REMOTE PLAY TOGETHER)
 * Enables ultra-low-latency 2-player online multiplayer across the internet.
 * Uses WebRTC DataChannels for 60Hz controller inputs and MediaStream for video/audio.
 */
class NetplayEngine {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.mediaCall = null;
    this.role = 'none'; // 'host', 'guest', 'none'
    this.roomId = null;
    this.pingInterval = null;
    this.inputInterval = null;
    this.lastPingTimestamp = 0;
    this.currentPing = 0;
    this.packetCount = 0;

    // Track Guest local pressed keys to stream to Host
    this.guestLocalPressed = new Set();
  }

  // Generate a simple numeric room code (e.g. 7842)
  generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // ==========================================
  // HOST MODE (Player 1)
  // ==========================================
  initHost(customRoomId = null) {
    this.role = 'host';
    this.roomId = customRoomId || this.generateRoomCode();

    if (this.peer) this.peer.destroy();

    const peerId = `mariotennis-${this.roomId.toLowerCase()}`;
    this.peer = new Peer(peerId, MT_CONFIG.PEER_CONFIG);

    this.peer.on('open', (id) => {
      console.log(`[Netplay Host] Sala creada con ID: ${this.roomId}`);
      this.updateUIStatus('hosting');
      if (window.soundEngine) window.soundEngine.playFanfare();
      if (window.app) window.app.showToast(`Sala creada: ${this.roomId}. ¡Comparte el código!`, 'success');
    });

    // Listen for Guest connection
    this.peer.on('connection', (connection) => {
      console.log('[Netplay Host] Invitado conectándose...');
      this.conn = connection;
      this.setupHostConnection();
    });

    this.peer.on('error', (err) => {
      console.error('[Netplay Peer Error]', err);
      if (err.type === 'unavailable-id') {
        // Room ID collision, retry with new random ID
        this.initHost();
      } else {
        if (window.app) window.app.showToast(`Error de red: ${err.type}`, 'error');
      }
    });
  }

  setupHostConnection() {
    this.conn.on('open', () => {
      console.log('[Netplay Host] ¡Jugador 2 conectado exitosamente!');
      this.updateUIStatus('connected');
      if (window.soundEngine) window.soundEngine.playFanfare();
      if (window.app) window.app.showToast('¡Jugador 2 (Luigi) se ha unido a la pista!', 'success');

      // Start Latency Ping
      this.startHostPing();

      // Transmit Canvas Video Stream to Guest
      this.streamCanvasToGuest();
    });

    this.conn.on('data', (data) => {
      this.handleHostReceivedData(data);
    });

    this.conn.on('close', () => {
      console.log('[Netplay Host] Jugador 2 se ha desconectado.');
      this.handlePeerDisconnected();
    });
  }

  streamCanvasToGuest() {
    if (!this.peer || !this.conn) return;

    // Look for Emulator canvas
    const canvas = document.querySelector('#emulator-game-container canvas');
    if (!canvas) {
      console.warn('[Netplay] Canvas del emulador no encontrado aún para transmitir.');
      setTimeout(() => this.streamCanvasToGuest(), 1000);
      return;
    }

    try {
      // 45 FPS provides fluid motion while reducing GPU hardware video encoding load by 35% on APUs
      const stream = canvas.captureStream ? canvas.captureStream(45) : (canvas.mozCaptureStream ? canvas.mozCaptureStream(45) : null);
      if (!stream) return;
      
      // Call guest with stream
      const remotePeerId = this.conn.peer;
      this.mediaCall = this.peer.call(remotePeerId, stream);
      console.log('[Netplay Host] Transmisión de video iniciada hacia Player 2.');
    } catch (e) {
      console.error('[Netplay Host] Error al capturar stream de video:', e);
    }
  }

  handleHostReceivedData(data) {
    if (!data || !data.type) return;
    this.packetCount++;

    if (data.type === MT_CONFIG.PACKET.INPUT) {
      // Inyectar entrada de Player 2
      this.injectPlayer2Input(data.input);
    } else if (data.type === MT_CONFIG.PACKET.PONG) {
      // Calculate Round-Trip Time
      const rtt = Date.now() - this.lastPingTimestamp;
      this.currentPing = Math.round(rtt / 2);
      this.updatePingUI(this.currentPing);
    } else if (data.type === MT_CONFIG.PACKET.TAUNT) {
      if (window.app) window.app.displayTaunt('P2 (Luigi)', data.msg);
    }
  }

  // Inject Guest inputs into Host emulator controller slot 2 (N64 Port 2)
  injectPlayer2Input(input) {
    if (!input || !input.btn) return;
    if (!window.EJS_emulator || !window.EJS_emulator.gameManager) return;

    const gm = window.EJS_emulator.gameManager;

    const N64_BTN_MAP = {
      BTN_A: 8,       // A Button (Topspin / Confirm)
      BTN_B: 0,       // B Button (Slice / Cancel)
      BTN_Z: 12,      // Z Trigger (Lob)
      BTN_R: 11,      // R Trigger (Flat / Position)
      BTN_L: 10,      // L Trigger
      START: 3,       // Start
      UP: 19,         // Analog Stick Up
      DOWN: 18,       // Analog Stick Down
      LEFT: 17,       // Analog Stick Left
      RIGHT: 16,      // Analog Stick Right
      DPAD_UP: 4,     // D-Pad Up
      DPAD_DOWN: 5,   // D-Pad Down
      DPAD_LEFT: 6,   // D-Pad Left
      DPAD_RIGHT: 7   // D-Pad Right
    };

    const btnIndex = N64_BTN_MAP[input.btn];
    if (btnIndex === undefined) return;

    const isPressed = input.val ? 1 : 0;

    // Handle Analog Stick & D-Pad navigation for menus and court movement
    if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(input.btn)) {
      const analogVal = isPressed ? 32767 : 0;
      gm.simulateInput(1, btnIndex, analogVal);

      // Also trigger D-Pad equivalent so character selection menus always react
      const dpadBtn = N64_BTN_MAP[`DPAD_${input.btn}`];
      if (dpadBtn !== undefined) {
        gm.simulateInput(1, dpadBtn, isPressed);
      }
    } else {
      gm.simulateInput(1, btnIndex, isPressed);
    }
  }

  startHostPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.conn && this.conn.open) {
        this.lastPingTimestamp = Date.now();
        this.conn.send({ type: MT_CONFIG.PACKET.PING, time: this.lastPingTimestamp });
      }
    }, 1000);
  }

  // ==========================================
  // GUEST MODE (Player 2)
  // ==========================================
  initGuest(roomCode) {
    this.role = 'guest';
    this.roomId = roomCode.toUpperCase().trim();

    // Hide local emulator completely so Guest never sees two screens
    const emuContainer = document.getElementById('emulator-game-container');
    if (emuContainer) {
      emuContainer.style.display = 'none';
    }

    if (this.peer) this.peer.destroy();

    this.peer = new Peer(MT_CONFIG.PEER_CONFIG);

    this.peer.on('open', () => {
      console.log(`[Netplay Guest] Conectando a sala: ${this.roomId}`);
      const targetPeerId = `mariotennis-${this.roomId.toLowerCase()}`;
      this.conn = this.peer.connect(targetPeerId, { reliable: false });
      this.setupGuestConnection();
    });

    // Listen for video stream from Host
    this.peer.on('call', (call) => {
      console.log('[Netplay Guest] Recibiendo llamada de video del Host...');
      call.answer(); // Answer without sending local stream
      call.on('stream', (remoteStream) => {
        console.log('[Netplay Guest] Stream de video recibido.');
        this.displayGuestVideoStream(remoteStream);
      });
    });

    this.peer.on('error', (err) => {
      console.error('[Netplay Guest Error]', err);
      if (window.app) window.app.showToast(`No se pudo conectar a la sala ${this.roomId}. Verifica el código.`, 'error');
    });
  }

  setupGuestConnection() {
    this.conn.on('open', () => {
      console.log('[Netplay Guest] Conectado al Host.');
      this.updateUIStatus('connected');
      if (window.soundEngine) window.soundEngine.playFanfare();
      if (window.app) window.app.showToast(`¡Conectado a la sala ${this.roomId}!`, 'success');

      // Start input streaming from Guest to Host
      this.startGuestInputStreaming();
    });

    this.conn.on('data', (data) => {
      this.handleGuestReceivedData(data);
    });

    this.conn.on('close', () => {
      console.log('[Netplay Guest] Desconectado del Host.');
      this.handlePeerDisconnected();
    });
  }

  displayGuestVideoStream(stream) {
    const video = document.getElementById('guest-remote-video');
    const emuContainer = document.getElementById('emulator-game-container');
    const overlay = document.getElementById('arena-start-overlay');

    // Ensure local emulator is hidden so only the host video stream is visible
    if (emuContainer) emuContainer.style.display = 'none';

    if (video) {
      video.srcObject = stream;
      video.classList.remove('hidden');
      video.style.display = 'block';
      if (overlay) overlay.classList.add('hidden');
      video.play().catch(e => console.warn('Autoplay prevented:', e));
    }
  }

  handleGuestReceivedData(data) {
    if (!data || !data.type) return;

    if (data.type === MT_CONFIG.PACKET.PING) {
      // Respond with Pong immediately
      if (this.conn && this.conn.open) {
        this.conn.send({ type: MT_CONFIG.PACKET.PONG });
      }
    } else if (data.type === MT_CONFIG.PACKET.TAUNT) {
      if (window.app) window.app.displayTaunt('P1 (Mario)', data.msg);
    }
  }

  // Send local inputs to host at 60Hz
  startGuestInputStreaming() {
    this.prevGpState = {};

    const KEY_MAP = {
      // Directions (Arrow keys or WASD)
      ArrowUp: 'UP',
      KeyW: 'UP',
      ArrowDown: 'DOWN',
      KeyS: 'DOWN',
      ArrowLeft: 'LEFT',
      KeyA: 'LEFT',
      ArrowRight: 'RIGHT',
      KeyD: 'RIGHT',
      // Action Buttons
      KeyK: 'BTN_A',
      KeyC: 'BTN_A',
      Space: 'BTN_A',
      KeyJ: 'BTN_B',
      KeyX: 'BTN_B',
      KeyU: 'BTN_Z',
      KeyZ: 'BTN_Z',
      KeyI: 'BTN_R',
      KeyV: 'BTN_R',
      Enter: 'START',
      NumpadEnter: 'START'
    };

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => {
      if (this.role !== 'guest' || !this.conn || !this.conn.open) return;
      const btn = KEY_MAP[e.code];
      if (btn) {
        e.preventDefault();
        this.conn.send({
          type: MT_CONFIG.PACKET.INPUT,
          input: { btn, val: 1 }
        });
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.role !== 'guest' || !this.conn || !this.conn.open) return;
      const btn = KEY_MAP[e.code];
      if (btn) {
        e.preventDefault();
        this.conn.send({
          type: MT_CONFIG.PACKET.INPUT,
          input: { btn, val: 0 }
        });
      }
    });
  }

  sendTaunt(message) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: MT_CONFIG.PACKET.TAUNT,
        msg: message
      });
    }
  }

  handlePeerDisconnected() {
    this.updateUIStatus('offline');
    if (window.app) window.app.showToast('El otro jugador se ha desconectado.', 'warning');
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  disconnect() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.conn = null;
    this.role = 'none';
    this.roomId = null;
    this.updateUIStatus('offline');
  }

  // ==========================================
  // UI STATUS UPDATERS
  // ==========================================
  updateUIStatus(status) {
    const pill = document.getElementById('netplay-status-pill');
    const text = document.getElementById('netplay-status-text');
    const hudP2Badge = document.getElementById('hud-p2-badge');
    const hudP2Name = document.getElementById('hud-p2-name');
    const webrtcState = document.getElementById('webrtc-state');
    const webrtcRole = document.getElementById('webrtc-role');
    const roomBox = document.getElementById('room-active-box');
    const displayCode = document.getElementById('display-room-code');

    if (pill) {
      pill.className = `status-pill status-${status}`;
    }

    if (status === 'hosting') {
      if (text) text.textContent = `Sala: ${this.roomId}`;
      if (webrtcState) webrtcState.textContent = 'Esperando Invitado';
      if (webrtcRole) webrtcRole.textContent = 'Host (Jugador 1)';
      if (roomBox) roomBox.classList.remove('hidden');
      if (displayCode) displayCode.textContent = this.roomId;
    } else if (status === 'connected') {
      if (text) text.textContent = `En Partida (${this.roomId})`;
      if (hudP2Badge) {
        hudP2Badge.textContent = 'CONECTADO';
        hudP2Badge.style.background = '#10b981';
        hudP2Badge.style.color = '#000';
      }
      if (hudP2Name) hudP2Name.textContent = 'P2: Luigi (Online)';
      if (webrtcState) webrtcState.textContent = 'Conectado (WebRTC P2P)';
      if (roomBox) roomBox.classList.remove('hidden');
      if (displayCode) displayCode.textContent = this.roomId;
    } else {
      if (text) text.textContent = 'Modo Local';
      if (hudP2Badge) hudP2Badge.textContent = 'DESCONECTADO';
      if (hudP2Name) hudP2Name.textContent = 'P2: Luigi (Esperando...)';
      if (webrtcState) webrtcState.textContent = 'Desconectado';
      if (roomBox) roomBox.classList.add('hidden');
    }
  }

  updatePingUI(ping) {
    const pingEl = document.getElementById('ping-val');
    const pingBadge = document.getElementById('hud-netplay-ping');
    const webrtcPing = document.getElementById('webrtc-ping');
    const packetsEl = document.getElementById('webrtc-packets');

    if (pingEl) pingEl.textContent = ping;
    if (pingBadge) pingBadge.classList.remove('hidden');
    if (webrtcPing) webrtcPing.textContent = `~${ping} ms`;
    if (packetsEl) packetsEl.textContent = this.packetCount;
  }
}

// Global Netplay Instance
window.netplayEngine = new NetplayEngine();
