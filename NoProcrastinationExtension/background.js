// Global state
let state = {
  isBlocking: true,
  allowedSites: [],
  timer: {
    isRunning: false,
    isStudyTime: true,
    timeLeft: 25 * 60,
    studyDuration: 25 * 60,
    breakDuration: 5 * 60,
    interval: null
  },
  presets: {
    school: ['google.com', 'youtube.com', 'wikipedia.org'],
    personal: ['facebook.com', 'twitter.com', 'reddit.com']
  },
  music: {
    enabled: false,
    volume: 0.5
  },
  motivation: {
    harshness: 'medium',
    interval: 60,
    selectedVoice: '',
    isEnabled: true
  }
};

// Blocked URLs cache
const blockedUrls = new Set();

// Load saved state
chrome.storage.sync.get(['cortexState'], (data) => {
  if (data.cortexState) {
    Object.assign(state, data.cortexState);
    if (state.timer.isRunning) {
      startTimerInterval();
    }
    if (state.music.enabled) {
      injectMusicPlayer();
    }
  }
});

// Blocking logic
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !state.isBlocking) return;

  try {
    const url = new URL(details.url);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

    const isAllowed = state.allowedSites.some(site =>
      hostname === site.replace(/^www\./, '').toLowerCase()
    );

    if (!isAllowed && !blockedUrls.has(details.url)) {
      blockedUrls.add(details.url);
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL("block.html") + `?referrer=${encodeURIComponent(details.url)}`
      });
    }
  } catch (error) {
    console.error("Blocking error:", error);
  }
});

// Timer functions
function startTimerInterval() {
  if (state.timer.interval) clearInterval(state.timer.interval);
  
  state.timer.interval = setInterval(() => {
    state.timer.timeLeft--;
    
    if (state.timer.timeLeft <= 0) {
      state.timer.isStudyTime = !state.timer.isStudyTime;
      state.timer.timeLeft = state.timer.isStudyTime
        ? state.timer.studyDuration
        : state.timer.breakDuration;
      
      state.isBlocking = state.timer.isStudyTime;
      saveState();
      
      // Toggle music based on study/break
      if (state.music.enabled) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: "MUSIC_CONTROL",
                action: state.timer.isStudyTime ? "play" : "pause"
              }).catch(() => {});
            }
          });
        });
      }
    }
    
    updateTimerInAllTabs();
  }, 1000);
}

function updateTimerInAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "TIMER_UPDATE",
          payload: {
            timeLeft: state.timer.timeLeft,
            isStudyTime: state.timer.isStudyTime,
            isRunning: state.timer.isRunning
          }
        }).catch(() => {});
        
        // Send motivation messages during study time
        if (state.timer.isStudyTime && state.motivation.isEnabled) {
          chrome.tabs.sendMessage(tab.id, {
            type: "MOTIVATION_MESSAGE",
            harshness: state.motivation.harshness,
            interval: state.motivation.interval,
            voice: state.motivation.selectedVoice
          }).catch(() => {});
        }
      }
    });
  });
}

function injectMusicPlayer() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['music-player.js']
        }).catch(() => {});
      }
    });
  });
}

function saveState() {
  chrome.storage.sync.set({ cortexState: state });
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "TOGGLE_BLOCKING":
      state.isBlocking = request.value;
      saveState();
      break;
      
    case "ADD_SITE":
      const normalizedSite = request.site.replace(/^www\./, '').toLowerCase();
      if (!state.allowedSites.includes(normalizedSite)) {
        state.allowedSites.push(normalizedSite);
        saveState();
        sendResponse({ success: true });
      }
      break;
      
    case "REMOVE_SITE":
      state.allowedSites = state.allowedSites.filter(
        s => s !== request.site.replace(/^www\./, '').toLowerCase()
      );
      saveState();
      break;
      
    case "START_TIMER":
      state.timer = {
        isRunning: true,
        isStudyTime: true,
        timeLeft: request.studyMins * 60,
        studyDuration: request.studyMins * 60,
        breakDuration: request.breakMins * 60,
        interval: state.timer.interval
      };
      startTimerInterval();
      saveState();
      break;
      
    case "PAUSE_TIMER":
      clearInterval(state.timer.interval);
      state.timer.isRunning = false;
      saveState();
      break;

      case "SET_MOTIVATION_SETTINGS":
        state.motivation = {
          ...state.motivation,
          ...request.settings
        };
        saveState();
        
        // Immediately update all tabs with new settings
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id && state.motivation.isEnabled) {
              chrome.tabs.sendMessage(tab.id, {
                type: "MOTIVATION_MESSAGE",
                harshness: state.motivation.harshness,
                interval: state.motivation.interval,
                voice: state.motivation.selectedVoice
              }).catch(() => {});
            }
          });
        });
        break;
      
    case "RESET_TIMER":
      clearInterval(state.timer.interval);
      state.timer = {
        isRunning: false,
        isStudyTime: true,
        timeLeft: state.timer.studyDuration,
        studyDuration: state.timer.studyDuration,
        breakDuration: state.timer.breakDuration,
        interval: null
      };
      saveState();
      updateTimerInAllTabs();
      break;
      
    case "SAVE_PRESET":
      state.presets[request.presetName] = request.sites;
      saveState();
      break;
      
    case "LOAD_PRESET":
      state.allowedSites = [...new Set([...state.allowedSites, ...state.presets[request.presetName]])];
      saveState();
      sendResponse({ allowedSites: state.allowedSites });
      break;
      
      case "TOGGLE_MUSIC":
        state.music.enabled = request.enabled;
        saveState();
        if (state.music.enabled) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['music-player.js']
                }).then(() => {
                  chrome.tabs.sendMessage(tab.id, {
                    type: "MUSIC_CONTROL",
                    action: "play"
                  }).catch(() => {});
                }).catch(() => {});
              }
            });
          });
        } else {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  type: "MUSIC_CONTROL",
                  action: "stop"
                }).catch(() => {});
              }
            });
          });
        }
        break;
      
    case "SET_MUSIC_VOLUME":
      state.music.volume = request.volume;
      saveState();
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "MUSIC_CONTROL",
              action: "setVolume",
              volume: state.music.volume
            }).catch(() => {});
          }
        });
      });
      break;
      
    case "SET_MOTIVATION_SETTINGS":
      state.motivation = {
        ...state.motivation,
        ...request.settings
      };
      saveState();
      break;
      
    case "TOGGLE_MOTIVATION":
      state.motivation.isEnabled = request.enabled;
      saveState();
      break;
      
    case "GET_STATE":
      sendResponse(state);
      break;
      
    case "GET_PRESETS":
      sendResponse(state.presets);
      break;
      
    case "GO_BACK":
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.goBack(tabs[0].id);
        }
      });
      break;
  }
  return true;
});

// Inject timer overlay and music player when needed
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    if (state.timer.isRunning) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['timer-overlay.js']
      }).catch(() => {});
      chrome.scripting.insertCSS({
        target: { tabId: details.tabId },
        files: ['timer-overlay.css']
      }).catch(() => {});
    }
    
    if (state.music.enabled) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['music-player.js']
      }).catch(() => {});
    }
    
    if (state.motivation.isEnabled) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['motivation.js']
      }).catch(() => {});
    }
  }
});

// Clear blocked URLs cache on startup
chrome.runtime.onStartup.addListener(() => {
  blockedUrls.clear();
});