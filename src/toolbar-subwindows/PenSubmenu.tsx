import React, { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from '../Framer_Motion'
import { useHyperGlassRealtimeBlur } from '../hyper_glass'
import { postCommand } from '../toolbar/hooks/useBackend'
import './styles/subwindow.css'
import './styles/PenSubmenu.css'

type PenType = 'writing' | 'highlighter' | 'laser'

// 预设颜色
const PRESET_COLORS = [
  '#000000', // 黑色
  '#FF0000', // 红色
  '#0000FF', // 蓝色
  '#00FF00', // 绿色
  '#FFFF00', // 黄色
  '#FF00FF', // 紫色
  '#FFA500', // 橙色
  '#00FFFF', // 青色
  '#FFFFFF', // 白色
]

// Word 风格的彩色铅笔/钢笔图标（侧视图）
function WritingPenIcon({ color = '#333' }: { color?: string }) {
  return (
    <svg viewBox="0 0 48 24" width="48" height="24">
      {/* 笔尖 */}
      <path d="M2 12 L8 8 L8 16 Z" fill={color} />
      {/* 笔杆金属环 */}
      <rect x="8" y="9" width="3" height="6" fill="#C0C0C0" />
      {/* 笔杆主体 */}
      <rect x="11" y="7" width="30" height="10" rx="1" fill={color} />
      {/* 笔杆高光 */}
      <rect x="13" y="8" width="26" height="3" rx="0.5" fill="rgba(255,255,255,0.3)" />
      {/* 笔尾 */}
      <rect x="41" y="8" width="4" height="8" rx="1" fill={color} />
    </svg>
  )
}

function HighlighterIcon({ color = '#FFEB3B' }: { color?: string }) {
  return (
    <svg viewBox="0 0 48 24" width="48" height="24">
      {/* 笔尖 - 荧光笔特有的斜切形状 */}
      <path d="M2 12 L10 6 L10 18 Z" fill={color} />
      {/* 笔杆 - 较粗的方形 */}
      <rect x="10" y="5" width="32" height="14" rx="2" fill={color} />
      {/* 笔帽/笔尾 */}
      <rect x="42" y="7" width="4" height="10" rx="1" fill={color} />
      <rect x="42" y="7" width="4" height="10" rx="1" fill="rgba(0,0,0,0.1)" />
      {/* 高光 */}
      <rect x="12" y="7" width="28" height="4" rx="1" fill="rgba(255,255,255,0.4)" />
    </svg>
  )
}

function LaserPenIcon({ color = '#2196F3' }: { color?: string }) {
  return (
    <svg viewBox="0 0 48 24" width="48" height="24">
      {/* 激光发射口 */}
      <circle cx="5" cy="12" r="3" fill="#FF5722" />
      {/* 笔尖金属部分 */}
      <rect x="8" y="10" width="4" height="4" fill="#C0C0C0" />
      {/* 笔杆 */}
      <rect x="12" y="8" width="28" height="8" rx="1" fill={color} />
      {/* 按钮 */}
      <rect x="20" y="6" width="8" height="3" rx="1" fill="#FF5722" />
      {/* 高光 */}
      <rect x="14" y="9" width="24" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" />
      {/* 笔尾 */}
      <rect x="40" y="9" width="4" height="6" rx="1" fill={color} />
    </svg>
  )
}

// 笔类型配置
const PEN_TYPES: { type: PenType; label: string; icon: (color: string) => React.ReactNode; defaultColor: string }[] = [
  {
    type: 'writing',
    label: '书写笔',
    icon: (color) => <WritingPenIcon color={color} />,
    defaultColor: '#333333',
  },
  {
    type: 'highlighter',
    label: '荧光笔',
    icon: (color) => <HighlighterIcon color={color} />,
    defaultColor: '#FFEB3B',
  },
  {
    type: 'laser',
    label: '激光笔',
    icon: (color) => <LaserPenIcon color={color} />,
    defaultColor: '#2196F3',
  },
]

// 颜色按钮组件
function ColorButton({
  color,
  isActive,
  onClick,
}: {
  color: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      className={`penColorButton ${isActive ? 'penColorButton--active' : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      style={{ backgroundColor: color }}
      title={color}
    >
      {isActive && (
        <motion.div
          className="penColorCheck"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.15 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  )
}

// 笔类型按钮组件（带前推动画）
function PenTypeButton({
  type,
  label,
  icon,
  iconColor,
  isActive,
  onClick,
}: {
  type: PenType
  label: string
  icon: (color: string) => React.ReactNode
  iconColor: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      className={`penTypeCard ${isActive ? 'penTypeCard--active' : ''}`}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      animate={
        isActive
          ? {
              y: -6,
              boxShadow: '0 12px 24px rgba(0,0,0,0.12), 0 6px 12px rgba(0,0,0,0.08)',
            }
          : {
              y: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }
      }
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <motion.div
        className="penTypeIcon"
        animate={
          isActive
            ? {
                scale: 1.15,
                y: -3,
                filter: 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.4))',
              }
            : {
                scale: 1,
                y: 0,
                filter: 'drop-shadow(0 0 0 transparent)',
              }
        }
        transition={{ duration: 0.2 }}
      >
        {icon(iconColor)}
      </motion.div>
      <span className="penTypeLabel">{label}</span>
      <motion.span
        className="penTypeIndicator"
        animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
    </motion.button>
  )
}

// 粗细滑块组件
function ThicknessSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="penThicknessControl">
      <span className="penThicknessLabel">粗细</span>
      <div className="penSliderContainer">
        <input
          type="range"
          min="1"
          max="50"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="penSlider"
        />
        <div
          className="penSliderTrack"
          style={{ width: `${(value / 50) * 100}%` }}
        />
      </div>
      <span className="penThicknessValue">{value}px</span>
    </div>
  )
}

// 主组件
export function PenSubmenu(props: { kind: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()
  
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [selectedPenType, setSelectedPenType] = useState<PenType>('writing')
  const [thickness, setThickness] = useState(12)

  useHyperGlassRealtimeBlur({ root: rootRef.current })

  // 监听尺寸变化并通知主进程调整窗口大小
  useEffect(() => {
    const root = rootRef.current
    const card = cardRef.current
    const measure = measureRef.current
    if (!root) return
    if (typeof ResizeObserver === 'undefined') return

    let lastHeight = 0
    let lastWidth = 0
    let rafId = 0

    const send = () => {
      rafId = 0
      const measureRect = measure?.getBoundingClientRect()
      const contentWidth = Math.max(measure?.scrollWidth ?? 0, measureRect?.width ?? 0)
      const contentHeight = Math.max(measure?.scrollHeight ?? 0, measureRect?.height ?? 0)
      const width = Math.max(280, Math.min(1600, Math.ceil(contentWidth) + 26))
      const height = Math.max(60, Math.min(900, Math.ceil(contentHeight) + 26))
      if (width === lastWidth && height === lastHeight) return
      lastWidth = width
      lastHeight = height
      postCommand('set-subwindow-bounds', { kind: props.kind, width, height }).catch(() => undefined)
    }

    const schedule = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(send)
    }

    const ro = new ResizeObserver(schedule)
    ro.observe(root)
    if (card) ro.observe(card)
    if (measure) ro.observe(measure)
    schedule()

    return () => {
      ro.disconnect()
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [props.kind])

  const getColorName = (color: string) => {
    const colorNames: Record<string, string> = {
      '#000000': '黑色',
      '#FF0000': '红色',
      '#0000FF': '蓝色',
      '#00FF00': '绿色',
      '#FFFF00': '黄色',
      '#FF00FF': '紫色',
      '#FFA500': '橙色',
      '#00FFFF': '青色',
      '#FFFFFF': '白色',
    }
    return colorNames[color] || '自定义'
  }

  // 应用笔设置
  const applyPenSettings = () => {
    void postCommand('app.setPenSettings', {
      type: selectedPenType,
      color: selectedColor,
      thickness: thickness
    })
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
        <div ref={measureRef} className="subwindowMeasure">
          {/* 标题 */}
          <div className="subwindowTitle">
            <span>笔设置</span>
            <span className="subwindowMeta">{props.kind}</span>
          </div>

          {/* 主内容区：颜色 + 笔类型 */}
          <div className="penSubmenuGrid">
            {/* 左侧：颜色九宫格 */}
            <div className="penColorSection">
              <div className="penColorGrid">
                {PRESET_COLORS.map((color) => (
                  <ColorButton
                    key={color}
                    color={color}
                    isActive={selectedColor === color}
                    onClick={() => {
                      setSelectedColor(color)
                      applyPenSettings()
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 右侧：笔类型选择 */}
            <div className="penTypeSection">
              {PEN_TYPES.map((pen) => (
                <PenTypeButton
                  key={pen.type}
                  type={pen.type}
                  label={pen.label}
                  icon={pen.icon}
                  iconColor={pen.type === 'writing' ? selectedColor : pen.defaultColor}
                  isActive={selectedPenType === pen.type}
                  onClick={() => {
                    setSelectedPenType(pen.type)
                    applyPenSettings()
                  }}
                />
              ))}
            </div>
          </div>

          {/* 粗细滑块 */}
          <div className="penSubmenuDivider" />
          <ThicknessSlider 
            value={thickness} 
            onChange={(value) => {
              setThickness(value)
              applyPenSettings()
            }} 
          />

          {/* 底部状态栏 */}
          <div className="penSubmenuDivider" />
          <div className="penSubmenuFooter">
            <div className="penStatusInfo">
              <span className="penStatusName">
                {PEN_TYPES.find((p) => p.type === selectedPenType)?.label}
              </span>
              <span className="penStatusParams">{thickness}px</span>
              <span
                className="penStatusColor"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="penStatusColorName">
                {getColorName(selectedColor)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
