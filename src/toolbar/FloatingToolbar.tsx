import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { Button, ButtonGroup } from '../button'
import { useEventsPoll } from './hooks/useEventsPoll'
import { usePersistedState } from './hooks/usePersistedState'
import { postCommand } from './hooks/useBackend'
import { useToolbarWindowAutoResize } from './hooks/useToolbarWindowAutoResize'
import { TOOLBAR_STATE_KEY, WINDOW_TITLE_FLOATING_TOOLBAR } from './utils/constants'
import './styles/toolbar.css'

type ToolbarState = {
  collapsed: boolean
  alwaysOnTop: boolean
  uiWidth?: number
  uiButtonSize?: 'sm' | 'md'
}

function isToolbarState(value: unknown): value is ToolbarState {
  if (!value || typeof value !== 'object') return false
  const v = value as any
  const okBase = typeof v.collapsed === 'boolean' && typeof v.alwaysOnTop === 'boolean'
  if (!okBase) return false
  if (v.uiWidth !== undefined && typeof v.uiWidth !== 'number') return false
  if (v.uiButtonSize !== undefined && v.uiButtonSize !== 'sm' && v.uiButtonSize !== 'md') return false
  return true
}

type ToolbarContextValue = {
  state: ToolbarState
  setState: (next: ToolbarState) => void
}

const ToolbarContext = createContext<ToolbarContextValue | null>(null)

function useToolbar() {
  const ctx = useContext(ToolbarContext)
  if (!ctx) throw new Error('ToolbarProviderMissing')
  return ctx
}

function ToolbarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = usePersistedState<ToolbarState>(TOOLBAR_STATE_KEY, {
    collapsed: false,
    alwaysOnTop: true,
    uiWidth: 360,
    uiButtonSize: 'sm'
  }, { validate: isToolbarState })

  useEffect(() => {
    const normalized: ToolbarState = {
      collapsed: Boolean(state.collapsed),
      alwaysOnTop: Boolean(state.alwaysOnTop),
      uiWidth: typeof state.uiWidth === 'number' ? state.uiWidth : 360,
      uiButtonSize: state.uiButtonSize === 'md' ? 'md' : 'sm'
    }
    if (
      normalized.collapsed !== state.collapsed ||
      normalized.alwaysOnTop !== state.alwaysOnTop ||
      normalized.uiWidth !== state.uiWidth ||
      normalized.uiButtonSize !== state.uiButtonSize
    ) {
      setState(normalized)
    }
  }, [setState, state])

  const value = useMemo<ToolbarContextValue>(() => ({ state, setState }), [state, setState])
  return <ToolbarContext.Provider value={value}>{children}</ToolbarContext.Provider>
}

function FloatingToolbarInner() {
  const { state, setState } = useToolbar()
  const events = useEventsPoll(800)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const uiWidth = typeof state.uiWidth === 'number' ? state.uiWidth : 360
  const uiButtonSize = state.uiButtonSize === 'md' ? 'md' : 'sm'

  useToolbarWindowAutoResize({ root: rootRef.current, width: uiWidth })

  const cycleWidth = () => {
    const current = uiWidth
    const next = current <= 320 ? 360 : current <= 360 ? 420 : 320
    setState({ ...state, uiWidth: next })
  }

  const toggleButtonSize = () => {
    const next = uiButtonSize === 'sm' ? 'md' : 'sm'
    setState({ ...state, uiButtonSize: next })
  }

  return (
    <div ref={rootRef} className={state.collapsed ? 'toolbarRoot collapsed' : 'toolbarRoot'}>
      <div className="toolbarDragArea">
        <div className="toolbarHeader">
          <div className="toolbarTitle">{WINDOW_TITLE_FLOATING_TOOLBAR}</div>
          <div className="toolbarMeta">{state.alwaysOnTop ? '置顶' : '未置顶'}</div>
        </div>

        <ButtonGroup>
          <Button
            size={uiButtonSize}
            onClick={() => {
              void postCommand('create-window')
            }}
          >
            新建窗口
          </Button>

          <Button
            size={uiButtonSize}
            onClick={() => {
              void postCommand('create-window', { kind: 'settings' })
            }}
          >
            设置
          </Button>

          <Button
            size={uiButtonSize}
            title="切换是否始终置顶（由主进程执行）"
            onClick={() => {
              const next = !state.alwaysOnTop
              setState({ ...state, alwaysOnTop: next })
              void postCommand('set-toolbar-always-on-top', { value: next })
            }}
          >
            置顶
          </Button>

          <Button
            size={uiButtonSize}
            onClick={() => {
              setState({ ...state, collapsed: !state.collapsed })
            }}
          >
            {state.collapsed ? '展开' : '折叠'}
          </Button>

          <Button size={uiButtonSize} onClick={cycleWidth} title="切换浮动工具栏窗口宽度">
            宽度
          </Button>

          <Button size={uiButtonSize} onClick={toggleButtonSize} title="切换按钮尺寸">
            大小
          </Button>

          <Button
            size={uiButtonSize}
            variant="danger"
            onClick={() => {
              void postCommand('quit')
            }}
          >
            退出
          </Button>
        </ButtonGroup>
      </div>

      <div className="toolbarEvents">
        <div className="eventsTitle">事件</div>
        <div className="eventsList">
          {events.slice(-5).map((e) => (
            <div key={e.id} className="eventRow">
              <span className="eventType">{e.type}</span>
              <span className="eventId">#{e.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FloatingToolbarApp() {
  return (
    <ToolbarProvider>
      <FloatingToolbarInner />
    </ToolbarProvider>
  )
}
