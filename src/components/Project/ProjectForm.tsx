import { useState, useEffect } from 'react'
import type { Project } from '../../types'
import { newProject, saveProject } from '../../db/projects'
import { TagInput } from '../Tags/TagInput'
import { MetaEditor } from '../Metadata/MetaEditor'
import { Modal, Button, TextInput, Textarea, SectionLabel } from '../UI'
import { broadcast } from '../../hooks/useBroadcast'

const COLORS = [
  '#f59e0b','#10b981','#0ea5e9','#8b5cf6',
  '#f43f5e','#06b6d4','#84cc16','#f97316',
  '#ec4899','#14b8a6','#a855f7','#eab308',
]

interface Props {
  open: boolean
  project?: Project | null  // null = create new
  onClose: () => void
  onSaved?: (p: Project) => void
}

export function ProjectForm({ open, project, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Project>(newProject())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(project ? { ...project } : newProject())
  }, [open, project])

  const update = (patch: Partial<Project>) => setForm(f => ({ ...f, ...patch }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await saveProject(form)
    broadcast({ type: 'project:saved', payload: { id: form.id } })
    setSaving(false)
    onSaved?.(form)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit Project' : 'New Project'}
      width="max-w-xl"
    >
      <div className="space-y-5">
        {/* Name + color */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <TextInput
              label="Project Name"
              placeholder="e.g. JEE Mock Series — April 2025"
              value={form.name}
              onChange={e => update({ name: e.target.value })}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap pb-0.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <Textarea
          label="Description"
          placeholder="Optional notes about this project…"
          value={form.description}
          onChange={e => update({ description: e.target.value })}
          rows={2}
        />

        <div>
          <SectionLabel>Project Tags</SectionLabel>
          <p className="text-[11px] text-[var(--text-muted)] mb-2">These tags are inherited by all questions in this project</p>
          <TagInput
            selectedIds={form.tagIds}
            onChange={tagIds => update({ tagIds })}
          />
        </div>

        <div>
          <SectionLabel>Project Metadata</SectionLabel>
          <p className="text-[11px] text-[var(--text-muted)] mb-2">These fields appear in all questions under this project</p>
          <MetaEditor
            fields={form.metadata}
            onChange={metadata => update({ metadata })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}
            disabled={!form.name.trim()}>
            {project ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
