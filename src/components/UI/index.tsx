import { type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'outline'
type BtnSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
  icon?: ReactNode
}

const btnBase = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none'

const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-[var(--accent)] text-white hover:opacity-90 active:scale-95',
  ghost:   'text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] active:scale-95',
  danger:  'bg-rose-600 text-white hover:bg-rose-500 active:scale-95',
  outline: 'border border-[var(--border-bright)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({ variant='outline', size='md', loading, icon, children, className='', ...props }: ButtonProps) {
  return (
    <button
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const statusStyles: Record<string, string> = {
  wrong:       'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  partial:     'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  correct:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  unattempted: 'bg-[var(--bg-overlay)] text-[var(--text-muted)] border border-[var(--border)]',
}
const statusLabels: Record<string, string> = {
  wrong: 'Wrong', partial: 'Partial', correct: 'Correct', unattempted: 'Unattempted',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[status] ?? statusStyles.unattempted}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}

// ─── DifficultyBadge ──────────────────────────────────────────────────────────
const diffStyles: Record<string, string> = {
  easy:   'bg-emerald-500/10 text-emerald-400',
  medium: 'bg-sky-500/10 text-sky-400',
  hard:   'bg-rose-500/10 text-rose-400',
  unseen: 'bg-violet-500/10 text-violet-400',
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize ${diffStyles[difficulty] ?? diffStyles.unseen}`}>
      {difficulty}
    </span>
  )
}

// ─── TagChip ──────────────────────────────────────────────────────────────────
interface TagChipProps {
  name: string
  color: string
  onRemove?: () => void
  dimmed?: boolean
  size?: 'sm' | 'md'
}

export function TagChip({ name, color, onRemove, dimmed, size = 'md' }: TagChipProps) {
  const bg = `${color}22`
  const border = `${color}55`
  const text = color
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium transition-opacity ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} ${dimmed ? 'opacity-50' : ''}`}
      style={{ background: bg, borderColor: border, color: text }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 transition-opacity ml-0.5">
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-xl' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] flex flex-col`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h2 className="font-display font-semibold text-base text-[var(--text-primary)]">{title}</h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-[var(--border)] my-4" />
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-[var(--border)]" />
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <div className="flex-1 border-t border-[var(--border)]" />
    </div>
  )
}

// ─── TextInput / Textarea ─────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}
export function TextInput({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors ${className}`}
        {...props}
      />
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}
export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>}
      <textarea
        className={`w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors resize-none font-mono ${className}`}
        {...props}
      />
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}
export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>}
      <select
        className={`w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors cursor-pointer ${className}`}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-sm">
      <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-[var(--text-muted)] opacity-50">{icon}</div>
      <div>
        <p className="font-display font-semibold text-[var(--text-secondary)]">{title}</p>
        {description && <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-[var(--border-bright)] border-t-[var(--accent)] animate-spin"
      style={{ width: size, height: size }}
    />
  )
}

// ─── SectionLabel ────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
      {children}
    </span>
  )
}
