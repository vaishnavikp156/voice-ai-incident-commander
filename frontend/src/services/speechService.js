/**
 * Speech Recognition & Voice Synthesis Service
 * Provides continuous microphone Speech-to-Text (STT) and AI Commander Text-to-Speech (TTS).
 */

class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.currentSpeaker = "Vaishnavi K P";
    this.currentRole = "Incident Commander";
    this.onUtteranceCallback = null;
    this.onInterimCallback = null;
    this.onListeningChangeCallback = null;
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.isSpeakingAI = false;
    this.onAISpeakingChange = null;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onstart = () => {
        this.isListening = true;
        if (this.onListeningChangeCallback) this.onListeningChangeCallback(true);
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript && this.onInterimCallback) {
          this.onInterimCallback(interimTranscript);
        }

        if (finalTranscript.trim()) {
          if (this.onInterimCallback) this.onInterimCallback("");
          if (this.onUtteranceCallback) {
            this.onUtteranceCallback({
              text: finalTranscript.trim(),
              speaker: this.currentSpeaker,
              role: this.currentRole,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn("[SpeechService] Speech recognition notice:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          this.isListening = false;
          if (this.onListeningChangeCallback) this.onListeningChangeCallback(false);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if intended to stay listening
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            this.isListening = false;
            if (this.onListeningChangeCallback) this.onListeningChangeCallback(false);
          }
        } else {
          if (this.onListeningChangeCallback) this.onListeningChangeCallback(false);
        }
      };
    } else {
      console.warn("[SpeechService] Web Speech API not supported in this browser.");
    }
  }

  startListening(onUtterance, onInterim, onListeningChange) {
    this.onUtteranceCallback = onUtterance;
    this.onInterimCallback = onInterim;
    this.onListeningChangeCallback = onListeningChange;

    if (this.recognition) {
      try {
        this.isListening = true;
        this.recognition.start();
      } catch (err) {
        // Already started or active
      }
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {}
    }
    if (this.onListeningChangeCallback) this.onListeningChangeCallback(false);
  }

  setSpeaker(speaker, role) {
    this.currentSpeaker = speaker;
    this.currentRole = role;
  }

  /**
   * Speak aloud as the AI Incident Commander using TTS
   */
  speakAsAI(text, onEnd = null) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    // Cancel ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick best English voice if available
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Daniel"))
    ) || voices.find((v) => v.lang.startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.isSpeakingAI = true;
    if (this.onAISpeakingChange) this.onAISpeakingChange(true);

    utterance.onend = () => {
      this.isSpeakingAI = false;
      if (this.onAISpeakingChange) this.onAISpeakingChange(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeakingAI = false;
      if (this.onAISpeakingChange) this.onAISpeakingChange(false);
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeakingAI = false;
      if (this.onAISpeakingChange) this.onAISpeakingChange(false);
    }
  }
}

export const speechService = new SpeechService();
