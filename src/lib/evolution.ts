import { supabase } from '@/lib/supabase';

export interface EvolutionChat {
  id: string;
  remoteJid: string;
  name: string;
  pushName?: string;
  isGroup: boolean;
  unreadCount?: number;
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

async function callProxy(action: string, payload?: unknown) {
  const { data, error } = await supabase.functions.invoke('evolution-proxy', {
    body: { action, payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchChats(limit = 50): Promise<EvolutionChat[]> {
  const data = await callProxy('fetchChats', { where: {}, limit });
  const chats = Array.isArray(data) ? data : data?.chats || data?.data || [];

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

export async function fetchMessages(remoteJid: string, limit = 50): Promise<EvolutionMessage[]> {
  const data = await callProxy('fetchMessages', {
    where: { key: { remoteJid } },
    limit,
  });
  const msgs = Array.isArray(data)
    ? data
    : data?.messages?.records || data?.messages || data?.data || [];

  return msgs.sort((a: EvolutionMessage, b: EvolutionMessage) =>
    a.messageTimestamp - b.messageTimestamp
  );
}

export async function sendTextMessage(remoteJid: string, text: string): Promise<void> {
  await callProxy('sendMessage', { number: remoteJid, text });
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
