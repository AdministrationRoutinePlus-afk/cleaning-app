DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view participated conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view own participation" ON conversation_participants;
DROP POLICY IF EXISTS "Creators can view all participants" ON conversation_participants;
DROP POLICY IF EXISTS "Creators can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Creators can view messages" ON messages;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

DROP FUNCTION IF EXISTS get_user_conversation_ids(uuid);

CREATE OR REPLACE FUNCTION get_user_conversation_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT conversation_id FROM conversation_participants WHERE user_id = p_user_id
$$;

CREATE POLICY "conversations_insert"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "conversations_select"
ON conversations FOR SELECT
USING (
  created_by = auth.uid()
  OR id IN (SELECT get_user_conversation_ids(auth.uid()))
);

CREATE POLICY "participants_select"
ON conversation_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
);

CREATE POLICY "participants_insert"
ON conversation_participants FOR INSERT
WITH CHECK (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
);

CREATE POLICY "messages_select"
ON messages FOR SELECT
USING (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  OR conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
);

CREATE POLICY "messages_insert"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
    OR conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  )
);
