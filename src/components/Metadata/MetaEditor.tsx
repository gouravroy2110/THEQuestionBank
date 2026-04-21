import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { db } from '../../db/schema'
import type { MetaField } from '../../types'
import { SectionLabel } from '../UI'

interface Props {
  fields: MetaField[]
  onChange: (fields: MetaField[]) => void
  inheritedFields?: MetaField[]   // from project — read-only
  projectName?: string
}

// Collect all known keys from existing questions/projects for autocomplete
function useKnownKeys(): string[] {
  const questions = useLiveQuery(() => db.questions.toArray(), []) ?? []
  const projects  = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const keys = new Set<string>()
  for (const q of questions) q.metadata.forEach(m => keys.add(m.key))
  for (const p of projects)  p.metadata.forEach(m => keys.add(m.key))
  return Array.from(keys).sort()
}

export function MetaEditor({ fields, onChange, inheritedFields = [], projectName }: Props) {
  const knownKeys = useKnownKeys()

  const addField = () => onChange([...fields, { key: '', value: '' }])

  const updateField = (idx: number, patch: Partial<MetaField>) => {
    onChange(fields.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  const removeField = (idx: number) => onChange(fields.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      {/* Inherited (project) fields */}
      {inheritedFields.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>From {projectName ?? 'Project'}</SectionLabel>
          {inheritedFields.map((f, i) => (
            <div key={i} className="flex gap-2 items-center opacity-60">
              <div className="w-32 px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-muted)] truncate">{f.key}</div>
              <div className="flex-1 px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-muted)] truncate">{f.value}</div>
              <div className="w-7" /> {/* spacer for delete icon */}
            </div>
          ))}
        </div>
      )}

      {/* User fields */}
      {fields.length > 0 && <SectionLabel>Custom fields</SectionLabel>}
      {fields.map((field, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <div className="relative w-32">
            <input
              list={`meta-keys-${uuid()}`}
              className="w-full px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Key"
              value={field.key}
              onChange={e => updateField(idx, { key: e.target.value })}
            />
            <datalist id={`meta-keys-${idx}`}>
              {knownKeys.map(k => <option key={k} value={k} />)}
            </datalist>
          </div>
          <input
            className="flex-1 px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            placeholder="Value"
            value={field.value}
            onChange={e => updateField(idx, { value: e.target.value })}
          />
          <button
            onClick={() => removeField(idx)}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={13}/>
          </button>
        </div>
      ))}

      <button
        onClick={addField}
        className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors py-1"
      >
        <Plus size={13}/> Add field
      </button>
    </div>
  )
}
