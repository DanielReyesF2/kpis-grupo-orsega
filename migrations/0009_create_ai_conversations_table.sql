-- Tabla para almacenar historial de conversaciones con el AI Assistant
-- Usado por n8n para memoria de contexto multi-agente

CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created ON ai_conversations(created_at DESC);

-- Comentarios
COMMENT ON TABLE ai_conversations IS 'Historial de conversaciones con el AI Assistant para memoria de contexto';
COMMENT ON COLUMN ai_conversations.session_id IS 'ID único de sesión para agrupar mensajes de una conversación';
COMMENT ON COLUMN ai_conversations.metadata IS 'Metadatos adicionales como modelo usado, tokens, etc.';
