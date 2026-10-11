# 🎾 Mario Tennis 64 - Web Port & Online Netplay

[![Nintendo 64](https://img.shields.io/badge/Platform-Nintendo_64-e11d48.svg)](https://github.com/FranciscoArias10/MARIO-TENIS-WEB-PORT-)
[![WebAssembly](https://img.shields.io/badge/Engine-WebAssembly_(WASM)-6366f1.svg)](https://webassembly.org/)
[![WebRTC](https://img.shields.io/badge/Netplay-WebRTC_P2P-10b981.svg)](https://webrtc.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Port para navegadores web de **Mario Tennis (Nintendo 64)** con soporte nativo de **Multijugador Online (Netplay) en tiempo real para 2 jugadores**.

---

## 💡 ¿Cómo funciona la arquitectura técnica?

### 1. ¿Existe un port nativo en C (descompilación completa)?
A diferencia de *Super Mario 64* o *The Legend of Zelda: Ocarina of Time*, **Mario Tennis de N64 no cuenta actualmente con una descompilación completa de código en C** (el proyecto comunitario `MarioTennisN64` es todavía un trabajo en progreso experimental).

### 2. La Solución Oficial y Funcional en la Web:
Este proyecto implementa la solución más robusta y moderna de la industria para ejecutar el juego y permitir juego online:
- **Núcleo de Emulación WebAssembly (WASM)**: Ejecuta el juego a 60 FPS fluidos directamente en el cliente mediante el núcleo optimizado de **Mupen64Plus-Next**.
- **Netplay P2P en Tiempo Real (WebRTC Remote Play)**:
  - **Jugador 1 (Host)**: Ejecuta la instancia del juego en su navegador y transmite el stream de video del canvas a 60 FPS y el audio del juego mediante WebRTC.
  - **Jugador 2 (Invitado/Guest)**: Se conecta directamente mediante código de sala o enlace compartido. Recibe la transmisión con latencia ultra-baja (<30-50ms) y envía sus pulsaciones de mando/teclado a través de un `RTCDataChannel` binario de alta velocidad hacia el **Puerto 2 del mando** del Host.
  - **Resultado**: Cero desincronizaciones de emulador, sincronización visual perfecta y ambos jugadores compitiendo en la misma cancha de tenis.

---

## 🚀 Inicio Rápido

### Opción A: Ejecutar Localmente con Node.js
```bash
# 1. Clonar el repositorio
git clone https://github.com/FranciscoArias10/MARIO-TENIS-WEB-PORT-.git
cd MARIO-TENIS-WEB-PORT-

# 2. Iniciar el servidor local (incluye cabeceras COOP/COEP para WebAssembly)
npm start

# 3. Abrir en el navegador
# http://localhost:3000
```

### Opción B: Despliegue Estático
Puedes subir este repositorio directamente a **GitHub Pages**, **Vercel**, **Netlify** o **Cloudflare Pages**. Al no requerir bases de datos ni backend complejo, funciona 100% en el navegador gracias a la red PeerJS y servidores STUN gratuitos de Google y Cloudflare.

---

## 🎮 Controles

### Teclado Estándar

| Acción N64 | Efecto en Mario Tennis | Jugador 1 (Host) | Jugador 2 (Invitado) | Mando USB / Bluetooth |
| :--- | :--- | :---: | :---: | :---: |
| **Botón A** | Topspin (Golpe rápido / Rebote alto) | <kbd>C</kbd> | <kbd>K</kbd> | <kbd>A</kbd> / <kbd>✕</kbd> |
| **Botón B** | Slice (Golpe cortado / Rebote bajo) | <kbd>X</kbd> | <kbd>J</kbd> | <kbd>X</kbd> / <kbd>▢</kbd> |
| **Botón Z** | Globo defensivo (Lob) / Cancelar | <kbd>Z</kbd> | <kbd>U</kbd> | <kbd>LT</kbd> / <kbd>L2</kbd> |
| **Botón R** | Tiro plano potente / Posicionamiento | <kbd>V</kbd> | <kbd>I</kbd> | <kbd>RB</kbd> / <kbd>R1</kbd> |
| **Stick Analógico** | Moverse y apuntar dirección del golpe | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | **Stick Izquierdo** |
| **Start** | Pausar partida / Menú | <kbd>Enter</kbd> | <kbd>Numpad Enter</kbd> | <kbd>Start</kbd> |

### Mandos Físicos Compatibles
Compatible con la **Gamepad API** de HTML5:
- Mandos de **Xbox 360 / One / Series X|S**
- Mandos de **PlayStation DualShock 4 / DualSense PS5**
- Mandos de **Nintendo Switch Pro Controller** y Joy-Cons
- Mandos genéricos USB / Bluetooth

### Pantallas Táctiles / Móvil
Incluye mando virtual en pantalla con stick analógico flotante y botones de acción rápidos (A, B, Z, R).

---

## 🎾 Guía de Golpes de Mario Tennis

Dominar las combinaciones de botones es la clave para ganar en la cancha:

1. **Topspin (Efecto hacia adelante)**: Presiona <kbd>A</kbd> dos veces seguidas mientras cargas. Bote alto y pelota veloz.
2. **Slice (Efecto cortado)**: Presiona <kbd>B</kbd> dos veces seguidas mientras cargas. La pelota vuela bajo y bota poco, ideal para sacar al rival de ritmo.
3. **Golpe Plano (Flat Shot)**: Presiona <kbd>A</kbd> + <kbd>B</kbd> simultáneamente. Es el golpe más veloz del juego.
4. **Globo (Lob)**: Presiona <kbd>A</kbd> y luego rápidamente <kbd>B</kbd>. Pasa la pelota por encima de un rival que sube a la red.
5. **Dejada (Drop Shot)**: Presiona <kbd>B</kbd> y luego rápidamente <kbd>A</kbd>. La bola cae muerta apenas pasando la red.
6. **Smash (Remate imparable)**: Cuando el rival devuelva un tiro flotante, colócate sobre la estrella parpadeante en la pista y presiona <kbd>A</kbd>.

---

## 🌐 Cómo Jugar Multijugador Online (Paso a Paso)

1. **El Host (Jugador 1)**:
   - Abre la web y arrastra su archivo ROM de *Mario Tennis* (`.z64` o `.n64`).
   - Hace clic en **"Crear Sala Online (Host P1)"**.
   - Se generará un código de sala único (ej. `MT-7842`) y un botón para **Copiar Enlace Directo**.
2. **El Invitado (Jugador 2)**:
   - Abre el enlace directo o introduce el código en la pestaña **Online**.
   - ¡Listo! En segundos ambos estarán conectados en la misma pista con indicador de ping y chat rápido.

---

## ⚖️ Aviso Legal
Este proyecto es una plataforma de software de preservación y emulación con fines educativos. Nintendo, Nintendo 64 y Mario Tennis son marcas registradas de Nintendo Co., Ltd. Este repositorio no distribuye archivos ROM propietarios protegidos por derechos de autor. Cada usuario debe proporcionar su propia copia legítima del juego.
