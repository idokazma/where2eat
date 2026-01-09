/**
 * @jest-environment jsdom
 */
import { logMetricToConsole, sendMetricToAnalytics, WebVitalsMetric } from '../analytics'

describe('Analytics', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('logMetricToConsole', () => {
    it('logs good metrics in green', () => {
      const metric: WebVitalsMetric = {
        id: 'test-1',
        name: 'LCP',
        value: 2000,
        rating: 'good',
      }

      logMetricToConsole(metric)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('LCP: 2000.00ms [good]'),
        expect.stringContaining('color: green')
      )
    })

    it('logs needs-improvement metrics in orange', () => {
      const metric: WebVitalsMetric = {
        id: 'test-2',
        name: 'FCP',
        value: 2500,
        rating: 'needs-improvement',
      }

      logMetricToConsole(metric)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('FCP: 2500.00ms [needs-improvement]'),
        expect.stringContaining('color: orange')
      )
    })

    it('logs poor metrics in red', () => {
      const metric: WebVitalsMetric = {
        id: 'test-3',
        name: 'CLS',
        value: 0.3,
        rating: 'poor',
      }

      logMetricToConsole(metric)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('CLS: 0.30ms [poor]'),
        expect.stringContaining('color: red')
      )
    })
  })

  describe('sendMetricToAnalytics', () => {
    let sendBeaconSpy: jest.SpyInstance
    let fetchSpy: jest.Mock

    beforeEach(() => {
      sendBeaconSpy = jest.spyOn(navigator, 'sendBeacon').mockImplementation(() => true)
      // Mock fetch
      fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
      global.fetch = fetchSpy
    })

    afterEach(() => {
      sendBeaconSpy.mockRestore()
    })

    it('uses sendBeacon when available', () => {
      const metric: WebVitalsMetric = {
        id: 'test-4',
        name: 'TTFB',
        value: 500,
        rating: 'good',
      }

      sendMetricToAnalytics(metric)

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics',
        expect.stringContaining('"name":"TTFB"')
      )
    })

    it('calls sendBeacon with correct endpoint and payload', () => {
      const metric: WebVitalsMetric = {
        id: 'test-5',
        name: 'INP',
        value: 100,
        rating: 'good',
      }

      sendMetricToAnalytics(metric)

      expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics',
        expect.any(String)
      )

      const callArg = sendBeaconSpy.mock.calls[0][1]
      const payload = JSON.parse(callArg)

      expect(payload).toMatchObject({
        name: 'INP',
        value: 100,
        rating: 'good',
        id: 'test-5',
      })
    })

    it('includes all required fields in the payload', () => {
      const metric: WebVitalsMetric = {
        id: 'test-6',
        name: 'LCP',
        value: 2000,
        rating: 'good',
      }

      sendMetricToAnalytics(metric)

      const callArg = sendBeaconSpy.mock.calls[0][1]
      const payload = JSON.parse(callArg)

      expect(payload).toMatchObject({
        name: 'LCP',
        value: 2000,
        rating: 'good',
        id: 'test-6',
      })
      expect(payload.timestamp).toBeDefined()
      expect(payload.url).toBeDefined()
    })
  })
})
