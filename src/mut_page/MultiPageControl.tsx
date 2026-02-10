import React, { useMemo } from 'react'
import { NOTES_PAGE_INDEX_UI_STATE_KEY, NOTES_PAGE_TOTAL_UI_STATE_KEY, UI_STATE_APP_WINDOW_ID, postCommand, useUiStateBus } from '../status'
import { Button } from '../button'
import { useZoomOnWheel } from '../toolbar/hooks/useZoomOnWheel'
import '../toolbar-subwindows/styles/subwindow.css'

export function MultiPageControlWindow() {
  useZoomOnWheel()
  const bus = useUiStateBus(UI_STATE_APP_WINDOW_ID)

  const pageIndexRaw = bus.state[NOTES_PAGE_INDEX_UI_STATE_KEY]
  const pageTotalRaw = bus.state[NOTES_PAGE_TOTAL_UI_STATE_KEY]

  const { index, total } = useMemo(() => {
    const totalV = typeof pageTotalRaw === 'number' ? pageTotalRaw : typeof pageTotalRaw === 'string' ? Number(pageTotalRaw) : 1
    const indexV = typeof pageIndexRaw === 'number' ? pageIndexRaw : typeof pageIndexRaw === 'string' ? Number(pageIndexRaw) : 0
    const t = Number.isFinite(totalV) ? Math.max(1, Math.floor(totalV)) : 1
    const i = Number.isFinite(indexV) ? Math.max(0, Math.min(t - 1, Math.floor(indexV))) : 0
    return { index: i, total: t }
  }, [pageIndexRaw, pageTotalRaw])

  const outerPadding = 10
  const gap = 10

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: outerPadding,
        boxSizing: 'border-box',
        background: 'transparent'
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap, maxWidth: '100%' }}>
        <div className="subwindowRoot" style={{ width: 'auto', height: 'auto', boxShadow: 'none' }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap, padding: outerPadding }}>
          <Button
            size="sm"
            kind="icon"
            ariaLabel="上一页"
            title="上一页"
            onClick={() => postCommand('app.prevPage', {}).catch(() => undefined)}
            style={{ fontSize: 18, lineHeight: 1 }}
          >
            ‹
          </Button>

          <Button
            size="sm"
            kind="text"
            ariaLabel="页面缩略图查看菜单"
            title="页面缩略图查看菜单"
            onClick={() => postCommand('app.togglePageThumbnailsMenu', {}).catch(() => undefined)}
            style={{
              height: 40,
              minWidth: 86,
              cursor: 'pointer',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {index + 1}/{total}
          </Button>

          <Button
            size="sm"
            kind="icon"
            ariaLabel="下一页"
            title="下一页"
            onClick={() => postCommand('app.nextPage', {}).catch(() => undefined)}
            style={{ fontSize: 18, lineHeight: 1 }}
          >
            ›
          </Button>
          </div>
        </div>

        <div className="subwindowRoot" style={{ width: 'auto', height: 'auto', boxShadow: 'none' }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', padding: outerPadding }}>
            <Button
              size="sm"
              kind="icon"
              ariaLabel="新建页面"
              title="新建页面"
              onClick={() => postCommand('app.newPage', {}).catch(() => undefined)}
              style={{ fontSize: 16, lineHeight: 1 }}
            >
              ＋
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
