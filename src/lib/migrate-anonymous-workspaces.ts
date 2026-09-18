import { createAdminClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

type WorkspaceRow = {
  id: string
  canvas_snapshot_path: string | null
}

function isStorageNotFound(error: { message?: string; statusCode?: string } | null): boolean {
  if (!error) return true
  const status = String(error.statusCode ?? '')
  const msg = (error.message ?? '').toLowerCase()
  return status === '404' || msg.includes('not found') || msg.includes('object not found')
}

async function migrateOneWorkspace(
  admin: SupabaseClient,
  workspace: WorkspaceRow,
  oldUserId: string,
  newUserId: string,
): Promise<{ error?: string }> {
  const oldPath = workspace.canvas_snapshot_path ?? `${oldUserId}/${workspace.id}/snapshot.json`
  const newPath = `${newUserId}/${workspace.id}/snapshot.json`

  const { data: file, error: downloadError } = await admin.storage
    .from('workspace-snapshots')
    .download(oldPath)

  if (downloadError || !file) {
    if (!isStorageNotFound(downloadError)) {
      return {
        error: downloadError?.message || 'Failed to download canvas snapshot',
      }
    }

    // Confirmed missing — reassign and clear a stale path if present.
    if (workspace.canvas_snapshot_path) {
      const { error: clearPathError } = await admin
        .from('workspaces')
        .update({
          user_id: newUserId,
          canvas_snapshot_path: null,
        })
        .eq('id', workspace.id)
        .eq('user_id', oldUserId)

      if (clearPathError) {
        return { error: clearPathError.message }
      }
    } else {
      const { error: reassignError } = await admin
        .from('workspaces')
        .update({ user_id: newUserId })
        .eq('id', workspace.id)
        .eq('user_id', oldUserId)

      if (reassignError) {
        return { error: reassignError.message }
      }
    }
    return {}
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from('workspace-snapshots')
    .upload(newPath, bytes, { upsert: true, contentType: 'application/json' })

  if (uploadError) {
    // eslint-disable-next-line no-console
    console.error('Failed to upload migrated snapshot:', uploadError)
    return { error: 'Failed to migrate canvas snapshot' }
  }

  const { error: updateError } = await admin
    .from('workspaces')
    .update({
      user_id: newUserId,
      canvas_snapshot_path: newPath,
    })
    .eq('id', workspace.id)
    .eq('user_id', oldUserId)

  if (updateError) {
    return { error: updateError.message }
  }

  const { error: removeError } = await admin.storage.from('workspace-snapshots').remove([oldPath])

  if (removeError) {
    // Non-fatal: new path is authoritative; log and continue.
    // eslint-disable-next-line no-console
    console.error('Failed to remove old snapshot after migrate:', removeError)
  }

  return {}
}

/**
 * Move workspaces (+ canvas snapshots) from an anonymous user to a permanent
 * account. Caller must enforce that this is only invoked for a verified
 * anonymous→authenticated transition — this function is NOT a server action.
 */
export async function migrateAnonymousWorkspaces(
  oldUserId: string,
  newUserId: string,
): Promise<{ success?: true; error?: string }> {
  if (oldUserId === newUserId) {
    return { success: true }
  }

  const admin = createAdminClient()

  const { data: oldUserData, error: oldUserError } = await admin.auth.admin.getUserById(oldUserId)
  if (oldUserError || !oldUserData.user) {
    return { error: 'Anonymous user not found' }
  }
  if (!oldUserData.user.is_anonymous) {
    return { error: 'Can only migrate from anonymous users' }
  }

  const { data: workspaces, error: listError } = await admin
    .from('workspaces')
    .select('id, canvas_snapshot_path')
    .eq('user_id', oldUserId)

  if (listError) {
    return { error: listError.message }
  }

  for (const workspace of workspaces ?? []) {
    const result = await migrateOneWorkspace(admin, workspace, oldUserId, newUserId)
    if (result.error) {
      return { error: result.error }
    }
  }

  // Re-query leftovers (e.g. rows inserted during migration) and migrate fully.
  const { data: leftovers, error: leftoverListError } = await admin
    .from('workspaces')
    .select('id, canvas_snapshot_path')
    .eq('user_id', oldUserId)

  if (leftoverListError) {
    return { error: leftoverListError.message }
  }

  for (const workspace of leftovers ?? []) {
    const result = await migrateOneWorkspace(admin, workspace, oldUserId, newUserId)
    if (result.error) {
      return { error: result.error }
    }
  }

  return { success: true }
}
