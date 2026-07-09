let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, startTimeOffset = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

  // Envelope para que suene suave (retro game style)
  gainNode.gain.setValueAtTime(0, ctx.currentTime + startTimeOffset);
  gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startTimeOffset + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTimeOffset + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime + startTimeOffset);
  osc.stop(ctx.currentTime + startTimeOffset + duration);
}

export function playNotificationSound() {
  try {
    playTone(600, 'sine', 0.5, 0);
    playTone(800, 'sine', 0.5, 0.1);
  } catch(e) { console.error("Audio error", e) }
}

export function playSuccessSound() {
  try {
    playTone(400, 'triangle', 0.3, 0);
    playTone(500, 'triangle', 0.3, 0.1);
    playTone(600, 'triangle', 0.3, 0.2);
    playTone(800, 'triangle', 0.6, 0.3);
  } catch(e) { console.error("Audio error", e) }
}

export function playErrorSound() {
  try {
    playTone(300, 'square', 0.4, 0);
    playTone(250, 'square', 0.6, 0.2);
  } catch(e) { console.error("Audio error", e) }
}
