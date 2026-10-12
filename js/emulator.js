/**
 * MARIO TENNIS 64 - WEBASSEMBLY EMULATOR & SERVER ROM AUTO-LOADER
 * Automatically loads Mario Tennis from server / IndexedDB cache and boots WebAssembly at 60 FPS.
 * Zero-ROM setup: End users never have to provide, upload or select a ROM.
 */
class MarioTennisEmulator {
  constructor() {
    this.romBlob = null;
    this.romUrl = null;
    this.isRunning = false;
    this.core = MT_CONFIG.CORE_OPTIONS.DEFAULT;
    this.dbName = 'MarioTennisCache';
    this.storeName = 'rom_store';

    // Start auto-boot sequence
    this.initDatabase();
  }

  // ==========================================
  // LOADING STATUS & PROGRESS UI
  // ==========================================
  updateLoadingStatus(message, percent = null) {
    const textEl = document.getElementById('loading-status-text');
    const barEl = document.getElementById('loading-progress-bar');
    const percentEl = document.getElementById('loading-progress-percent');

    if (textEl && message) {
      textEl.textContent = message;
    }

    if (percent !== null) {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)));
      if (barEl) barEl.style.width = `${clamped}%`;
      if (percentEl) percentEl.textContent = `${clamped}%`;
    }
  }

  // ==========================================
  // INDEXEDDB ROM CACHE
  // ==========================================
  initDatabase() {
    // If arriving as an invited guest to join a Netplay room, do not boot local emulator
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('role') === 'guest') {
      this.updateLoadingStatus('Modo Invitado (P2): Esperando stream del Host...', 100);
      return;
    }

    this.updateLoadingStatus('Comprobando datos del juego en memoria...', 15);

    const request = indexedDB.open(this.dbName, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(this.storeName)) {
        db.createObjectStore(this.storeName);
      }
    };
    request.onsuccess = (e) => {
      this.db = e.target.result;
      this.checkCachedRom();
    };
    request.onerror = (e) => {
      console.warn('[DB Error] No se pudo inicializar IndexedDB:', e);
      this.checkLocalServerRom();
    };
  }

  saveRomToCache(blob, filename) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ blob, filename, timestamp: Date.now() }, 'cached_rom');
    } catch (e) {
      console.warn('[DB Error] No se pudo guardar en caché:', e);
    }
  }

  checkCachedRom() {
    if (!this.db) {
      this.checkLocalServerRom();
      return;
    }

    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const req = store.get('cached_rom');

    req.onsuccess = () => {
      // Validate that cached blob is substantial (> 1MB)
      if (req.result && req.result.blob && req.result.blob.size > 1000000) {
        console.log('[Emulator] ROM encontrada en IndexedDB local. Iniciando de inmediato...');
        this.romBlob = req.result.blob;
        this.updateLoadingStatus('Iniciando juego desde almacenamiento local...', 100);
        setTimeout(() => this.startEmulator(), 200);
      } else {
        this.checkLocalServerRom();
      }
    };

    req.onerror = () => {
      this.checkLocalServerRom();
    };
  }

  async checkLocalServerRom() {
    try {
      this.updateLoadingStatus('Conectando con el servidor...', 25);

      const candidates = ['/roms/mario-tennis.z64', '/roms/Mario Tennis (USA).z64'];
      let targetPath = null;

      for (const romPath of candidates) {
        try {
          const headCheck = await fetch(romPath, { method: 'HEAD' });
          if (headCheck.ok) {
            targetPath = romPath;
            break;
          }
        } catch (_) {}
      }

      if (!targetPath) {
        targetPath = '/roms/mario-tennis.z64';
      }

      const response = await fetch(targetPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 16777216;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        const percent = Math.min(95, Math.round((loaded / total) * 70) + 25);
        const mb = (loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (total / (1024 * 1024)).toFixed(1);
        this.updateLoadingStatus(`Descargando juego desde el servidor (${mb} / ${totalMb} MB)...`, percent);
      }

      this.updateLoadingStatus('Iniciando emulador WebAssembly a 60 FPS...', 100);
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const filename = targetPath.split('/').pop();
      this.romBlob = blob;
      this.saveRomToCache(blob, filename);

      setTimeout(() => {
        this.startEmulator();
      }, 300);

    } catch (e) {
      console.error('[Emulator] Error cargando ROM del servidor:', e);
      this.updateLoadingStatus('Reintentando conexión con el servidor...', 20);
      setTimeout(() => this.checkLocalServerRom(), 2500);
    }
  }

  clearCachedRom() {
    if (!this.db) return;
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    store.delete('cached_rom');
    if (window.app) window.app.showToast('Caché eliminada. Se recargará del servidor.', 'info');
    setTimeout(() => window.location.reload(), 800);
  }

  // ==========================================
  // LAUNCH WEBASSEMBLY N64 EMULATOR
  // ==========================================
  startEmulator() {
    if (!this.romBlob) {
      console.warn('Esperando datos de la ROM...');
      this.checkLocalServerRom();
      return;
    }

    if (this.isRunning) {
      return;
    }

    // Hide Overlay immediately so user sees game container
    const overlay = document.getElementById('arena-start-overlay');
    if (overlay) overlay.classList.add('hidden');

    // Completely clear localStorage and sessionStorage to purge any corrupted controls
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}

    this.romUrl = URL.createObjectURL(this.romBlob);
    this.isRunning = true;

    // Configure EmulatorJS Global Variables
    window.EJS_player = '#emulator-game-container';
    window.EJS_core = 'n64';
    window.EJS_gameName = MT_CONFIG.GAME_TITLE;
    window.EJS_gameUrl = this.romUrl;
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_startOnLoaded = true;
    window.EJS_disableLocalStorage = true;
    window.EJS_threads = true; // Multi-threaded WebAssembly via SharedArrayBuffer & Web Workers

    // Load EmulatorJS Script
    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    script.async = true;
    script.onload = () => {
      console.log('[EmulatorJS] Loader cargado con éxito.');
      this.setupCanvasMonitor();
    };
    script.onerror = (err) => {
      console.error('[EmulatorJS] Error al cargar script del emulador:', err);
      if (window.app) window.app.showToast('Error cargando el motor WebAssembly. Revisa tu conexión.', 'error');
    };

    document.body.appendChild(script);

    if (window.soundEngine) window.soundEngine.playFanfare();
    if (window.app) window.app.showToast('¡Mario Tennis iniciado a 60 FPS!', 'success');
  }

  // Monitor when canvas is created inside container to attach WebRTC streamer
  setupCanvasMonitor() {
    const checkCanvas = setInterval(() => {
      const container = document.getElementById('emulator-game-container');
      const canvas = container ? container.querySelector('canvas') : null;
      if (canvas) {
        clearInterval(checkCanvas);
        console.log('[Emulator] Canvas 3D detectado para WebRTC streaming.');
        if (window.netplayEngine && window.netplayEngine.role === 'host') {
          window.netplayEngine.streamCanvasToGuest();
        }
      }
    }, 500);
  }

  restart() {
    if (confirm('¿Deseas reiniciar la partida actual?')) {
      window.location.reload();
    }
  }
}

// Global Emulator Instance
window.marioEmulator = new MarioTennisEmulator();
