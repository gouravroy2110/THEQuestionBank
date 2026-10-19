import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Modal, Button } from '../UI'
import type { Workspace } from '../../types'
import { WORKSPACE_PALETTE, saveWorkspace } from '../../db/workspaces'
import { Layers } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  workspace?: Workspace | null
  onSave?: (saved: Workspace) => void
}

export function WorkspaceModal({ open, onClose, workspace, onSave }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(WORKSPACE_PALETTE[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setDescription(workspace.description ?? '')
      setColor(workspace.color || WORKSPACE_PALETTE[0])
    } else {
      setName('')
      setDescription('')
      setColor(WORKSPACE_PALETTE[0])
    }
  }, [workspace, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    const now = Date.now()
    const record: Workspace = {
      id: workspace?.id ?? uuid(),
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      createdAt: workspace?.createdAt ?? now,
      updatedAt: now,
    }

    await saveWorkspace(record)
    setSaving(false)
    onSave?.(record)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={workspace ? 'Edit Workspace' : 'New Workspace'}
      width="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Workspace Name
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="e.g. GATE CSE, College Prep, Job Interviews..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Description (Optional)
          </label>
          <textarea
            className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
            placeholder="What is this workspace for?"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Accent Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {WORKSPACE_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!name.trim()}>
            {workspace ? 'Save Changes' : 'Create Workspace'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
