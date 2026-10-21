// Cloudflare's Turnstile JS API, loaded lazily -- only when a survey
// actually contains a turnstile question (never eagerly on every
// <SurveyRunner> mount), and only once per page load even if several
// turnstile questions/control remounts happen in one session.

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

let loadPromise: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Covers a second <SurveyRunner> instance on the same host page (or a
    // fast remount) racing this same load -- reuse whichever <script> tag
    // is already there instead of injecting a second one.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load the Turnstile script.')));
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load the Turnstile script.')));
    document.head.appendChild(script);
  });

  return loadPromise;
}
