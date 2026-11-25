create policy "Feedback is accessible only through guarded functions"
  on public.user_feedback for all to authenticated
  using (false) with check (false);
