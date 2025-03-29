document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const ui = {
    toggleBlocking: document.getElementById('toggleBlocking'),
    newSite: document.getElementById('newSite'),
    addSite: document.getElementById('addSite'),
    siteList: document.getElementById('siteList'),
    studyMins: document.getElementById('studyMins'),
    breakMins: document.getElementById('breakMins'),
    startTimer: document.getElementById('startTimer'),
    pauseTimer: document.getElementById('pauseTimer'),
    resetTimer: document.getElementById('resetTimer'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerStatus: document.getElementById('timerStatus'),
    presetSelect: document.getElementById('presetSelect'),
    loadPreset: document.getElementById('loadPreset'),
    savePreset: document.getElementById('savePreset'),
    toggleMusic: document.getElementById('toggleMusic'),
    musicVolume: document.getElementById('musicVolume'),
    volumeControl: document.getElementById('volumeControl'),
    toggleMotivation: document.getElementById('toggleMotivation'),
    motivationHarshness: document.getElementById('motivationHarshness'),
    motivationInterval: document.getElementById('motivationInterval'),
    motivationVoice: document.getElementById('motivationVoice'),
    // Collapsible section toggles
    timerToggle: document.getElementById('timerToggle'),
    musicToggle: document.getElementById('musicToggle'),
    motivationToggle: document.getElementById('motivationToggle'),
    presetsToggle: document.getElementById('presetsToggle')
  };

  let timerUpdateInterval = null;

  // Initialize
  chrome.runtime.sendMessage({ action: "GET_STATE" }, (state) => {
    if (state) {
      ui.toggleBlocking.checked = state.isBlocking;
      updateAllowedSitesList(state.allowedSites);
      updateTimerDisplay(state.timer);
      
      // Music controls
      ui.toggleMusic.checked = state.music.enabled;
      ui.musicVolume.value = state.music.volume;
      ui.volumeControl.style.display = state.music.enabled ? 'flex' : 'none';
      
      // Motivation controls
      ui.toggleMotivation.checked = state.motivation.isEnabled;
      ui.motivationHarshness.value = state.motivation.harshness;
      ui.motivationInterval.value = state.motivation.interval;
      
      // Load voices
      loadVoices().then(() => {
        if (state.motivation.selectedVoice) {
          ui.motivationVoice.value = state.motivation.selectedVoice;
        }
      });

      if (state.timer.isRunning) {
        startTimerUpdates();
        ui.startTimer.disabled = true;
        ui.pauseTimer.disabled = false;
      }
    }
  });

  // Voice loading with retry logic
  function loadVoices() {
    return new Promise((resolve) => {
      const tryLoad = (attempt = 0) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          populateVoiceSelect(voices);
          resolve();
        } else if (attempt < 3) {
          console.log(`Voice load attempt ${attempt + 1}`);
          setTimeout(() => tryLoad(attempt + 1), 500);
        } else {
          console.warn("Failed to load voices after 3 attempts");
          resolve();
        }
      };
      
      tryLoad();
      window.speechSynthesis.onvoiceschanged = tryLoad;
    });
  }

  function populateVoiceSelect(voices) {
    ui.motivationVoice.innerHTML = '';
    const englishVoices = voices.filter(voice => 
      voice.lang.includes('en') || voice.lang.includes('EN')
    );
    
    if (englishVoices.length === 0) {
      console.warn("No English voices found");
      const option = document.createElement('option');
      option.textContent = "No voices available";
      ui.motivationVoice.appendChild(option);
      return;
    }

    englishVoices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      ui.motivationVoice.appendChild(option);
    });

    // Set default voice if none selected
    chrome.runtime.sendMessage({ action: "GET_STATE" }, (state) => {
      if (!state.motivation.selectedVoice && englishVoices.length > 0) {
        const defaultVoice = englishVoices.find(v => v.default) || englishVoices[0];
        ui.motivationVoice.value = defaultVoice.name;
        updateMotivationSettings();
      }
    });
  }

  // Setup collapsible sections
  function setupCollapsibleSections() {
    // Timer section
    ui.timerToggle.addEventListener('click', () => {
      document.querySelector('.timer-section-content').classList.toggle('collapsed');
      ui.timerToggle.classList.toggle('collapsed');
    });

    // Music section
    ui.musicToggle.addEventListener('click', () => {
      document.querySelector('.music-section-content').classList.toggle('collapsed');
      ui.musicToggle.classList.toggle('collapsed');
    });

    // Motivation section
    ui.motivationToggle.addEventListener('click', () => {
      document.querySelector('.motivation-section-content').classList.toggle('collapsed');
      ui.motivationToggle.classList.toggle('collapsed');
    });

    // Presets section
    ui.presetsToggle.addEventListener('click', () => {
      document.querySelector('.presets-section-content').classList.toggle('collapsed');
      ui.presetsToggle.classList.toggle('collapsed');
    });

    // Initialize all sections as expanded
    document.querySelectorAll('.section-content').forEach(el => {
      el.classList.remove('collapsed');
    });
  }

  // Initialize collapsible sections
  setupCollapsibleSections();

  // Event listeners
  ui.toggleBlocking.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: "TOGGLE_BLOCKING",
      value: ui.toggleBlocking.checked
    });
  });

  ui.addSite.addEventListener('click', addSite);
  ui.newSite.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  ui.startTimer.addEventListener('click', startTimer);
  ui.pauseTimer.addEventListener('click', pauseTimer);
  ui.resetTimer.addEventListener('click', resetTimer);
  ui.loadPreset.addEventListener('click', loadPreset);
  ui.savePreset.addEventListener('click', saveCurrentToPreset);
  
  // Music controls
  ui.toggleMusic.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: "TOGGLE_MUSIC",
      enabled: ui.toggleMusic.checked
    });
    ui.volumeControl.style.display = ui.toggleMusic.checked ? 'flex' : 'none';
  });

  ui.musicVolume.addEventListener('input', () => {
    chrome.runtime.sendMessage({
      action: "SET_MUSIC_VOLUME",
      volume: parseFloat(ui.musicVolume.value)
    });
  });
  
  // Motivation controls
  ui.toggleMotivation.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: "TOGGLE_MOTIVATION",
      enabled: ui.toggleMotivation.checked
    });
  });

  ui.motivationHarshness.addEventListener('change', updateMotivationSettings);
  ui.motivationInterval.addEventListener('change', updateMotivationSettings);
  ui.motivationVoice.addEventListener('change', updateMotivationSettings);

  // Functions
  function updateMotivationSettings() {
    const interval = Math.max(10, Math.min(300, parseInt(ui.motivationInterval.value)));
    ui.motivationInterval.value = interval;
    
    chrome.runtime.sendMessage({
      action: "SET_MOTIVATION_SETTINGS",
      settings: {
        harshness: ui.motivationHarshness.value,
        interval: interval,
        selectedVoice: ui.motivationVoice.value
      }
    });
  }

  function addSite() {
    const site = ui.newSite.value.trim();
    if (!site || site.includes(' ')) {
      alert('Please enter a valid domain (e.g., youtube.com)');
      return;
    }

    chrome.runtime.sendMessage({
      action: "ADD_SITE",
      site: site
    }, (response) => {
      if (response?.success) {
        ui.newSite.value = '';
        chrome.runtime.sendMessage(
          { action: "GET_STATE" },
          (state) => updateAllowedSitesList(state.allowedSites)
        );
      }
    });
  }

  function updateAllowedSitesList(sites = []) {
    ui.siteList.innerHTML = '';
    sites.forEach(site => {
      const li = document.createElement('li');
      li.textContent = site;
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'btn btn-small btn-danger';
      removeBtn.addEventListener('click', () => {
        li.remove();
        chrome.runtime.sendMessage({
          action: "REMOVE_SITE",
          site: site
        });
      });
      
      li.appendChild(removeBtn);
      ui.siteList.appendChild(li);
    });
  }

  function startTimer() {
    const studyMins = Math.max(1, Math.min(parseInt(ui.studyMins.value) || 25, 120));
    const breakMins = Math.max(1, Math.min(parseInt(ui.breakMins.value) || 5, 30));
    
    chrome.runtime.sendMessage({
      action: "START_TIMER",
      studyMins: studyMins,
      breakMins: breakMins
    });
    
    ui.startTimer.disabled = true;
    ui.pauseTimer.disabled = false;
    startTimerUpdates();
  }

  function pauseTimer() {
    chrome.runtime.sendMessage({ action: "PAUSE_TIMER" });
    clearInterval(timerUpdateInterval);
    ui.startTimer.disabled = false;
    ui.pauseTimer.disabled = true;
  }

  function resetTimer() {
    chrome.runtime.sendMessage({ action: "RESET_TIMER" });
    clearInterval(timerUpdateInterval);
    ui.startTimer.disabled = false;
    ui.pauseTimer.disabled = true;
    updateTimerDisplay({
      timeLeft: parseInt(ui.studyMins.value) * 60 || 25 * 60,
      isStudyTime: true,
      isRunning: false
    });
  }

  function loadPreset() {
    const presetName = ui.presetSelect.value;
    chrome.runtime.sendMessage({
      action: "LOAD_PRESET",
      presetName: presetName
    }, (response) => {
      if (response?.allowedSites) {
        updateAllowedSitesList(response.allowedSites);
        showConfirmation(`Loaded ${presetName} preset!`);
      }
    });
  }

  function saveCurrentToPreset() {
    const presetName = ui.presetSelect.value;
    chrome.runtime.sendMessage({
      action: "GET_STATE"
    }, (state) => {
      chrome.runtime.sendMessage({
        action: "SAVE_PRESET",
        presetName: presetName,
        sites: state.allowedSites
      }, () => {
        showConfirmation(`Saved to ${presetName} preset!`);
      });
    });
  }

  function startTimerUpdates() {
    clearInterval(timerUpdateInterval);
    timerUpdateInterval = setInterval(() => {
      chrome.runtime.sendMessage({ action: "GET_STATE" }, (state) => {
        if (state?.timer) {
          updateTimerDisplay(state.timer);
        }
      });
    }, 1000);
  }

  function updateTimerDisplay(timer) {
    const minutes = Math.floor(timer.timeLeft / 60);
    const seconds = timer.timeLeft % 60;
    ui.timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    ui.timerStatus.textContent = timer.isRunning
      ? (timer.isStudyTime ? 'FOCUS TIME' : 'BREAK TIME')
      : 'READY';
  }

  function showConfirmation(message) {
    const confirmation = document.createElement('div');
    confirmation.textContent = message;
    confirmation.style.color = 'green';
    confirmation.style.marginTop = '8px';
    confirmation.style.textAlign = 'center';
    confirmation.style.fontSize = '12px';
    
    const presetsSection = document.querySelector('.presets-section');
    const existingConfirmation = presetsSection.querySelector('.confirmation');
    if (existingConfirmation) {
      existingConfirmation.remove();
    }
    
    confirmation.className = 'confirmation';
    presetsSection.appendChild(confirmation);
    setTimeout(() => confirmation.remove(), 2000);
  }
});