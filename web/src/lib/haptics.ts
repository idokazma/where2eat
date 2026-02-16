/**
 * Haptic feedback utility for mobile devices.
 * Uses the Vibration API where available. Graceful no-op otherwise.
 */

let lastTriggerTime = 0;
const THROTTLE_MS = 100;

/**
 * Trigger a short haptic vibration.
 * Throttled to at most once per 100ms.
 */
export function triggerHaptic(style: 'light' | 'medium' = 'light') {
  const now = Date.now();
  if (now - lastTriggerTime < THROTTLE_MS) return;
  lastTriggerTime = now;

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(style === 'light' ? 8 : 15);
  }
}

/**
 * Reset throttle state (for testing).
 */
export function _resetThrottle() {
  lastTriggerTime = 0;
}
