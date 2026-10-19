import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Check, Layers, Sparkles, FolderPlus } from 'lucide-react'
import type { Workspace } from '../../types'
import { db } from '../../db/schema'
import { useLiveQuery } from 'dexie-react-hooks'

interface Props {
  open: boolean
  onClose: () => void
  activeWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onOpenNewWorkspaceModal: () => void
}

const TOTAL_SLOTS = 8
const NEW_WS_SLOT_INDEX = 7 // Reserved wedge (top-left, just before 12 o'clock)
const R_OUT = 175
const R_IN = 95
const R_CENTER = 86
const GAP_DEG = 1.8

function polarToCartesian(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: r * Math.cos(rad),
    y: r * Math.sin(rad),
  }
}

function makeWedgePath(startDeg: number, endDeg: number, rIn: number, rOut: number) {
  const p1 = polarToCartesian(rIn, startDeg)
  const p2 = polarToCartesian(rIn, endDeg)
  const p3 = polarToCartesian(rOut, endDeg)
  const p4 = polarToCartesian(rOut, startDeg)

  const largeArc = endDeg - startDeg > 180 ? 1 : 0

  return `M ${p1.x} ${p1.y} A ${rIn} ${rIn} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rOut} ${rOut} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`
}

export function CircularWorkspaceSwitcher({
  open,
  onClose,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenNewWorkspaceModal,
}: Props) {
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('updatedAt').reverse().toArray(), []) ?? []
  const questionCounts = useLiveQuery(async () => {
    const list = await db.questions.toArray()
    const counts: Record<string, number> = {}
    for (const q of list) {
      const ws = q.workspaceId || 'default-workspace'
      counts[ws] = (counts[ws] || 0) + 1
    }
    return counts
  }, []) ?? {}

  // Order workspaces with active workspace first, followed by others sorted by recent activity
  const sortedWorkspaces = useMemo(() => {
    if (workspaces.length === 0) return []
    const active = workspaces.find(w => w.id === activeWorkspaceId)
    const rest = workspaces.filter(w => w.id !== activeWorkspaceId)
    return active ? [active, ...rest] : workspaces
  }, [workspaces, activeWorkspaceId])

  // Map slots: 0 to 6 are workspace slots, 7 is "New Workspace"
  const slots = useMemo(() => {
    const res: Array<{
      type: 'workspace' | 'new' | 'empty'
      workspace?: Workspace
      index: number
    }> = []

    // Workspace slots (up to 7)
    let wsIdx = 0
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (i === NEW_WS_SLOT_INDEX) {
        res.push({ type: 'new', index: i })
      } else {
        if (wsIdx < sortedWorkspaces.length && wsIdx < TOTAL_SLOTS - 1) {
          res.push({ type: 'workspace', workspace: sortedWorkspaces[wsIdx], index: i })
          wsIdx++
        } else {
          res.push({ type: 'empty', index: i })
        }
      }
    }
    return res
  }, [sortedWorkspaces])

  // Focused slot index
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Reset focus to active workspace when opened
  useEffect(() => {
    if (open) {
      setFocusedIndex(0)
    }
  }, [open])

  const commitSelection = useCallback(
    (index: number) => {
      const item = slots[index]
      if (!item) return
      if (item.type === 'workspace' && item.workspace) {
        onSelectWorkspace(item.workspace.id)
        onClose()
      } else if (item.type === 'new') {
        onClose()
        onOpenNewWorkspaceModal()
      }
    },
    [slots, onSelectWorkspace, onClose, onOpenNewWorkspaceModal]
  )

  // Keyboard navigation when open
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          // Counter-clockwise
          setFocusedIndex(i => (i - 1 + TOTAL_SLOTS) % TOTAL_SLOTS)
        } else {
          // Clockwise
          setFocusedIndex(i => (i + 1) % TOTAL_SLOTS)
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(i => (i + 1) % TOTAL_SLOTS)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(i => (i - 1 + TOTAL_SLOTS) % TOTAL_SLOTS)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        commitSelection(focusedIndex)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, focusedIndex, commitSelection, onClose])

  if (!open) return null

  const sliceAngle = 360 / TOTAL_SLOTS
  const focusedSlot = slots[focusedIndex]
  const focusedMidAngle = -90 + focusedIndex * sliceAngle

  // Pointer triangle coordinates at circumference of center circle
  const pointerTip = polarToCartesian(R_CENTER + 7, focusedMidAngle)
  const pointerBase1 = polarToCartesian(R_CENTER - 3, focusedMidAngle - 7)
  const pointerBase2 = polarToCartesian(R_CENTER - 3, focusedMidAngle + 7)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Switcher Header Badge */}
        <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] shadow-lg">
          <Layers size={13} className="text-[var(--accent)]" />
          <span className="font-medium">Quick Workspace Switcher</span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            Tab / ↵
          </span>
        </div>

        {/* Circular Wheel SVG */}
        <div className="relative w-[380px] h-[380px] drop-shadow-2xl">
          <svg
            viewBox="-200 -200 400 400"
            className="w-full h-full overflow-visible"
          >
            <defs>
              {/* Radial gradient for center disc */}
              <radialGradient id="centerDiscGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#252526" />
                <stop offset="85%" stopColor="#1e1e1e" />
                <stop offset="100%" stopColor="#141414" />
              </radialGradient>
              {/* Outer halo blur filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background outer track ring */}
            <circle
              cx="0"
              cy="0"
              r={R_OUT + 4}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.4"
            />
            <circle
              cx="0"
              cy="0"
              r={R_IN - 4}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.4"
            />

            {/* Wedges */}
            {slots.map(slot => {
              const startDeg = -90 - sliceAngle / 2 + slot.index * sliceAngle + GAP_DEG / 2
              const endDeg = -90 + sliceAngle / 2 + slot.index * sliceAngle - GAP_DEG / 2
              const midDeg = -90 + slot.index * sliceAngle
              const isFocused = slot.index === focusedIndex
              const midPos = polarToCartesian((R_IN + R_OUT) / 2, midDeg)

              if (slot.type === 'new') {
                return (
                  <g
                    key={`slot-${slot.index}`}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setFocusedIndex(slot.index)}
                    onClick={() => commitSelection(slot.index)}
                  >
                    <path
                      d={makeWedgePath(startDeg, endDeg, R_IN, R_OUT)}
                      fill={isFocused ? 'rgba(0, 120, 212, 0.22)' : 'rgba(37, 37, 38, 0.85)'}
                      stroke={isFocused ? 'var(--accent)' : 'var(--border)'}
                      strokeWidth={isFocused ? 2 : 1}
                      strokeDasharray={isFocused ? undefined : '3 3'}
                    />
                    {/* Plus Icon at Midpoint */}
                    <g transform={`translate(${midPos.x}, ${midPos.y})`}>
                      <circle
                        r="14"
                        fill={isFocused ? 'var(--accent)' : 'var(--bg-elevated)'}
                        stroke={isFocused ? '#ffffff' : 'var(--border)'}
                        strokeWidth="1.5"
                      />
                      <path
                        d="M -5 0 L 5 0 M 0 -5 L 0 5"
                        stroke={isFocused ? '#ffffff' : 'var(--accent)'}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                )
              }

              if (slot.type === 'empty') {
                return (
                  <g
                    key={`slot-${slot.index}`}
                    className="cursor-default"
                    onMouseEnter={() => setFocusedIndex(slot.index)}
                  >
                    <path
                      d={makeWedgePath(startDeg, endDeg, R_IN, R_OUT)}
                      fill={isFocused ? 'rgba(255, 255, 255, 0.04)' : 'rgba(24, 24, 24, 0.4)'}
                      stroke="var(--border)"
                      strokeWidth={isFocused ? 1.5 : 0.8}
                      strokeDasharray="4 4"
                      opacity={isFocused ? 0.8 : 0.4}
                    />
                    {/* Empty indicator dot */}
                    <circle
                      cx={midPos.x}
                      cy={midPos.y}
                      r="3.5"
                      fill="var(--text-muted)"
                      opacity={isFocused ? 0.6 : 0.25}
                    />
                  </g>
                )
              }

              // Workspace slot
              const ws = slot.workspace!
              const wsColor = ws.color || '#0078d4'
              const isActive = ws.id === activeWorkspaceId

              return (
                <g
                  key={`slot-${slot.index}`}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setFocusedIndex(slot.index)}
                  onClick={() => commitSelection(slot.index)}
                >
                  <path
                    d={makeWedgePath(startDeg, endDeg, R_IN, R_OUT)}
                    fill={
                      isFocused
                        ? 'rgba(40, 40, 42, 0.95)'
                        : isActive
                        ? 'rgba(30, 30, 30, 0.9)'
                        : 'rgba(24, 24, 24, 0.8)'
                    }
                    stroke={
                      isFocused
                        ? wsColor
                        : isActive
                        ? 'var(--accent)'
                        : 'var(--border)'
                    }
                    strokeWidth={isFocused ? 2.5 : isActive ? 1.5 : 1}
                  />

                  {/* Icon & Initial at Midpoint */}
                  <g transform={`translate(${midPos.x}, ${midPos.y})`}>
                    <circle
                      r="15"
                      fill={isFocused ? wsColor : 'var(--bg-elevated)'}
                      stroke={wsColor}
                      strokeWidth={isFocused ? 2 : 1.5}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isFocused ? '#ffffff' : 'var(--text-primary)'}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="var(--font-display, sans-serif)"
                    >
                      {ws.name.slice(0, 2).toUpperCase()}
                    </text>
                    {isActive && (
                      <circle
                        cx="10"
                        cy="-10"
                        r="3.5"
                        fill="#10b981"
                        stroke="#1e1e1e"
                        strokeWidth="1"
                      />
                    )}
                  </g>
                </g>
              )
            })}

            {/* Center Disc */}
            <circle
              cx="0"
              cy="0"
              r={R_CENTER}
              fill="url(#centerDiscGrad)"
              stroke="var(--border-bright)"
              strokeWidth="2"
            />

            {/* Pointer arrow on center circle perimeter */}
            <polygon
              points={`${pointerTip.x},${pointerTip.y} ${pointerBase1.x},${pointerBase1.y} ${pointerBase2.x},${pointerBase2.y}`}
              fill="var(--accent)"
            />
          </svg>

          {/* Center Hub HTML Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
            {focusedSlot?.type === 'workspace' && focusedSlot.workspace ? (
              <div className="flex flex-col items-center max-w-[140px] animate-fade-in">
                <span
                  className="w-3 h-3 rounded-full mb-1.5 shadow-sm"
                  style={{ background: focusedSlot.workspace.color || '#0078d4' }}
                />
                <h3 className="font-display font-bold text-sm text-[var(--text-primary)] leading-tight line-clamp-2">
                  {focusedSlot.workspace.name}
                </h3>
                <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                  {(questionCounts[focusedSlot.workspace.id] || 0)} questions
                </span>
                {focusedSlot.workspace.id === activeWorkspaceId && (
                  <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                )}
              </div>
            ) : focusedSlot?.type === 'new' ? (
              <div className="flex flex-col items-center max-w-[140px] animate-fade-in">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center mb-1">
                  <Plus size={14} />
                </div>
                <h3 className="font-display font-bold text-xs text-[var(--accent)] leading-tight">
                  New Workspace
                </h3>
                <span className="text-[10px] text-[var(--text-muted)] mt-1">
                  Create fresh workspace
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center max-w-[140px] text-[var(--text-muted)] animate-fade-in">
                <span className="text-xs font-medium">Empty Slot</span>
                <span className="text-[10px] opacity-70 mt-0.5">No workspace</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer instructions */}
        <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>Tab / Shift+Tab to rotate</span>
          <span>•</span>
          <span>Enter or Click to select</span>
          <span>•</span>
          <span>Esc to cancel</span>
        </div>
      </div>
    </div>
  )
}
