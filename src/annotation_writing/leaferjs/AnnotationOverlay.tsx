import React, { useEffect, useMemo, useRef } from 'react'
import { Leafer, Line } from 'leafer-ui'
import {
  CLEAR_PAGE_REV_UI_STATE_KEY,
  ERASER_THICKNESS_UI_STATE_KEY,
  ERASER_TYPE_UI_STATE_KEY,
  PEN_COLOR_UI_STATE_KEY,
  PEN_THICKNESS_UI_STATE_KEY,
  PEN_TYPE_UI_STATE_KEY,
  REDO_REV_UI_STATE_KEY,
  TOOL_UI_STATE_KEY,
  UNDO_REV_UI_STATE_KEY,
  UI_STATE_APP_WINDOW_ID,
  postCommand,
  useUiStateBus
} from '../../status'

type LineRole = 'stroke' | 'eraserPixel'

type LineMeta = {
  role: LineRole
  strokeWidth: number
  points: number[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function updateBounds(meta: LineMeta, x: number, y: number): void {
  if (x < meta.minX) meta.minX = x
  if (y < meta.minY) meta.minY = y
  if (x > meta.maxX) meta.maxX = x
  if (y > meta.maxY) meta.maxY = y
}

function distSqPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLenSq = abx * abx + aby * aby
  if (abLenSq <= 1e-9) return apx * apx + apy * apy
  let t = (apx * abx + apy * aby) / abLenSq
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = ax + t * abx
  const cy = ay + t * aby
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy
}

function hitsLineAtPoint(meta: LineMeta, x: number, y: number, radius: number): boolean {
  const pad = radius + meta.strokeWidth * 0.5
  if (x < meta.minX - pad || x > meta.maxX + pad || y < meta.minY - pad || y > meta.maxY + pad) return false
  const r2 = pad * pad
  const pts = meta.points
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i]
    const ay = pts[i + 1]
    const bx = pts[i + 2]
    const by = pts[i + 3]
    if (distSqPointToSegment(x, y, ax, ay, bx, by) <= r2) return true
  }
  return false
}

export function AnnotationOverlayApp() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bus = useUiStateBus(UI_STATE_APP_WINDOW_ID)

  const tool = bus.state[TOOL_UI_STATE_KEY] === 'pen' ? 'pen' : bus.state[TOOL_UI_STATE_KEY] === 'eraser' ? 'eraser' : 'mouse'
  const penType = bus.state[PEN_TYPE_UI_STATE_KEY] === 'highlighter' ? 'highlighter' : bus.state[PEN_TYPE_UI_STATE_KEY] === 'laser' ? 'laser' : 'writing'
  const penColor = typeof bus.state[PEN_COLOR_UI_STATE_KEY] === 'string' ? (bus.state[PEN_COLOR_UI_STATE_KEY] as string) : '#333333'
  const penThickness = typeof bus.state[PEN_THICKNESS_UI_STATE_KEY] === 'number' ? (bus.state[PEN_THICKNESS_UI_STATE_KEY] as number) : 6
  const eraserThickness = typeof bus.state[ERASER_THICKNESS_UI_STATE_KEY] === 'number' ? (bus.state[ERASER_THICKNESS_UI_STATE_KEY] as number) : 18
  const eraserType = bus.state[ERASER_TYPE_UI_STATE_KEY] === 'stroke' ? 'stroke' : 'pixel'

  const effectiveStroke = useMemo(() => {
    if (tool === 'eraser') return { stroke: '#000000', strokeWidth: eraserThickness, curve: true as const, blendMode: 'destination-out' as const }
    if (penType === 'highlighter') return { stroke: penColor, strokeWidth: penThickness, curve: true as const, opacity: 0.28 }
    if (penType === 'laser') return { stroke: penColor, strokeWidth: Math.max(1, Math.min(60, penThickness)), curve: true as const, opacity: 0.9 }
    return { stroke: penColor, strokeWidth: penThickness, curve: true as const, opacity: 1 }
  }, [eraserThickness, penColor, penThickness, penType, tool])

  const toolRef = useRef(tool)
  const effectiveStrokeRef = useRef(effectiveStroke)
  const eraserTypeRef = useRef(eraserType)
  const eraserThicknessRef = useRef(eraserThickness)
  const apiRef = useRef<null | { undo: () => void; redo: () => void; clear: () => void }>(null)
  const lastUndoRevRef = useRef<number | null>(null)
  const lastRedoRevRef = useRef<number | null>(null)
  const lastClearRevRef = useRef<number | null>(null)

  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  useEffect(() => {
    effectiveStrokeRef.current = effectiveStroke
  }, [effectiveStroke])

  useEffect(() => {
    eraserTypeRef.current = eraserType
  }, [eraserType])

  useEffect(() => {
    eraserThicknessRef.current = eraserThickness
  }, [eraserThickness])

  useEffect(() => {
    void postCommand('win.setAnnotationInput', { enabled: tool !== 'mouse' })
  }, [tool])

  const undoRevRaw = bus.state[UNDO_REV_UI_STATE_KEY]
  const redoRevRaw = bus.state[REDO_REV_UI_STATE_KEY]
  const clearRevRaw = bus.state[CLEAR_PAGE_REV_UI_STATE_KEY]
  const undoRev = typeof undoRevRaw === 'number' ? undoRevRaw : typeof undoRevRaw === 'string' ? Number(undoRevRaw) : 0
  const redoRev = typeof redoRevRaw === 'number' ? redoRevRaw : typeof redoRevRaw === 'string' ? Number(redoRevRaw) : 0
  const clearRev = typeof clearRevRaw === 'number' ? clearRevRaw : typeof clearRevRaw === 'string' ? Number(clearRevRaw) : 0

  useEffect(() => {
    if (!apiRef.current) return
    if (lastUndoRevRef.current === null) {
      lastUndoRevRef.current = undoRev
      return
    }
    if (!undoRev || undoRev === lastUndoRevRef.current) return
    lastUndoRevRef.current = undoRev
    apiRef.current.undo()
  }, [undoRev])

  useEffect(() => {
    if (!apiRef.current) return
    if (lastRedoRevRef.current === null) {
      lastRedoRevRef.current = redoRev
      return
    }
    if (!redoRev || redoRev === lastRedoRevRef.current) return
    lastRedoRevRef.current = redoRev
    apiRef.current.redo()
  }, [redoRev])

  useEffect(() => {
    if (!apiRef.current) return
    if (lastClearRevRef.current === null) {
      lastClearRevRef.current = clearRev
      return
    }
    if (!clearRev || clearRev === lastClearRevRef.current) return
    lastClearRevRef.current = clearRev
    apiRef.current.clear()
  }, [clearRev])

  useEffect(() => {
    const view = containerRef.current
    if (!view) return

    const rect = view.getBoundingClientRect()
    const leafer = new Leafer({ view, width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) } as any)

    type Action = { kind: 'add' | 'remove'; nodes: Line[] }
    const live = new Set<Line>()
    const history = { undo: [] as Action[], redo: [] as Action[] }

    const getMeta = (line: Line): LineMeta | undefined => (line as any).__lanstartMeta as LineMeta | undefined
    const setMeta = (line: Line, meta: LineMeta): void => {
      ;(line as any).__lanstartMeta = meta
    }

    const addNodes = (nodes: Line[]) => {
      for (const node of nodes) {
        leafer.add(node)
        live.add(node)
      }
    }

    const removeNodes = (nodes: Line[]) => {
      for (const node of nodes) {
        try {
          ;(node as any).remove?.()
        } catch {}
        live.delete(node)
      }
    }

    const record = (action: Action) => {
      history.undo.push(action)
      history.redo.length = 0
    }

    const undo = () => {
      const action = history.undo.pop()
      if (!action) return
      if (action.kind === 'add') removeNodes(action.nodes)
      else addNodes(action.nodes)
      history.redo.push(action)
    }

    const redo = () => {
      const action = history.redo.pop()
      if (!action) return
      if (action.kind === 'add') addNodes(action.nodes)
      else removeNodes(action.nodes)
      history.undo.push(action)
    }

    const clear = () => {
      if (!live.size) return
      const nodes = Array.from(live)
      removeNodes(nodes)
      record({ kind: 'remove', nodes })
    }

    apiRef.current = { undo, redo, clear }

    const state = {
      activeId: -1,
      activeLine: null as null | Line,
      points: [] as number[],
      erasing: false,
      erased: [] as Line[],
      erasedSet: new Set<Line>()
    }

    const getPoint = (e: PointerEvent) => {
      const r = view.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      return { x, y }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (toolRef.current === 'mouse') return
      state.activeId = e.pointerId
      view.setPointerCapture(e.pointerId)
      const { x, y } = getPoint(e)
      state.points = [x, y, x, y]
      state.erasing = toolRef.current === 'eraser' && eraserTypeRef.current === 'stroke'
      state.erased = []
      state.erasedSet = new Set<Line>()

      if (state.erasing) {
        const radius = eraserThicknessRef.current * 0.5
        for (const node of live) {
          const meta = getMeta(node)
          if (!meta || meta.role !== 'stroke') continue
          if (state.erasedSet.has(node)) continue
          if (!hitsLineAtPoint(meta, x, y, radius)) continue
          state.erasedSet.add(node)
          state.erased.push(node)
          removeNodes([node])
        }
        return
      }

      const role: LineRole = toolRef.current === 'eraser' ? 'eraserPixel' : 'stroke'
      const stroke = effectiveStrokeRef.current as any
      const strokeWidth = typeof stroke?.strokeWidth === 'number' ? stroke.strokeWidth : toolRef.current === 'eraser' ? eraserThicknessRef.current : 6
      state.activeLine = new Line({
        points: state.points,
        ...stroke
      } as any)
      setMeta(state.activeLine, { role, strokeWidth, points: state.points, minX: x, minY: y, maxX: x, maxY: y })
      leafer.add(state.activeLine)
      live.add(state.activeLine)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== state.activeId) return
      const { x, y } = getPoint(e)
      const lastX = state.points[state.points.length - 2]
      const lastY = state.points[state.points.length - 1]
      const dx = x - lastX
      const dy = y - lastY
      if (dx * dx + dy * dy < 0.6 * 0.6) return
      state.points.push(x, y)

      if (state.erasing) {
        const radius = eraserThicknessRef.current * 0.5
        for (const node of live) {
          const meta = getMeta(node)
          if (!meta || meta.role !== 'stroke') continue
          if (state.erasedSet.has(node)) continue
          if (!hitsLineAtPoint(meta, x, y, radius)) continue
          state.erasedSet.add(node)
          state.erased.push(node)
          removeNodes([node])
        }
        return
      }

      if (!state.activeLine) return
      ;(state.activeLine as any).points = state.points
      const meta = getMeta(state.activeLine)
      if (meta) updateBounds(meta, x, y)
    }

    const finish = (e: PointerEvent) => {
      if (e.pointerId !== state.activeId) return
      const activeLine = state.activeLine
      const erased = state.erased
      state.activeId = -1
      state.activeLine = null
      state.points = []
      state.erasing = false
      state.erased = []
      state.erasedSet = new Set<Line>()
      try {
        view.releasePointerCapture(e.pointerId)
      } catch {}

      if (erased.length) record({ kind: 'remove', nodes: erased })
      else if (activeLine) record({ kind: 'add', nodes: [activeLine] })
    }

    const onPointerUp = (e: PointerEvent) => finish(e)
    const onPointerCancel = (e: PointerEvent) => finish(e)

    const ro = new ResizeObserver(() => {
      const r = view.getBoundingClientRect()
      ;(leafer as any).resize?.(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)))
    })
    ro.observe(view)

    view.addEventListener('pointerdown', onPointerDown)
    view.addEventListener('pointermove', onPointerMove)
    view.addEventListener('pointerup', onPointerUp)
    view.addEventListener('pointercancel', onPointerCancel)

    return () => {
      ro.disconnect()
      view.removeEventListener('pointerdown', onPointerDown)
      view.removeEventListener('pointermove', onPointerMove)
      view.removeEventListener('pointerup', onPointerUp)
      view.removeEventListener('pointercancel', onPointerCancel)
      apiRef.current = null
      ;(leafer as any).destroy?.()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        touchAction: 'none'
      }}
    />
  )
}
