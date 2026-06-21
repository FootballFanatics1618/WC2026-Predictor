import { useState, useEffect, useCallback, useRef } from 'react'

export function useServerTime() {
  const deltaRef = useRef(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let mounted = true

    fetch('/api/time')
      .then(r => r.json())
      .then(({ serverTime }) => {
        if (!mounted || !serverTime) return
        deltaRef.current = new Date(serverTime).getTime() - Date.now()
        setTick(t => t + 1)
      })
      .catch(() => {})

    const t = setInterval(() => setTick(v => v + 1), 60000)

    return () => { mounted = false; clearInterval(t) }
  }, [])

  const serverNow = useCallback(() => new Date(Date.now() + deltaRef.current), [tick])

  return { serverNow }
}
