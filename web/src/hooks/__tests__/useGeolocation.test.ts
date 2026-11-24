import { renderHook, act } from "@testing-library/react";
import { useGeolocation } from "../useGeolocation";

function mockGeolocation() {
  // Called as (success, error, options); the test reads the options from mock.calls.
  const getCurrentPosition = jest.fn((ok: PositionCallback) =>
    ok({ coords: { latitude: 32.08, longitude: 34.78, accuracy: 12 }, timestamp: 1 } as unknown as GeolocationPosition));
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

describe("useGeolocation getCurrentPosition", () => {
  it("uses the hook's options by default", async () => {
    const get = mockGeolocation();
    const { result } = renderHook(() => useGeolocation({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }));
    await act(async () => { await result.current.getCurrentPosition(); });
    expect((get.mock.calls[0] as unknown[])[2]).toEqual({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });

  it("takes per-call options, e.g. a fresh precise fix for an explicit request", async () => {
    const get = mockGeolocation();
    const { result } = renderHook(() => useGeolocation({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }));
    let coords;
    await act(async () => { coords = await result.current.getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0 }); });
    expect((get.mock.calls[0] as unknown[])[2]).toEqual({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    expect(coords).toEqual({ lat: 32.08, lng: 34.78 });
  });
});
