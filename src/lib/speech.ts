// Simple text-to-speech helper using the browser's Web Speech API.
// Used to announce order status (e.g. "Order ready") out loud, in addition
// to the toast + push notification.

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

function pickMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // Common male-sounding voice names across browsers/OSes.
  const maleNameHints = [
    "male", "david", "mark", "daniel", "alex", "fred", "george",
    "james", "guy", "tom", "aaron", "matthew", "brian", "eric",
  ];

  const byHint = voices.find((v) =>
    maleNameHints.some((hint) => v.name.toLowerCase().includes(hint))
  );
  if (byHint) return byHint;

  // Fall back to the first English voice, then any voice.
  const english = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  return english ?? voices[0];
}

function loadVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve(null);
  }
  if (voicesReady) return Promise.resolve(cachedVoice);

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      cachedVoice = pickMaleVoice(existing);
      voicesReady = true;
      resolve(cachedVoice);
      return;
    }
    // Voices load async in some browsers.
    const onVoicesChanged = () => {
      cachedVoice = pickMaleVoice(synth.getVoices());
      voicesReady = true;
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(cachedVoice);
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
    // Safety timeout in case the event never fires.
    setTimeout(() => {
      if (!voicesReady) {
        cachedVoice = pickMaleVoice(synth.getVoices());
        voicesReady = true;
        resolve(cachedVoice);
      }
    }, 500);
  });
}

/**
 * Speak the given text aloud using a male-sounding voice, if the browser
 * supports the Web Speech API. Fails silently otherwise (e.g. no user
 * gesture yet, unsupported browser, or blocked by the OS).
 */
export async function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    const voice = await loadVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = opts?.rate ?? 1;
    utterance.pitch = opts?.pitch ?? 0.85; // slightly lower pitch reads as a boy/male voice
    utterance.volume = opts?.volume ?? 1;

    // Cancel anything already queued so announcements don't stack up.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech is a nice-to-have; never let it break the app.
  }
}

/**
 * Simple two-tone beep, used as a fallback when speech synthesis isn't
 * available (older browsers, some in-app webviews, muted TTS engines, etc).
 */
function beep() {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    playTone(880, now, 0.15);
    playTone(1320, now + 0.18, 0.18);
    // Close the context shortly after the tones finish to free resources.
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // Audio is a nice-to-have; never let it break the app.
  }
}

/** Convenience helper specifically for the "order ready" announcement. */
export async function speakOrderReady(orderId: string | number) {
  const supportsSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
  const voice = supportsSpeech ? await loadVoice() : null;

  if (supportsSpeech && voice) {
    speak(`Order number ${orderId} is ready. Enjoy your meal!`);
  } else {
    // No speech support or no usable voice loaded — fall back to a beep
    // so there's still an audible cue.
    beep();
  }
}
