import React, { useEffect, useMemo, useRef } from 'react'
import { Leafer, Line } from 'leafer-ui'
import {
  ERASER_THICKNESS_UI_STATE_KEY,
  PEN_COLOR_UI_STATE_KEY,
  PEN_THICKNESS_UI_STATE_KEY,
  PEN_TYPE_UI_STATE_KEY,
  TOOL_UI_STATE_KEY,
  UI_STATE_APP_WINDOW_ID,
  postCommand,
  useUiStateBus
} from '../../status'

export function AnnotationOverlayApp() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bus = useUiStateBus(UI_STATE_APP_WINDOW_ID)

  const tool = bus.state[TOOL_UI_STATE_KEY] === 'pen' ? 'pen' : bus.state[TOOL_UI_STATE_KEY] === 'eraser' ? 'eraser' : 'mouse'
  const penType = bus.state[PEN_TYPE_UI_STATE_KEY] === 'highlighter' ? 'highlighter' : bus.state[PEN_TYPE_UI_STATE_KEY] === 'laser' ? 'laser' : 'writing'
  const penColor = typeof bus.state[PEN_COLOR_UI_STATE_KEY] === 'string' ? (bus.state[PEN_COLOR_UI_STATE_KEY] as string) : '#333333'
  const penThickness = typeof bus.state[PEN_THICKNESS_UI_STATE_KEY] === 'number' ? (bus.state[PEN_THICKNESS_UI_STATE_KEY] as number) : 6
  const eraserThickness = typeof bus.state[ERASER_THICKNESS_UI_STATE_KEY] === 'number' ? (bus.state[ERASER_THICKNESS_UI_STATE_KEY] as number) : 18

  const effectiveStroke = useMemo(() => {
    if (tool === 'eraser') return { stroke: '#ffffff', strokeWidth: eraserThickness, curve: true as const }
    if (penType === 'highlighter') return { stroke: penColor, strokeWidth: penThickness, curve: true as const, opacity: 0.28 }
    if (penType === 'laser') return { stroke: penColor, strokeWidth: Math.max(1, Math.min(60, penThickness)), curve: true as const, opacity: 0.9 }
    return { stroke: penColor, strokeWidth: penThickness, curve: true as const, opacity: 1 }
  }, [eraserThickness, penColor, penThickness, penType, tool])

  useEffect(() => {
    void postCommand('win.setAnnotationInput', { enabled: tool !== 'mouse' })
  }, [tool])

  useEffect(() => {
    const view = containerRef.current
    if (!view) return

    const rect = view.getBoundingClientRect()
    const leafer = new Leafer({ view, width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) } as any)

    const state = {
      activeId: -1,
      activeLine: null as null | Line,
      points: [] as number[]
    }

    const getPoint = (e: PointerEvent) => {
      const r = view.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      return { x, y }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (tool === 'mouse') return
      state.activeId = e.pointerId
      view.setPointerCapture(e.pointerId)
      const { x, y } = getPoint(e)
      state.points = [x, y, x, y]
      state.activeLine = new Line({
        points: state.points,
        ...effectiveStroke
      } as any)
      leafer.add(state.activeLine)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== state.activeId) return
      if (!state.activeLine) return
      const { x, y } = getPoint(e)
      const lastX = state.points[state.points.length - 2]
      const lastY = state.points[state.points.length - 1]
      const dx = x - lastX
      const dy = y - lastY
      if (dx * dx + dy * dy < 0.6 * 0.6) return
      state.points.push(x, y)
      ;(state.activeLine as any).points = state.points
    }

    const finish = (e: PointerEvent) => {
      if (e.pointerId !== state.activeId) return
      state.activeId = -1
      state.activeLine = null
      state.points = []
      try {
        view.releasePointerCapture(e.pointerId)
      } catch {}
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
      ;(leafer as any).destroy?.()
    }
  }, [effectiveStroke, tool])

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
