/**
 * MARIO TENNIS 64 - WEB PORT CONFIGURATION
 */
const MT_CONFIG = {
  // Game & System Identifiers
  GAME_TITLE: "Mario Tennis (N64)",
  SYSTEM_CORE: "n64",
  CORE_OPTIONS: {
    DEFAULT: "mupen64plus_next",
    FALLBACK: "parallel-n64"
  },
  
  // WebRTC ICE Servers for NAT Traversal
  ICE_SERVERS: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" }
  ],

  // PeerJS Free Signaling Cloud Options
  PEER_CONFIG: {
    debug: 1,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" }
      ]
    }
  },

  // Input Mapping (Default Keyboard Bindings)
  DEFAULT_CONTROLS: {
    // Player 1
    0: {
      STICK_UP: "KeyW",
      STICK_DOWN: "KeyS",
      STICK_LEFT: "KeyA",
      STICK_RIGHT: "KeyD",
      BTN_A: "KeyC",      // Topspin
      BTN_B: "KeyX",      // Slice
      BTN_Z: "KeyZ",      // Lob / Cancel
      BTN_R: "KeyV",      // Right Trigger
      BTN_L: "KeyQ",      // Left Trigger
      BTN_START: "Enter",
      C_UP: "KeyI",
      C_DOWN: "KeyK",
      C_LEFT: "KeyJ",
      C_RIGHT: "KeyL"
    },
    // Player 2 (Local / Fallback)
    1: {
      STICK_UP: "ArrowUp",
      STICK_DOWN: "ArrowDown",
      STICK_LEFT: "ArrowLeft",
      STICK_RIGHT: "ArrowRight",
      BTN_A: "KeyK",
      BTN_B: "KeyJ",
      BTN_Z: "KeyU",
      BTN_R: "KeyI",
      BTN_L: "KeyO",
      BTN_START: "NumpadEnter",
      C_UP: "Numpad8",
      C_DOWN: "Numpad2",
      C_LEFT: "Numpad4",
      C_RIGHT: "Numpad6"
    }
  },

  // Character Roster & Specs
  ROSTER: [
    { id: "mario", name: "Mario", type: "Equilibrado (All-Around)", typeClass: "type-allround", emoji: "🔴", desc: "Velocidad y fuerza balanceada. Ideal para principiantes." },
    { id: "luigi", name: "Luigi", type: "Equilibrado (All-Around)", typeClass: "type-allround", emoji: "🟢", desc: "Gran control de colocación y tiros angulados." },
    { id: "peach", name: "Peach", type: "Técnica (Technique)", typeClass: "type-technique", emoji: "👑", desc: "Golpes extremadamente precisos a las líneas de cal." },
    { id: "daisy", name: "Daisy", type: "Técnica (Technique)", typeClass: "type-technique", emoji: "🌼", desc: "Excelente efecto cortado y voleas rápidas en la red." },
    { id: "yoshi", name: "Yoshi", type: "Velocidad (Speed)", typeClass: "type-speed", emoji: "🦖", desc: "Cubre toda la pista a gran velocidad. Difícil de pasar." },
    { id: "babymario", name: "Baby Mario", type: "Velocidad (Speed)", typeClass: "type-speed", emoji: "👶", desc: "Ágil con reflejos inmediatos en tiros difíciles." },
    { id: "bowser", name: "Bowser", type: "Potencia (Power)", typeClass: "type-power", emoji: "🐢", desc: "Saques devastadores a más de 180 km/h y smashes brutales." },
    { id: "dk", name: "Donkey Kong", type: "Potencia (Power)", typeClass: "type-power", emoji: "🦍", desc: "Alcance gigante de brazos y topspin pesado." },
    { id: "wario", name: "Wario", type: "Potencia (Power)", typeClass: "type-power", emoji: "🟡", desc: "Gran potencia con efectos curvados engañosos." },
    { id: "waluigi", name: "Waluigi", type: "Defensa (Defense)", typeClass: "type-defense", emoji: "🟣", desc: "Extremidades largas, devuelve prácticamente cualquier pelota." }
  ],

  // Court Types & Physical Properties in Mario Tennis
  COURTS: [
    { id: "hard", name: "Cancha Dura (Hard Court)", speed: "Rápida", bounce: "Alto", desc: "Bote uniforme, velocidad moderadamente rápida." },
    { id: "clay", name: "Tierra Batida (Clay Court)", speed: "Lenta", bounce: "Bajo", desc: "Pista lenta que favorece intercambios largos." },
    { id: "grass", name: "Hierba (Grass Court)", speed: "Muy Rápida", bounce: "Bajo", desc: "Bote bajo y deslizante. Premia el saque y volea." },
    { id: "composition", name: "Moqueta (Composition)", speed: "Rápida", bounce: "Medio", desc: "Pista equilibrada con bote predecible." },
    { id: "bowser", name: "Cancha de Bowser", speed: "Inestable", bounce: "Variable", desc: "La pista se inclina hacia el jugador que recibe daño." }
  ],

  // Netplay Message Protocol
  PACKET: {
    INPUT: "INPUT",
    PING: "PING",
    PONG: "PONG",
    TAUNT: "TAUNT",
    SYNC: "SYNC"
  }
};
