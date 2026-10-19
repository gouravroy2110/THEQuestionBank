import { db, DEFAULT_WORKSPACE_ID, getSetting, setSetting } from './schema'
import type { Workspace } from '../types'
import { broadcast } from '../hooks/useBroadcast'

export const WORKSPACE_PALETTE = [
  '#0078d4', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f43f5e', '#64748b',
]

/**
 * Ensures at least one workspace exists.
 */
export async function ensureDefaultWorkspace(): Promise<Workspace> {
  const count = await db.workspaces.count()
  if (count === 0) {
    const now = Date.now()
    const def: Workspace = {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Default Workspace',
      description: 'Default workspace',
      color: '#0078d4',
      createdAt: now,
      updatedAt: now,
    }
    await db.workspaces.put(def)
    await setSetting('activeWorkspaceId', def.id)
    return def
  }
  const first = await db.workspaces.toCollection().first()
  return first!
}

/**
 * Get active workspace ID from settings, falling back to default or first workspace.
 */
export async function getActiveWorkspaceId(): Promise<string> {
  const id = await getSetting<string>('activeWorkspaceId')
  if (id) {
    const exists = await db.workspaces.get(id)
    if (exists) return id
  }
  const def = await ensureDefaultWorkspace()
  return def.id
}

/**
 * Switch active workspace and broadcast to open tabs.
 */
export async function setActiveWorkspaceId(id: string): Promise<void> {
  await setSetting('activeWorkspaceId', id)
  broadcast({ type: 'workspace:switched', payload: { id } })
}

/**
 * Save or update a workspace.
 */
export async function saveWorkspace(ws: Workspace): Promise<void> {
  await db.workspaces.put({ ...ws, updatedAt: Date.now() })
  broadcast({ type: 'workspace:saved', payload: { id: ws.id } })
}

/**
 * Delete a workspace and its associated questions, projects, and tags.
 * Will not delete if only 1 workspace remains.
 */
export async function deleteWorkspace(id: string): Promise<{ success: boolean; error?: string }> {
  const count = await db.workspaces.count()
  if (count <= 1) {
    return { success: false, error: 'Cannot delete the only remaining workspace.' }
  }

  await db.transaction('rw', db.workspaces, db.questions, db.projects, db.tags, db.settings, async () => {
    // Delete all questions in this workspace
    await db.questions.where('workspaceId').equals(id).delete()
    // Delete all projects in this workspace
    await db.projects.where('workspaceId').equals(id).delete()
    // Delete all tags in this workspace
    await db.tags.where('workspaceId').equals(id).delete()
    // Delete workspace itself
    await db.workspaces.delete(id)

    // If active workspace was deleted, switch to another remaining workspace
    const activeId = await getSetting<string>('activeWorkspaceId')
    if (activeId === id) {
      const remaining = await db.workspaces.toCollection().first()
      if (remaining) {
        await setSetting('activeWorkspaceId', remaining.id)
        broadcast({ type: 'workspace:switched', payload: { id: remaining.id } })
      }
    }
  })

  broadcast({ type: 'workspace:deleted', payload: { id } })
  return { success: true }
}
