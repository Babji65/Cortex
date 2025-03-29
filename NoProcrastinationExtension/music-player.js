class StudyMusicPlayer {
  constructor() {
    this.audio = null;
    this.initialize();
  }

  initialize() {
    this.audio = new Audio(chrome.runtime.getURL('sounds/study-music.mp3'));
    this.audio.loop = true;
    this.audio.volume = 0.5;

    // Handle autoplay restrictions
    document.addEventListener('click', () => {
      if (this.audio.paused && this.shouldBePlaying) {
        this.audio.play().catch(e => console.log("Playback failed:", e));
      }
    }, { once: true });

    // Listen for control messages
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "MUSIC_CONTROL") {
        switch (message.action) {
          case "play":
            this.shouldBePlaying = true;
            this.audio.play().catch(e => {
              console.log("Autoplay blocked, will play after user interaction");
            });
            break;
          case "pause":
            this.shouldBePlaying = false;
            this.audio.pause();
            break;
          case "stop":
            this.shouldBePlaying = false;
            this.audio.pause();
            this.audio.currentTime = 0;
            break;
          case "setVolume":
            this.audio.volume = message.volume;
            break;
        }
      }
    });

    // Start playing if enabled
    chrome.runtime.sendMessage({ action: "GET_STATE" }, (state) => {
      if (state?.music?.enabled) {
        this.shouldBePlaying = true;
        this.audio.volume = state.music.volume;
        this.audio.play().catch(e => {
          console.log("Initial autoplay blocked:", e);
        });
      }
    });
  }
}

// Initialize player
new StudyMusicPlayer();