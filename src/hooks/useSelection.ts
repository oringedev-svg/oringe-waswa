import { useState, useMemo, useCallback } from 'react'

export function useSelection<T extends { id: string }>(rows: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))))
  }, [rows])

  const clear = useCallback(() => setSelected(new Set()), [])

  const allSelected = rows.length > 0 && selected.size === rows.length
  const someSelected = selected.size > 0 && !allSelected

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected])

  return { selected, toggle, toggleAll, clear, allSelected, someSelected, selectedRows, count: selected.size }
}
