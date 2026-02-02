import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from '../Framer_Motion'
import { useHyperGlassRealtimeBlur } from '../hyper_glass'
import { Button } from '../button'
import '../toolbar-subwindows/styles/subwindow.css'
import './styles.css'

type SortKey = 'cpu' | 'mem' | 'pid'

type ProcessRow = {
  pid: number
  name: string
  cpuPercent?: number
  memoryBytes?: number
}

type WindowRow = {
  ts: number
  title: string
  pid?: number
  processName?: string
  handle?: string
}

function formatBytes(bytes: number | undefined): string {
  if (!Number.isFinite(bytes ?? NaN)) return '-'
  const b = Number(bytes)
  if (b < 1024) return `${Math.round(b)} B`
  const kb = b / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

function formatPct(v: number | undefined): string {
  if (!Number.isFinite(v ?? NaN)) return '-'
  const n = Math.max(0, Number(v))
  if (n < 1) return `${n.toFixed(2)}%`
  if (n < 10) return `${n.toFixed(1)}%`
  return `${n.toFixed(0)}%`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function TaskWindowsWatcherWindow() {
  const reduceMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const lastWindowKeyRef = useRef<string>('')

  const [running, setRunning] = useState(false)
  const [intervalMs, setIntervalMs] = useState(1000)
  const [lastError, setLastError] = useState<string | undefined>(undefined)
  const [collecting, setCollecting] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('cpu')
  const [foreground, setForeground] = useState<WindowRow | undefined>(undefined)
  const [history, setHistory] = useState<WindowRow[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])

  useHyperGlassRealtimeBlur({ root: rootRef.current })

  useEffect(() => {
    if (!collecting) return
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await window.lanstart?.apiRequest({ method: 'GET', path: '/watcher/state' })
        const body = (res?.body ?? {}) as any
        const watcher = (body.watcher ?? {}) as any
        const processesRaw = (body.processes ?? {}) as any
        const foregroundRaw = (body.foreground ?? {}) as any

        setRunning(Boolean(watcher.running))
        const nextInterval = Number(watcher.intervalMs)
        if (Number.isFinite(nextInterval)) setIntervalMs(nextInterval)
        setLastError(typeof watcher.lastError === 'string' ? watcher.lastError : undefined)

        const list = Array.isArray(processesRaw?.processes) ? (processesRaw.processes as any[]) : []
        const rows: ProcessRow[] = []
        for (const item of list) {
          const pid = Number(item?.pid)
          const name = typeof item?.name === 'string' ? item.name : ''
          if (!Number.isFinite(pid) || !name) continue
          rows.push({
            pid,
            name,
            cpuPercent: Number.isFinite(Number(item?.cpuPercent)) ? Number(item.cpuPercent) : undefined,
            memoryBytes: Number.isFinite(Number(item?.memoryBytes)) ? Number(item.memoryBytes) : undefined
          })
        }
        setProcesses(rows)

        const ts = Number(foregroundRaw?.ts)
        const w = (foregroundRaw?.window ?? undefined) as any
        const title = typeof w?.title === 'string' ? w.title : ''
        if (title) {
          const row: WindowRow = {
            ts: Number.isFinite(ts) ? ts : Date.now(),
            title,
            pid: Number.isFinite(Number(w.pid)) ? Number(w.pid) : undefined,
            processName: typeof w.processName === 'string' ? w.processName : undefined,
            handle: typeof w.handle === 'string' ? w.handle : undefined
          }
          const key = `${row.pid ?? 0}|${row.handle ?? ''}|${row.title}`
          setForeground(row)
          if (key && key !== lastWindowKeyRef.current) {
            lastWindowKeyRef.current = key
            setHistory((prev) => [row, ...prev].slice(0, 60))
          }
        }
      } catch (e) {
        setLastError(e instanceof Error ? e.message : String(e))
      } finally {
        if (cancelled) return
        timer = window.setTimeout(() => void poll(), 700)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [collecting])

  const sortedProcesses = useMemo(() => {
    const rows = [...processes]
    rows.sort((a, b) => {
      if (sortKey === 'pid') return a.pid - b.pid
      if (sortKey === 'mem') return (b.memoryBytes ?? -1) - (a.memoryBytes ?? -1)
      return (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1)
    })
    return rows.slice(0, 180)
  }, [processes, sortKey])

  const start = () => {
    setCollecting(true)
  }

  const stop = () => {
    setCollecting(false)
  }

  return (
    <motion.div
      ref={rootRef}
      className="subwindowRoot"
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? undefined : { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div ref={cardRef} className="subwindowCard animate-ls-pop-in">
        <div className="subwindowMeasure">
          <div className="subwindowTitle">
            <span>监视器</span>
            <span className="subwindowMeta">{collecting ? '展示中' : '已暂停'}</span>
          </div>

          <div className="twRow">
            <Button size="sm" variant={collecting ? 'light' : 'default'} onClick={start}>
              开启展示
            </Button>
            <Button size="sm" variant={!collecting ? 'light' : 'default'} onClick={stop}>
              暂停展示
            </Button>
            <span className="subwindowMeta">{running ? `采样中 ${intervalMs}ms` : '采样状态未知'}</span>
            <span className="subwindowMeta">{lastError ? `错误: ${lastError}` : ''}</span>
          </div>

          <div className="twSection">
            <div className="twSectionHeader">
              <span>前台窗口</span>
              <span className="subwindowMeta">{foreground ? formatTime(foreground.ts) : '-'}</span>
            </div>
            <div className="twBox">
              <div className="twKeyRow">
                <span className="twKey">标题</span>
                <span className="twValue">{foreground?.title ?? '-'}</span>
              </div>
              <div className="twKeyRow">
                <span className="twKey">进程</span>
                <span className="twValue">
                  {foreground?.processName ?? '-'} {foreground?.pid ? `(${foreground.pid})` : ''}
                </span>
              </div>
              <div className="twKeyRow">
                <span className="twKey">句柄</span>
                <span className="twValue">{foreground?.handle ?? '-'}</span>
              </div>
            </div>
          </div>

          <div className="twSection">
            <div className="twSectionHeader">
              <span>窗口切换</span>
              <span className="subwindowMeta">{history.length}</span>
            </div>
            <div className="subwindowList">
              {history.slice(0, 10).map((h) => (
                <div key={`${h.ts}-${h.handle ?? ''}-${h.pid ?? 0}`} className="subwindowRow">
                  <span>{h.title}</span>
                  <span className="subwindowMeta">{formatTime(h.ts)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="twSection">
            <div className="twSectionHeader">
              <span>进程列表</span>
              <span className="subwindowMeta">{processes.length}</span>
            </div>
            <div className="twRow">
              <Button size="sm" variant={sortKey === 'cpu' ? 'light' : 'default'} onClick={() => setSortKey('cpu')}>
                CPU
              </Button>
              <Button size="sm" variant={sortKey === 'mem' ? 'light' : 'default'} onClick={() => setSortKey('mem')}>
                内存
              </Button>
              <Button size="sm" variant={sortKey === 'pid' ? 'light' : 'default'} onClick={() => setSortKey('pid')}>
                PID
              </Button>
            </div>
            <div className="twProcessTable">
              <div className="twProcessHeader">
                <span>进程</span>
                <span>CPU</span>
                <span>内存</span>
              </div>
              {sortedProcesses.slice(0, 60).map((p) => (
                <div key={p.pid} className="twProcessRow">
                  <span className="twProcName">
                    {p.name} <span className="subwindowMeta">#{p.pid}</span>
                  </span>
                  <span className="twProcNum">{formatPct(p.cpuPercent)}</span>
                  <span className="twProcNum">{formatBytes(p.memoryBytes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
