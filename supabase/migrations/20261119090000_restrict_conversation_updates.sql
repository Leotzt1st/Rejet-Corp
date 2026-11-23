-- Participants may read conversations and create conversations that include them.
-- They cannot change participants, which could expose existing message history.
drop policy if exists conversations_update_self on public.conversations;
