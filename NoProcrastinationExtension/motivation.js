class MotivationSystem {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.intervalId = null;
    this.messages = {
      mild: [
        "You can do better! Stay focused.",
        "Remember your goals!",
        "This isn't helping your productivity."
      ],
      medium: [
        "Get back to work! This can wait.",
        "You're better than this distraction.",
        "Focus now, browse later."
      ],
      harsh: [
        "STOP PROCRASTINATING!",
        "Close this tab NOW!",
        "Is this really how you want to spend your time?"
      ]
    };
    this.initialize();
  }

  async initialize() {
    await this.loadVoices();
    this.setupMessageListener();
    console.log("Motivation system ready");
  }

  loadVoices() {
    return new Promise((resolve) => {
      const checkVoices = () => {
        this.voices = this.synth.getVoices();
        if (this.voices.length > 0) {
          console.log("Voices loaded:", this.voices);
          resolve();
        } else {
          setTimeout(checkVoices, 100);
        }
      };
      checkVoices();
      this.synth.onvoiceschanged = checkVoices;
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "MOTIVATION_MESSAGE") {
        this.start(message.harshness, message.interval, message.voice);
      }
    });
  }

  start(harshness, interval, voiceName) {
    this.stop();
    
    if (!this.messages[harshness] || this.messages[harshness].length === 0) {
      console.error("No messages for level:", harshness);
      return;
    }

    const deliver = () => {
      const msgs = this.messages[harshness];
      const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
      this.speak(randomMsg, voiceName);
      document.getElementById('motivationMessage').textContent = randomMsg;
    };

    deliver(); // Immediate first message
    this.intervalId = setInterval(deliver, interval * 1000);
  }

  speak(text, voiceName) {
    if (!text || !this.synth) return;
    
    this.synth.cancel(); // Stop any current speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    
    const selectedVoice = this.voices.find(v => v.name === voiceName) || 
                         this.voices.find(v => v.lang.includes('en')) || 
                         null;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log("Using voice:", selectedVoice.name);
    }

    utterance.pitch = 0.8 + Math.random() * 0.4;
    utterance.rate = 0.9 + Math.random() * 0.3;
    
    utterance.onerror = (e) => {
      console.error("Speech error:", e.error);
    };

    this.synth.speak(utterance);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.synth.speaking) this.synth.cancel();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'complete') {
  new MotivationSystem();
} else {
  document.addEventListener('DOMContentLoaded', () => new MotivationSystem());
}