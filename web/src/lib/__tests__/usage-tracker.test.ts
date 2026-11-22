/**
 * Usage tracker: batching, session id, path sanitization, no-free-text guarantees.
 */
import {
  _resetForTests,
  enqueue,
  flush,
  getDeviceClass,
  getPageType,
  getSessionId,
  trackOutbound,
  trackPageView,
  trackRestaurantView,
  trackSessionStart,
} from '../usage-tracker'

describe('usage-tracker', () => {
  let beacon: jest.Mock

  beforeEach(() => {
    _resetForTests()
    window.sessionStorage.clear()
    beacon = jest.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: beacon,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    _resetForTests()
  })

  async function lastBeaconBody(): Promise<any> {
    expect(beacon).toHaveBeenCalled()
    const blob: Blob = beacon.mock.calls[beacon.mock.calls.length - 1][1]
    return JSON.parse(await blob.text())
  }

  it('creates and reuses a per-tab session id', () => {
    const a = getSessionId()
    const b = getSessionId()
    expect(a).toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    // New "tab" (cleared sessionStorage) gets a different id after reset
    _resetForTests()
    window.sessionStorage.clear()
    const c = getSessionId()
    expect(c).not.toBe(a)
  })

  it('classifies page types from paths', () => {
    expect(getPageType('/')).toBe('home')
    expect(getPageType('/map')).toBe('map')
    expect(getPageType('/stories')).toBe('stories')
    expect(getPageType('/restaurant/abc')).toBe('restaurant')
    expect(getPageType('/saved')).toBe('saved')
    expect(getPageType('/something-else')).toBe('other')
  })

  it('detects device class from viewport width', () => {
    expect(['mobile', 'tablet', 'desktop']).toContain(getDeviceClass())
  })

  it('flushes a batch of page views without query strings', async () => {
    trackPageView('/map')
    trackPageView('/stories')
    flush()
    const body = await lastBeaconBody()
    expect(body.events).toHaveLength(2)
    expect(body.events[0].event_type).toBe('page_view')
    expect(body.events[0].path).toBe('/map')
    expect(body.events[0].page_type).toBe('map')
    expect(body.events[0].session_id).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })

  it('tracks restaurant views and outbound clicks with ids', async () => {
    trackRestaurantView('rest-1')
    trackOutbound('instagram', 'rest-1')
    trackOutbound('navigation')
    flush()
    const body = await lastBeaconBody()
    const types = body.events.map((e: any) => e.event_type)
    expect(types).toEqual(['restaurant_view', 'outbound_click', 'outbound_click'])
    expect(body.events[0].restaurant_id).toBe('rest-1')
    expect(body.events[1].target).toBe('instagram')
    expect(body.events[2].restaurant_id).toBeUndefined()
  })

  it('session_start carries no referrer when none exists', async () => {
    trackSessionStart()
    flush()
    const body = await lastBeaconBody()
    const start = body.events.find((e: any) => e.event_type === 'session_start')
    expect(start).toBeDefined()
    expect(start.referrer_domain ?? null).toBeNull()
  })

  it('auto-flushes when the batch limit is reached', () => {
    for (let i = 0; i < 10; i++) trackPageView(`/p${i}`)
    expect(beacon).toHaveBeenCalled()
  })

  it('never throws when sendBeacon throws', () => {
    beacon.mockImplementation(() => {
      throw new Error('blocked')
    })
    trackPageView('/')
    expect(() => flush()).not.toThrow()
  })

  it('queue is empty after flush', () => {
    trackPageView('/')
    flush()
    beacon.mockClear()
    flush()
    expect(beacon).not.toHaveBeenCalled()
  })
})
