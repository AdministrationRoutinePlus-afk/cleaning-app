CREATE POLICY "messages_update"
ON messages FOR UPDATE
USING (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  OR conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
);
