import React, { useEffect, useMemo, useState } from 'react'
import { FloatingToolbarApp, WINDOW_ID_FLOATING_TOOLBAR } from '../../toolbar'
import { BACKEND_URL } from '../../toolbar/utils/constants'
import { useEventsPoll } from '../../toolbar/hooks/useEventsPoll'
import { Button } from '../../button'

function useWindowType(): typeof WINDOW_ID_FLOATING_TOOLBAR | 'child' {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const w = params.get('window')
    return w === 'child' ? 'child' : WINDOW_ID_FLOATING_TOOLBAR
  }, [])
}

function ChildWindow() {
  const events = useEventsPoll()
  const [health, setHealth] = useState<string>('…')

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`)
        const json = (await res.json()) as { ok: boolean; port: number }
        setHealth(json.ok ? `ok:${json.port}` : 'bad')
      } catch {
        setHealth('offline')
      }
    }
    run()
  }, [])

  return (
    <div className="childRoot">
      <div className="childHeader">
        <div className="childTitle">子窗口</div>
        <div className="childMeta">backend: {health}</div>
      </div>

      <div className="childActions">
        <Button
          size="md"
          variant="light"
          onClick={async () => {
            await fetch(`${BACKEND_URL}/kv/hello`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ time: Date.now(), from: 'child' })
            })
          }}
        >
          写入 LevelDB
        </Button>
        <Button
          size="md"
          variant="light"
          onClick={async () => {
            await fetch(`${BACKEND_URL}/kv/hello`)
          }}
        >
          读取 LevelDB
        </Button>
      </div>

      <div className="childEvents">
        {events.slice(-8).map((e) => (
          <div key={e.id} className="childEventRow">
            <span className="childEventType">{e.type}</span>
            <span className="childEventId">#{e.id}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const windowType = useWindowType()
  return windowType === 'child' ? <ChildWindow /> : <FloatingToolbarApp />
}
