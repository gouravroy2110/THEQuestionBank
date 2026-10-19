import { useState, useRef } from 'react'
import { Download, Upload, AlertCircle, CheckCircle2, Layers, FolderDown } from 'lucide-react'
import {
  exportAll,
  exportWorkspace,
  exportFiltered,
  downloadJSON,
  importBundle,
  readJSONFile,
  type ImportMode,
} from '../../utils/exportUtils'
import type { Workspace } from '../../types'
import { Modal, Button } from '../UI'
import { broadcast } from '../../hooks/useBroadcast'

interface Props {
  open: boolean
  onClose: () => void
  filteredIds?: string[] // if provided, show "export filtered" option
  activeWorkspace?: Workspace | null
}

export function ExportImportModal({ open, onClose, filteredIds, activeWorkspace }: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('skip')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExportAll = async () => {
    setLoading(true)
    const bundle = await exportAll()
    downloadJSON(bundle, `mockbank-backup-all-${new Date().toISOString().slice(0, 10)}.json`)
    setMessage({
      type: 'ok',
      text: `Exported full backup: ${bundle.workspaces?.length ?? 0} workspaces, ${bundle.questions.length} questions.`,
    })
    setLoading(false)
  }

  const handleExportWorkspace = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    const bundle = await exportWorkspace(activeWorkspace.id)
    const safeName = activeWorkspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadJSON(bundle, `mockbank-${safeName}-${new Date().toISOString().slice(0, 10)}.json`)
    setMessage({
      type: 'ok',
      text: `Exported workspace "${activeWorkspace.name}": ${bundle.questions.length} questions.`,
    })
    setLoading(false)
  }

  const handleExportFiltered = async () => {
    if (!filteredIds) return
    setLoading(true)
    const bundle = await exportFiltered(filteredIds)
    downloadJSON(bundle, `mockbank-filtered-${new Date().toISOString().slice(0, 10)}.json`)
    setMessage({ type: 'ok', text: `Exported ${bundle.questions.length} questions.` })
    setLoading(false)
  }

  const handleImport = async (file: File) => {
    setLoading(true)
    setMessage(null)
    try {
      const bundle = await readJSONFile(file)
      const result = await importBundle(bundle, importMode, activeWorkspace?.id)
      broadcast({ type: 'workspace:saved', payload: { id: '' } })
      broadcast({ type: 'tags:changed', payload: {} })
      broadcast({ type: 'project:saved', payload: { id: '' } })
      const wsCount = result.workspaces > 0 ? `${result.workspaces} workspaces, ` : ''
      setMessage({
        type: 'ok',
        text: `Imported: ${wsCount}${result.questions} questions, ${result.projects} projects, ${result.tags} tags. Skipped: ${result.skipped}.`,
      })
    } catch (err) {
      setMessage({ type: 'err', text: `Import failed: ${(err as Error).message}` })
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Export / Import" width="max-w-md">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] rounded-lg mb-5">
        {(['export', 'import'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              setMessage(null)
            }}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
              tab === t
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'export' ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            Exports database records as JSON. Image files remain referenced by UUID — keep your local image folder safe.
          </p>

          <Button
            variant="outline"
            size="sm"
            icon={<Layers size={13} />}
            loading={loading}
            onClick={handleExportAll}
            className="w-full justify-center"
          >
            Export All Workspaces (Full Backup)
          </Button>

          {activeWorkspace && (
            <Button
              variant="outline"
              size="sm"
              icon={<FolderDown size={13} />}
              loading={loading}
              onClick={handleExportWorkspace}
              className="w-full justify-center text-xs"
            >
              Export "{activeWorkspace.name}" Only
            </Button>
          )}

          {filteredIds && filteredIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={13} />}
              loading={loading}
              onClick={handleExportFiltered}
              className="w-full justify-center border border-dashed border-[var(--border)]"
            >
              Export Filtered ({filteredIds.length} questions)
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Import from a previously exported JSON backup file (supports v1 and v2 formats).
          </p>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">On conflict</p>
            <div className="flex gap-2">
              {(['skip', 'overwrite'] as ImportMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setImportMode(m)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs capitalize transition-all ${
                    importMode === m
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] font-medium'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<Upload size={13} />}
            onClick={() => fileRef.current?.click()}
            className="w-full justify-center"
          >
            Choose JSON file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleImport(f)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* Feedback */}
      {message && (
        <div
          className={`mt-4 flex items-start gap-2 p-3 rounded-lg text-xs ${
            message.type === 'ok'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}
    </Modal>
  )
}
