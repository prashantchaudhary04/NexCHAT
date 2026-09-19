/**
 * Zero-dependency Web Audio API synthesizer for WhatsApp-style calling ringtones,
 * ringback tones, call connected/ended chimes, and missed call alert chimes.
 */

let audioCtx: AudioContext | null = null;
let activeLoopTimeout: any = null;
let activeOscillators: OscillatorNode[] = [];
let isPlayingRingtone = false;
let isPlayingRingback = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Stop any currently running ringtones, ringbacks, and audio loops immediately.
 */
export function stopAllCallSounds() {
  isPlayingRingtone = false;
  isPlayingRingback = false;

  if (activeLoopTimeout) {
    clearTimeout(activeLoopTimeout);
    activeLoopTimeout = null;
  }

  activeOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {}
  });
  activeOscillators = [];
}

/**
 * Play a single musical bell/marimba note
 */
function playNote(freq: number, startTime: number, duration: number, gainValue = 0.25) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Warm marimba envelope: fast attack, exponential decay
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
    activeOscillators.push(osc);

    // Clean up from array after completion
    setTimeout(() => {
      const idx = activeOscillators.indexOf(osc);
      if (idx !== -1) activeOscillators.splice(idx, 1);
    }, (startTime - ctx.currentTime + duration + 0.1) * 1000);
  } catch (e) {}
}

/**
 * WhatsApp-style incoming call ringtone (melodic marimba loop)
 */
export function playIncomingRingtone() {
  stopAllCallSounds();
  isPlayingRingtone = true;

  function runCycle() {
    if (!isPlayingRingtone) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // WhatsApp-like uplifting melodic phrase (E5, G#5, B5, C#6, B5, G#5, E5, F#5, G#5)
    const melody = [
      { f: 659.25, d: 0.18, offset: 0.0 },   // E5
      { f: 830.61, d: 0.18, offset: 0.18 },  // G#5
      { f: 987.77, d: 0.22, offset: 0.36 },  // B5
      { f: 1108.73, d: 0.25, offset: 0.58 }, // C#6
      { f: 987.77, d: 0.18, offset: 0.85 },  // B5
      { f: 830.61, d: 0.18, offset: 1.05 },  // G#5
      { f: 659.25, d: 0.35, offset: 1.25 },  // E5
      // Secondary pleasant flourish
      { f: 739.99, d: 0.18, offset: 1.65 },  // F#5
      { f: 830.61, d: 0.22, offset: 1.85 },  // G#5
      { f: 987.77, d: 0.35, offset: 2.10 },  // B5
    ];

    melody.forEach(note => {
      playNote(note.f, now + note.offset, note.d, 0.22);
    });

    // Loop cycle every 3.2 seconds
    activeLoopTimeout = setTimeout(() => {
      if (isPlayingRingtone) {
        runCycle();
      }
    }, 3200);
  }

  runCycle();
}

/**
 * WhatsApp-style outgoing ringback tone (North American/European telecom dial pulse: 440Hz + 480Hz)
 */
export function playOutgoingRingback() {
  stopAllCallSounds();
  isPlayingRingback = true;

  function runRingback() {
    if (!isPlayingRingback) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 1.6;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now); // 440Hz

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now); // 480Hz

      // Gentle onset and release
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
      gain.gain.setValueAtTime(0.12, now + duration - 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, now + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + duration);
      osc2.start(now);
      osc2.stop(now + duration);

      activeOscillators.push(osc1, osc2);

      // Loop after standard silence interval (3.8 seconds total period)
      activeLoopTimeout = setTimeout(() => {
        if (isPlayingRingback) {
          runRingback();
        }
      }, 3800);
    } catch (e) {}
  }

  runRingback();
}

/**
 * Call connected chime (soft upward affirmation)
 */
export function playConnectedTone() {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playNote(523.25, now, 0.12, 0.18);        // C5
  playNote(659.25, now + 0.10, 0.14, 0.20); // E5
  playNote(783.99, now + 0.22, 0.28, 0.22); // G5
}

/**
 * Call ended or declined tone (3 short disconnect beeps)
 */
export function playEndTone() {
  stopAllCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [0, 0.22, 0.44].forEach(offset => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(480, now + offset);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(620, now + offset);

      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.linearRampToValueAtTime(0.001, now + offset + 0.12);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now + offset);
      osc1.stop(now + offset + 0.12);
      osc2.start(now + offset);
      osc2.stop(now + offset + 0.12);
    });
  } catch (e) {}
}

/**
 * WhatsApp missed call alert chime (distinct double ping)
 */
export function playMissedCallAlert() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playNote(880, now, 0.14, 0.20);       // A5
  playNote(1174.66, now + 0.12, 0.25, 0.24); // D6
}
