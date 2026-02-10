import React from 'react'
import {
  UI_STATE_APP_WINDOW_ID,
  WHITEBOARD_BG_COLOR_KV_KEY,
  WHITEBOARD_BG_COLOR_UI_STATE_KEY,
  WHITEBOARD_BG_IMAGE_OPACITY_KV_KEY,
  WHITEBOARD_BG_IMAGE_OPACITY_UI_STATE_KEY,
  WHITEBOARD_BG_IMAGE_URL_KV_KEY,
  WHITEBOARD_BG_IMAGE_URL_UI_STATE_KEY,
  isFileOrDataUrl,
  isHexColor,
  usePersistedState,
  useUiStateBus
} from '../status'

function coerceOpacity(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(1, n))
}

export function PaintBoardBackgroundApp() {
  const [persistedBg] = usePersistedState(WHITEBOARD_BG_COLOR_KV_KEY, '#ffffff', { validate: isHexColor })
  const [persistedBgImageUrl] = usePersistedState(WHITEBOARD_BG_IMAGE_URL_KV_KEY, '', { validate: isFileOrDataUrl })
  const [persistedBgImageOpacity] = usePersistedState(WHITEBOARD_BG_IMAGE_OPACITY_KV_KEY, 0.5, {
    validate: (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  })
  const bus = useUiStateBus(UI_STATE_APP_WINDOW_ID)
  const uiBg = bus.state[WHITEBOARD_BG_COLOR_UI_STATE_KEY]
  const bg = isHexColor(uiBg) ? uiBg : persistedBg
  const uiBgImageUrl = bus.state[WHITEBOARD_BG_IMAGE_URL_UI_STATE_KEY]
  const bgImageUrl = isFileOrDataUrl(uiBgImageUrl) ? uiBgImageUrl : persistedBgImageUrl
  const uiBgImageOpacity = bus.state[WHITEBOARD_BG_IMAGE_OPACITY_UI_STATE_KEY]
  const bgImageOpacity = coerceOpacity(uiBgImageOpacity) ?? persistedBgImageOpacity

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: bg,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {bgImageUrl ? (
        <img
          src={bgImageUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: bgImageOpacity,
            pointerEvents: 'none'
          }}
        />
      ) : null}
    </div>
  )
}
