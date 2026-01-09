import { renderHook, act } from '@testing-library/react'
import { useToast } from '../use-toast'

describe('useToast', () => {
  it('initializes with empty toasts array', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it('adds a toast when showToast is called', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Test message', 'info')
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Test message')
    expect(result.current.toasts[0].type).toBe('info')
  })

  it('adds success toast with success method', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.success('Success message')
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].message).toBe('Success message')
  })

  it('adds error toast with error method', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.error('Error message')
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('error')
  })

  it('adds warning toast with warning method', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.warning('Warning message')
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('warning')
  })

  it('adds info toast with info method', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.info('Info message')
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('info')
  })

  it('dismisses a toast by id', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('First toast', 'info')
      result.current.showToast('Second toast', 'info')
    })

    expect(result.current.toasts).toHaveLength(2)

    const firstToastId = result.current.toasts[0].id

    act(() => {
      result.current.dismissToast(firstToastId)
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Second toast')
  })

  it('handles multiple toasts', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.success('Toast 1')
      result.current.error('Toast 2')
      result.current.warning('Toast 3')
    })

    expect(result.current.toasts).toHaveLength(3)
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[1].type).toBe('error')
    expect(result.current.toasts[2].type).toBe('warning')
  })

  it('assigns unique ids to each toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Toast 1', 'info')
      result.current.showToast('Toast 2', 'info')
    })

    const ids = result.current.toasts.map(t => t.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(2)
  })
})
