import { createStore } from './store';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Set when the browser offers to install the app (Chrome, Edge, Android). */
export const installPrompt = createStore<InstallPromptEvent | null>(null);
export const installed = createStore(false);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.set(e as InstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    installPrompt.set(null);
    installed.set(true);
  });
}

export const isStandalone = () => typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;

/** Returns false when the browser has no install prompt, so the caller can show manual steps. */
export async function installApp(): Promise<boolean> {
  const evt = installPrompt.get();
  if (!evt) return false;
  await evt.prompt();
  const choice = await evt.userChoice;
  if (choice.outcome === 'accepted') installPrompt.set(null);
  return true;
}

export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}
