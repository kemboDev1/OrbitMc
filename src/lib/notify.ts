let audio: AudioContext | null = null;

/** Short two-note chime made with WebAudio, so no sound file is needed. */
export function chime() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.25);
    });
  } catch {
    /* sound is optional */
  }
}

export const canNotify = () => typeof Notification !== 'undefined';

export async function askNotify(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function notify(title: string, body: string) {
  try {
    if (canNotify() && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body: body.slice(0, 140), icon: '/icons/icon-192.png', tag: 'sado' });
    }
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
