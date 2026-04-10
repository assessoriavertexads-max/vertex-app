const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL;
const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = import.meta.env.VITE_EVOLUTION_INSTANCE;

const headers = {
  'apikey': EVOLUTION_API_KEY,
  'Content-Type': 'application/json',
};

export interface EvolutionChat {
  id: string;
  remoteJid: string;
  name: string;
  pushName?: string;
  isGroup: boolean;
  unreadCount?: number;
  lastMessage?: {
    content: string;
    fromMe: boolean;
    timestamp: number;
  };
  profilePicUrl?: string;
}

export interface EvolutionMessage {
  id: string;
  key: {
    id: string;
    fromMe: boolean;
    remoteJid: string;
  };
  messageType: string;
  message: Record<string, unknown>;
  pushName?: string;
  messageTimestamp: number;
  status?: string;
}

export async function fetchChats(limit = 30, offset = 0): Promise<EvolutionChat[]> {
  const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ where: {}, limit, offset }),
  });
  const data = await res.json();
  const chats = Array.isArray(data) ? data : data.chats || data.data || [];

  return chats.map((c: Record<string, unknown>) => {
    const remoteJid = (c.remoteJid || c.id || '') as string;
    return {
      id: remoteJid,
      remoteJid,
      name: (c.name || c.pushName || remoteJid.split('@')[0]) as string,
      pushName: c.pushName as string,
      isGroup: remoteJid.endsWith('@g.us'),
      unreadCount: (c.unreadCount || 0) as number,
      profilePicUrl: c.profilePicUrl as string | undefined,
    };
  });
}

export async function fetchMessages(remoteJid: string, limit = 40): Promise<EvolutionMessage[]> {
  const res = await fetch(`${EVOLUTION_URL}/chat/findMessages/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      where: { key: { remoteJid } },
      limit,
    }),
  });
  const data = await res.json();
  const msgs = Array.isArray(data)
    ? data
    : data.messages?.records || data.messages || data.data || [];
  return msgs.sort((a: EvolutionMessage, b: EvolutionMessage) =>
    a.messageTimestamp - b.messageTimestamp
  );
}

export async function sendTextMessage(remoteJid: string, text: string): Promise<void> {
  await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ number: remoteJid, text }),
  });
}

export function getMessageText(msg: EvolutionMessage): string {
  const m = msg.message;
  if (!m) return '';
  if (m.conversation) return m.conversation as string;
  if ((m.extendedTextMessage as Record<string, unknown>)?.text)
    return (m.extendedTextMessage as Record<string, unknown>).text as string;
  if (m.imageMessage) return '📷 Imagem';
  if (m.audioMessage) return '🎵 Áudio';
  if (m.videoMessage) return '🎥 Vídeo';
  if (m.documentMessage) return '📄 Documento';
  if (m.stickerMessage) return '🎭 Sticker';
  if (m.locationMessage) return '📍 Localização';
  if (m.contactMessage) return '👤 Contato';
  if ((m.buttonsResponseMessage as Record<string, unknown>)?.selectedDisplayText)
    return (m.buttonsResponseMessage as Record<string, unknown>).selectedDisplayText as string;
  if ((m.listResponseMessage as Record<string, unknown>)?.title)
    return (m.listResponseMessage as Record<string, unknown>).title as string;
  return '';
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
