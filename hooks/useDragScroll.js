import { useEffect, useCallback, useRef } from 'react'

export function useDragScroll() {
  const ref = useRef(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  const onMouseDown = useCallback((e) => {
    if (!ref.current) return
    dragging.current = true
    startX.current = e.pageX - ref.current.offsetLeft
    scrollLeft.current = ref.current.scrollLeft
    ref.current.style.cursor = 'grabbing'
    ref.current.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !ref.current) return
    e.preventDefault()
    const x = e.pageX - ref.current.offsetLeft
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current)
  }, [])

  const onMouseUp = useCallback(() => {
    if (!ref.current) return
    dragging.current = false
    ref.current.style.cursor = 'grab'
    ref.current.style.userSelect = ''
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseDown, onMouseMove, onMouseUp])

  return ref
}
