-- =============================================================================
-- ESQUEMA SUPABASE DESDE CERO PARA APP APK DE MENSAJERÍA GLOBAL (ESTILO WHATSAPP)
-- =============================================================================

-- 1. Tabla de Usuarios Registrados (Autenticación + Número Telefónico + PIN Anti-Hack)
CREATE TABLE public.nexchat_users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  bio TEXT DEFAULT '¡Hola! Estoy usando NexChat sin límites.',
  avatar TEXT,
  online BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Salas / Grupos y Canales Oficiales
CREATE TABLE public.nexchat_chats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  is_group BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  avatar TEXT,
  status TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Mensajes Globales en Tiempo Real (Texto Cifrado E2EE, Fotos, Audios, Archivos)
CREATE TABLE public.nexchat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'file')),
  content TEXT NOT NULL,
  file_name TEXT,
  duration TEXT,
  expires_at BIGINT,
  time TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  status TEXT DEFAULT 'read',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla Global de Estados de 24 Horas (Historias estilo WhatsApp Status)
CREATE TABLE public.nexchat_statuses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  bg_color TEXT DEFAULT '#008069',
  time TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de alto rendimiento
CREATE INDEX idx_nexchat_msg_chat_ts ON public.nexchat_messages(chat_id, timestamp);
CREATE INDEX idx_nexchat_users_phone ON public.nexchat_users(phone);
CREATE INDEX idx_nexchat_statuses_exp ON public.nexchat_statuses(expires_at);

-- Activar Row Level Security (RLS)
ALTER TABLE public.nexchat_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexchat_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexchat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexchat_statuses ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "users_read_all" ON public.nexchat_users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.nexchat_users FOR INSERT WITH CHECK (length(phone) >= 6);
CREATE POLICY "users_update" ON public.nexchat_users FOR UPDATE USING (true);

CREATE POLICY "chats_all" ON public.nexchat_chats FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "messages_read" ON public.nexchat_messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON public.nexchat_messages FOR INSERT WITH CHECK (length(content) > 0);
CREATE POLICY "messages_delete" ON public.nexchat_messages FOR DELETE USING (true);

CREATE POLICY "statuses_all" ON public.nexchat_statuses FOR ALL USING (true) WITH CHECK (true);

-- Publicar tablas en Supabase Realtime para mensajería instantánea 24/7
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexchat_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexchat_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexchat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexchat_statuses;

-- Crear únicamente el Canal Oficial de NexChat para anuncios de actualizaciones
INSERT INTO public.nexchat_chats (id, name, phone, is_group, is_official, avatar, status)
VALUES (
  'official_nexchat',
  'NexChat Oficial ✅',
  'Canal Oficial de Actualizaciones',
  false,
  true,
  'https://api.dicebear.com/7.x/shapes/png?seed=NexChatOfficial',
  'Cuenta Oficial Verificada • Novedades y Seguridad E2EE'
);

INSERT INTO public.nexchat_messages (id, chat_id, sender_id, sender_name, sender_phone, type, content, time, timestamp, status)
VALUES (
  'official_welcome_msg',
  'official_nexchat',
  'nexchat_official',
  'NexChat Oficial ✅',
  'OFICIAL',
  'text',
  '🎉 ¡Bienvenido a NexChat Global APK!\n\nEste es el canal oficial verificado de NexChat. Aquí recibirás avisos de nuevas actualizaciones automáticas (OTA) y mejoras de seguridad.\n\n👥 Para hablar con tus amigos:\nToca el botón "+ Nuevo Contacto" arriba a la derecha y agrega el número telefónico de tus amigos.',
  'Ahora',
  1700000000000,
  'read'
);
