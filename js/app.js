/**
 * MARIO TENNIS 64 - MAIN APPLICATION COORDINATOR
 * Connects UI events, Netplay, Emulation, Audio, Gamepads and Roster guides.
 */
class MarioTennisApp {
  constructor() {
    this.initTabs();
    this.initButtons();
    this.initTaunts();
    this.initRoster();
    this.initURLParams();
    this.initFullscreen();
    this.initGamepadModal();
    this.initAudioToggle();
    this.initCRTToggle();
  }

  // ==========================================
  // TAB NAVIGATION
  // ==========================================
  initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');

        if (window.soundEngine) window.soundEngine.playBeep(520, 'sine', 0.05);
      });
    });
  }

  // ==========================================
  // BUTTONS & ACTIONS
  // ==========================================
  initButtons() {
    // Quick Actions on Arena Overlay
    const btnQuickHost = document.getElementById('btn-quick-host');
    const btnQuickJoin = document.getElementById('btn-quick-join');
    const btnQuickLocal = document.getElementById('btn-quick-local');

    if (btnQuickHost) {
      btnQuickHost.addEventListener('click', () => {
        this.switchTab('tab-netplay');
        this.createHostRoom();
        if (window.marioEmulator) window.marioEmulator.startEmulator();
      });
    }

    if (btnQuickJoin) {
      btnQuickJoin.addEventListener('click', () => {
        this.switchTab('tab-netplay');
        const input = document.getElementById('input-room-code');
        if (input) input.focus();
      });
    }

    if (btnQuickLocal) {
      btnQuickLocal.addEventListener('click', () => {
        if (window.marioEmulator) window.marioEmulator.startEmulator();
      });
    }

    // Netplay Tab Buttons
    const btnCreateRoom = document.getElementById('btn-create-room');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const btnLeaveRoom = document.getElementById('btn-leave-room');
    const btnCopyCode = document.getElementById('btn-copy-code');
    const btnCopyInviteLink = document.getElementById('btn-copy-invite-link');

    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        this.createHostRoom();
        if (window.marioEmulator) window.marioEmulator.startEmulator();
      });
    }

    if (btnJoinRoom) {
      btnJoinRoom.addEventListener('click', () => {
        const input = document.getElementById('input-room-code');
        const code = input ? input.value.trim() : '';
        if (!code) {
          this.showToast('Por favor, ingresa el código de la sala.', 'warning');
          return;
        }
        if (window.netplayEngine) {
          window.netplayEngine.initGuest(code);
        }
      });
    }

    if (btnLeaveRoom) {
      btnLeaveRoom.addEventListener('click', () => {
        if (window.netplayEngine) {
          window.netplayEngine.disconnect();
          this.showToast('Te has desconectado de la sala.', 'info');
        }
      });
    }

    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const code = window.netplayEngine ? window.netplayEngine.roomId : '';
        if (code) {
          navigator.clipboard.writeText(code);
          this.showToast(`Código ${code} copiado al portapapeles.`, 'success');
          if (window.soundEngine) window.soundEngine.playBeep(800, 'sine', 0.08);
        }
      });
    }

    if (btnCopyInviteLink) {
      btnCopyInviteLink.addEventListener('click', () => {
        const code = window.netplayEngine ? window.netplayEngine.roomId : '';
        if (code) {
          const url = `${window.location.origin}${window.location.pathname}?room=${code}&role=guest`;
          navigator.clipboard.writeText(url);
          this.showToast('¡Enlace de invitación copiado! Envíalo a tu amigo.', 'success');
          if (window.soundEngine) window.soundEngine.playBeep(800, 'sine', 0.08);
        }
      });
    }

    // Bottom Arena Bar
    const btnToggleTouch = document.getElementById('btn-toggle-touch');
    const btnRestartGame = document.getElementById('btn-restart-game');

    if (btnToggleTouch) {
      btnToggleTouch.addEventListener('click', () => {
        if (window.virtualController) window.virtualController.toggle();
      });
    }

    if (btnRestartGame) {
      btnRestartGame.addEventListener('click', () => {
        if (window.marioEmulator) window.marioEmulator.restart();
      });
    }

    // Clear Save Data
    const btnClearSave = document.getElementById('btn-clear-save');
    if (btnClearSave) {
      btnClearSave.addEventListener('click', () => {
        if (window.marioEmulator) window.marioEmulator.clearCachedRom();
      });
    }
  }

  createHostRoom() {
    if (window.netplayEngine) {
      window.netplayEngine.initHost();
    }
  }

  switchTab(tabId) {
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.click();
  }

  // ==========================================
  // QUICK TAUNTS
  // ==========================================
  initTaunts() {
    const tauntBtns = document.querySelectorAll('.btn-taunt');
    tauntBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.getAttribute('data-taunt');
        if (window.netplayEngine) {
          window.netplayEngine.sendTaunt(msg);
          const myRole = window.netplayEngine.role === 'host' ? 'Tú (P1)' : 'Tú (P2)';
          this.displayTaunt(myRole, msg);
          if (window.soundEngine) window.soundEngine.playBounce();
        }
      });
    });
  }

  displayTaunt(sender, message) {
    const feed = document.getElementById('taunts-chat-feed');
    if (!feed) return;

    const el = document.createElement('div');
    el.className = 'taunt-message';
    el.innerHTML = `<strong>${sender}:</strong> ${message}`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;

    if (window.soundEngine) window.soundEngine.playBeep(700, 'triangle', 0.1);
  }

  // ==========================================
  // ROSTER & TENNIS GUIDE GENERATOR
  // ==========================================
  initRoster() {
    const container = document.getElementById('roster-grid');
    if (!container || !MT_CONFIG.ROSTER) return;

    container.innerHTML = MT_CONFIG.ROSTER.map(char => `
      <div class="roster-card">
        <div class="char-avatar" style="background: rgba(255,255,255,0.06);">${char.emoji}</div>
        <div class="char-info">
          <span class="char-name">${char.name}</span>
          <span class="char-type ${char.typeClass}">${char.type}</span>
          <p style="font-size: 0.7rem; color: var(--text-dim); margin-top: 2px;">${char.desc}</p>
        </div>
      </div>
    `).join('');
  }

  // ==========================================
  // URL PARAMETERS (AUTO-JOIN INVITE LINKS)
  // ==========================================
  initURLParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role');

    if (roomParam && roleParam === 'guest') {
      this.switchTab('tab-netplay');
      const input = document.getElementById('input-room-code');
      if (input) input.value = roomParam;
      this.showToast(`Uniendo automáticamente a la sala ${roomParam}...`, 'info');
      setTimeout(() => {
        if (window.netplayEngine) window.netplayEngine.initGuest(roomParam);
      }, 1000);
    }
  }

  // ==========================================
  // FULLSCREEN & EFFECTS
  // ==========================================
  initFullscreen() {
    const btn = document.getElementById('btn-fullscreen');
    const arena = document.getElementById('arena-frame');

    if (btn && arena) {
      btn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          arena.requestFullscreen().catch(err => {
            console.warn('Error al solicitar pantalla completa:', err);
          });
        } else {
          document.exitFullscreen();
        }
      });
    }
  }

  initAudioToggle() {
    const btn = document.getElementById('btn-toggle-audio');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (window.soundEngine) {
        const enabled = window.soundEngine.toggle();
        btn.innerHTML = `<span class="btn-icon">${enabled ? '🔊' : '🔇'}</span>`;
        this.showToast(`Sonidos UI: ${enabled ? 'Activados' : 'Silenciados'}`, 'info');
      }
    });
  }

  initCRTToggle() {
    const btn = document.getElementById('btn-toggle-crt');
    const overlay = document.getElementById('crt-overlay');
    if (!btn || !overlay) return;

    btn.addEventListener('click', () => {
      overlay.classList.toggle('hidden');
      const active = !overlay.classList.contains('hidden');
      this.showToast(`Filtro CRT retro: ${active ? 'Activado' : 'Desactivado'}`, 'info');
    });
  }

  // ==========================================
  // GAMEPAD TESTER MODAL
  // ==========================================
  initGamepadModal() {
    const btnOpen = document.getElementById('btn-test-gamepad');
    const modal = document.getElementById('gamepad-test-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const slotsWrap = document.getElementById('gp-test-slots');

    if (!btnOpen || !modal || !btnClose) return;

    btnOpen.addEventListener('click', () => {
      modal.classList.remove('hidden');
      this.renderGamepadTesterSlots();
    });

    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  renderGamepadTesterSlots() {
    const container = document.getElementById('gp-test-slots');
    if (!container) return;

    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    let html = '';

    for (let i = 0; i < 4; i++) {
      const pad = rawPads[i];
      if (pad) {
        html += `
          <div class="gp-test-slot" style="margin-bottom: 1rem; padding: 0.8rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
            <div style="font-weight: 700; color: var(--tennis-neon);">Mando #${i + 1}: ${pad.id}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Botones detectados: ${pad.buttons.length} | Ejes analógicos: ${pad.axes.length}</div>
          </div>
        `;
      }
    }

    if (!html) {
      html = `<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No se detectó ningún mando físico USB/Bluetooth conectado. Conecta un mando y presiona cualquier botón.</div>`;
    }

    container.innerHTML = html;
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new MarioTennisApp();
});
