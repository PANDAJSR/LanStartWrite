import React from 'react'
import {
  UI_STATE_APP_WINDOW_ID,
  WHITEBOARD_BG_COLOR_KV_KEY,
  WHITEBOARD_BG_COLOR_UI_STATE_KEY,
  WHITEBOARD_BG_IMAGE_URL_KV_KEY,
  WHITEBOARD_BG_IMAGE_URL_UI_STATE_KEY,
  isFileOrDataUrl,
  isHexColor,
  usePersistedState,
  useUiStateBus
} from '../status'

export function PaintBoardBackgroundApp() {
  const [persistedBg] = usePersistedState(WHITEBOARD_BG_COLOR_KV_KEY, '#ffffff', { validate: isHexColor })
  const [persistedBgImageUrl] = usePersistedState(WHITEBOARD_BG_IMAGE_URL_KV_KEY, '', { validate: isFileOrDataUrl })
  const bus = useUiStateBus(UI_STATE_APP_WINDOW_ID)
  const uiBg = bus.state[WHITEBOARD_BG_COLOR_UI_STATE_KEY]
  const bg = isHexColor(uiBg) ? uiBg : persistedBg
  const uiBgImageUrl = bus.state[WHITEBOARD_BG_IMAGE_URL_UI_STATE_KEY]
  const bgImageUrl = isFileOrDataUrl(uiBgImageUrl) ? uiBgImageUrl : persistedBgImageUrl

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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${bgImageUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.5,
            pointerEvents: 'none'
          }}
        />
      ) : null}
    </div>
  )
}
