/** @jest-environment jsdom */

import { triggerHaptic, _resetThrottle } from '../haptics';

describe('haptics', () => {
  let vibrateMock: jest.Mock;

  beforeEach(() => {
    // Reset throttle before each test
    _resetThrottle();

    // Create a mock for navigator.vibrate
    vibrateMock = jest.fn();
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: vibrateMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('triggerHaptic', () => {
    it('calls navigator.vibrate with 8ms for light style', () => {
      triggerHaptic('light');

      expect(vibrateMock).toHaveBeenCalledWith(8);
      expect(vibrateMock).toHaveBeenCalledTimes(1);
    });

    it('calls navigator.vibrate with 8ms for default (no style)', () => {
      triggerHaptic();

      expect(vibrateMock).toHaveBeenCalledWith(8);
      expect(vibrateMock).toHaveBeenCalledTimes(1);
    });

    it('calls navigator.vibrate with 15ms for medium style', () => {
      triggerHaptic('medium');

      expect(vibrateMock).toHaveBeenCalledWith(15);
      expect(vibrateMock).toHaveBeenCalledTimes(1);
    });

    it('does not throw when navigator.vibrate is undefined', () => {
      // Delete vibrate from navigator to simulate it not being present
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
      delete (navigator as any).vibrate;

      expect(() => {
        triggerHaptic('light');
      }).not.toThrow();

      // Restore
      if (descriptor) {
        Object.defineProperty(navigator, 'vibrate', descriptor);
      }
    });

    it('throttles rapid calls within 100ms', () => {
      // First call should trigger
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Immediate second call should be throttled
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1); // Still 1

      // Third call should also be throttled
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1); // Still 1
    });

    it('allows call after throttle period', () => {
      jest.useFakeTimers();

      // First call
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Advance time by 50ms (within throttle)
      jest.advanceTimersByTime(50);
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1); // Still throttled

      // Advance time by another 60ms (total 110ms, past throttle)
      jest.advanceTimersByTime(60);
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(2); // Should trigger

      jest.useRealTimers();
    });

    it('throttles calls with different styles', () => {
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledWith(8);
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Immediate call with different style should still be throttled
      triggerHaptic('medium');
      expect(vibrateMock).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('_resetThrottle', () => {
    it('allows triggering again after reset', () => {
      // First call
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Second call should be throttled
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1);

      // Reset throttle
      _resetThrottle();

      // Now should be able to trigger again
      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(2);
    });

    it('can be called multiple times safely', () => {
      _resetThrottle();
      _resetThrottle();
      _resetThrottle();

      triggerHaptic('light');
      expect(vibrateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles missing navigator gracefully', () => {
      const originalNavigator = global.navigator;

      // @ts-ignore - Temporarily delete navigator
      delete global.navigator;

      expect(() => {
        triggerHaptic('light');
      }).not.toThrow();

      // Restore navigator
      global.navigator = originalNavigator;
    });

    it('handles navigator without vibrate property', () => {
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
      delete (navigator as any).vibrate;

      expect(() => {
        triggerHaptic('light');
        triggerHaptic('medium');
      }).not.toThrow();

      // Restore
      if (descriptor) {
        Object.defineProperty(navigator, 'vibrate', descriptor);
      }
    });
  });
});
