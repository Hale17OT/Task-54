async function getCanvasFingerprint(): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  canvas.width = 200;
  canvas.height = 50;
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('CHECC fingerprint', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('CHECC fingerprint', 4, 17);

  return canvas.toDataURL();
}

async function getAudioFingerprint(): Promise<string> {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const analyser = audioCtx.createAnalyser();
    const gain = audioCtx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);

    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start(0);

    const buffer = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(buffer);

    oscillator.stop();
    await audioCtx.close();

    return buffer.slice(0, 10).join(',');
  } catch {
    return '';
  }
}

function getHardwareAttributes(): string {
  const attrs = [
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.language,
    navigator.platform,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
  ];
  return attrs.join('|');
}

async function sha256(input: string): Promise<string> {
  // crypto.subtle requires secure context (HTTPS/localhost)
  // Fall back to simple hash for insecure contexts (Docker HTTP, LAN)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Simple fallback hash for non-secure contexts
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export async function generateFingerprint(): Promise<string> {
  try {
    const [canvas, audio, hardware] = await Promise.all([
      getCanvasFingerprint().catch(() => ''),
      getAudioFingerprint().catch(() => ''),
      Promise.resolve(getHardwareAttributes()),
    ]);

    const combined = `${canvas}|${audio}|${hardware}`;
    return await sha256(combined);
  } catch {
    // Fingerprinting failed (e.g., insecure context) — return a basic fallback
    return Date.now().toString(16);
  }
}
