// Create overlay element
const overlay = document.createElement('div');
overlay.id = 'cortex-timer-overlay';
document.body.appendChild(overlay);

// Styles
const style = document.createElement('style');
style.textContent = `
  #cortex-timer-overlay {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: 'Segoe UI', sans-serif;
    z-index: 999999;
    min-width: 100px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(5px);
    color: white;
  }
  #cortex-timer-overlay.study-mode {
    background-color: rgba(66, 153, 225, 0.9);
  }
  #cortex-timer-overlay.break-mode {
    background-color: rgba(56, 178, 172, 0.9);
  }
  #cortex-timer-overlay .time {
    font-size: 20px;
    font-weight: bold;
    font-family: monospace;
  }
  #cortex-timer-overlay .status {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.9;
  }
`;
document.head.appendChild(style);

// Update overlay
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TIMER_UPDATE") {
    updateOverlay(message.payload);
  }
});

function updateOverlay(timer) {
  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;
  
  overlay.innerHTML = `
    <div class="time">${minutes}:${seconds.toString().padStart(2, '0')}</div>
    <div class="status">${timer.isStudyTime ? 'FOCUS' : 'BREAK'}</div>
  `;
  
  overlay.className = timer.isStudyTime ? 'study-mode' : 'break-mode';
}

// Initial update
chrome.runtime.sendMessage({ action: "GET_STATE" }, (state) => {
  if (state?.timer) {
    updateOverlay(state.timer);
  }
});