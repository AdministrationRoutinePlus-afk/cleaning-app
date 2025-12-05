DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "Users can view participated conversations"
ON conversations FOR SELECT
USING (
  id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view own participation"
ON conversation_participants FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Creators can view all participants"
ON conversation_participants FOR SELECT
USING (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
);

CREATE POLICY "Creators can add participants"
ON conversation_participants FOR INSERT
WITH CHECK (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
);

CREATE POLICY "Creators can view messages"
ON messages FOR SELECT
USING (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
);

CREATE POLICY "Participants can view messages"
ON messages FOR SELECT
USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
    OR conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
  )
);
