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

  // Generate a friendly room code (e.g., MT-8492)
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MT-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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
      const stream = canvas.captureStream ? canvas.captureStream(60) : canvas.mozCaptureStream(60);
      
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

  // Inject Guest inputs into Host emulator controller slot 2
  injectPlayer2Input(input) {
    if (!input) return;
    const p2Keys = MT_CONFIG.DEFAULT_CONTROLS[1];
    if (!p2Keys) return;

    const simulate = (code, pressed) => {
      window.dispatchEvent(new KeyboardEvent(pressed ? 'keydown' : 'keyup', { code, bubbles: true }));
    };

    if (input.key && input.action) {
      simulate(input.key, input.action === 'down');
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
    const overlay = document.getElementById('arena-start-overlay');
    if (video) {
      video.srcObject = stream;
      video.classList.remove('hidden');
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
    // Listen to local keyboard
    window.addEventListener('keydown', (e) => {
      if (this.role !== 'guest' || !this.conn || !this.conn.open) return;
      this.conn.send({
        type: MT_CONFIG.PACKET.INPUT,
        input: { key: e.code, action: 'down' }
      });
    });

    window.addEventListener('keyup', (e) => {
      if (this.role !== 'guest' || !this.conn || !this.conn.open) return;
      this.conn.send({
        type: MT_CONFIG.PACKET.INPUT,
        input: { key: e.code, action: 'up' }
      });
    });

    // Listen to local gamepad if connected
    if (window.gamepadManager) {
      window.gamepadManager.onInput((slot, state) => {
        if (this.role !== 'guest' || !this.conn || !this.conn.open) return;
        // Stream gamepad state
        this.conn.send({
          type: MT_CONFIG.PACKET.INPUT,
          input: { gamepad: state }
        });
      });
    }
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
