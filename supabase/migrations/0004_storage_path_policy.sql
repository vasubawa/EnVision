-- Path-based ownership for workspace snapshots so migrated files under
-- {user_id}/{workspace_id}/... remain readable after anon→account migration
-- (service-role uploads do not set storage.objects.owner to the end user).

drop policy if exists "workspace_snapshots_crud_own" on storage.objects;

create policy "workspace_snapshots_crud_own" on storage.objects
  for all
  using (
    bucket_id = 'workspace-snapshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'workspace-snapshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
