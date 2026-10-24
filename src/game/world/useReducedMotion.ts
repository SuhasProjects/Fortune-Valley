import { useEffect, useState } from 'react'

/** OS "reduce motion" preference. Agent 4's Options toggle is OR-ed in by the caller once it exists. */
export function useReducedMotion(): boolean {
  const query = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [reduced, setReduced] = useState(() => query()?.matches ?? false)
  useEffect(() => {
    const mq = query()
    if (!mq) return
    const update = () => setReduced(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}
