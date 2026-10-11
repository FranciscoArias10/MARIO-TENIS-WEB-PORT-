/**
 * MARIO TENNIS 64 - WEBASSEMBLY EMULATOR & ROM LOADER
 * Powers the N64 emulation engine via EmulatorJS / Mupen64Plus-Next WASM.
 */
class MarioTennisEmulator {
  constructor() {
    this.romBlob = null;
    this.romUrl = null;
    this.isRunning = false;
    this.core = MT_CONFIG.CORE_OPTIONS.DEFAULT;
    this.dbName = 'MarioTennisCache';
    this.storeName = 'rom_store';
    
    this.initDatabase();
    this.initDropzone();
  }

  // ==========================================
  // INDEXEDDB ROM CACHE
  // ==========================================
  initDatabase() {
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
    };
  }

  saveRomToCache(blob, filename) {
    if (!this.db) return;
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    store.put({ blob, filename, timestamp: Date.now() }, 'cached_rom');
  }

  checkCachedRom() {
    if (!this.db) return;
    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const req = store.get('cached_rom');
    req.onsuccess = () => {
      if (req.result && req.result.blob) {
        this.romBlob = req.result.blob;
        this.onRomLoaded(req.result.filename || 'Mario Tennis (N64) Guardada', false);
      }
    };
  }

  clearCachedRom() {
    if (!this.db) return;
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    store.delete('cached_rom');
    if (window.app) window.app.showToast('Memoria caché de ROM eliminada.', 'info');
  }

  // ==========================================
  // ROM DROPZONE & FILE PICKER
  // ==========================================
  initDropzone() {
    const dropzone = document.getElementById('rom-dropzone');
    const fileInput = document.getElementById('rom-file-input');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });
  }

  handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['z64', 'n64', 'v64'].includes(ext)) {
      if (window.app) window.app.showToast('Formato no válido. Debe ser .z64 o .n64', 'error');
      return;
    }

    this.romBlob = file;
    this.saveRomToCache(file, file.name);
    this.onRomLoaded(file.name, true);
  }

  onRomLoaded(filename, autoStart = false) {
    const banner = document.getElementById('rom-status-banner');
    const text = document.getElementById('rom-status-text');
    if (banner && text) {
      banner.classList.remove('hidden');
      text.textContent = `ROM lista: ${filename}`;
    }
    if (window.soundEngine) window.soundEngine.playRacketHit(true);
    if (window.app) window.app.showToast(`ROM cargada: ${filename}`, 'success');

    if (autoStart) {
      this.startEmulator();
    }
  }

  // ==========================================
  // LAUNCH WEBASSEMBLY N64 EMULATOR
  // ==========================================
  startEmulator() {
    if (!this.romBlob) {
      // Prompt user to select ROM
      const fileInput = document.getElementById('rom-file-input');
      if (fileInput) fileInput.click();
      return;
    }

    if (this.isRunning) {
      console.warn('El emulador ya está en ejecución.');
      return;
    }

    // Hide Overlay
    const overlay = document.getElementById('arena-start-overlay');
    if (overlay) overlay.classList.add('hidden');

    this.romUrl = URL.createObjectURL(this.romBlob);
    this.isRunning = true;

    // Configure EmulatorJS Global Variables
    window.EJS_player = '#emulator-game-container';
    window.EJS_core = 'n64';
    window.EJS_gameName = MT_CONFIG.GAME_TITLE;
    window.EJS_gameUrl = this.romUrl;
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_startOnLoaded = true;

    // Default controller configuration
    window.EJS_defaultControls = {
      0: MT_CONFIG.DEFAULT_CONTROLS[0],
      1: MT_CONFIG.DEFAULT_CONTROLS[1]
    };

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
    if (window.app) window.app.showToast('Iniciando Mario Tennis en WebAssembly...', 'info');
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
