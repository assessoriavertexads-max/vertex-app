import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Send, Loader2, MessageSquare, Users, RefreshCw,
  Lock, Eye, EyeOff, WifiOff, ChevronDown, Phone, Video,
  MoreVertical, Smile,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  fetchChats, fetchMessages, sendTextMessage,
  getMessageText, formatTimestamp,
  EvolutionChat, EvolutionMessage,
} from '@/lib/evolution';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const SESSION_KEY = 'whatsapp_unlocked';

// ── Avatar color from name hash ───────────────────────────────────────────────
const AVATAR_COLORS = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fullTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function shortTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── PIN Lock ──────────────────────────────────────────────────────────────────
function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-pin', { body: { pin } });
      if (fnError) {
        const msg = (fnError as { message?: string })?.message ?? '';
        if (msg.toLowerCase().includes('não configurado') || msg.includes('503'))
          toast.error('PIN não configurado. Defina o secret WHATSAPP_PIN no Supabase.');
        else if (msg.includes('401') || msg.toLowerCase().includes('autorizado'))
          toast.error('Sessão expirada. Faça login novamente.');
        else
          toast.error('Erro ao verificar PIN. Tente novamente.');
        setPin('');
      } else if (data?.not_configured) {
        toast.warning('PIN não configurado — acesso liberado.');
        sessionStorage.setItem(SESSION_KEY, '1');
        onUnlock();
      } else if (!data?.valid) {
        setError(true); setPin('');
        setTimeout(() => setError(false), 1500);
      } else {
        sessionStorage.setItem(SESSION_KEY, '1');
        onUnlock();
      }
    } catch {
      toast.error('Erro de conexão.'); setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
      <div className="bg-card rounded-2xl border shadow-lg p-8 w-80 flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center">
          <Lock className="w-7 h-7 text-[#25D366]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">WhatsApp Protegido</h2>
          <p className="text-sm text-muted-foreground mt-1">Digite o PIN para acessar</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative">
            <Input
              type={showPin ? 'text' : 'password'}
              maxLength={30}
              placeholder="Senha"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className={`text-center text-xl tracking-widest h-12 ${error ? 'border-red-400 animate-pulse' : ''}`}
              autoFocus
            />
            <button type="button" onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 text-center">PIN incorreto</p>}
          <Button type="submit" className="w-full bg-[#25D366] hover:bg-[#20bc5a] text-white" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ chat, size = 10 }: { chat: EvolutionChat; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const color = avatarColor(chat.name);
  const sizeClass = `w-${size} h-${size}`;

  if (chat.profilePicUrl && !imgError) {
    return (
      <img
        src={chat.profilePicUrl}
        alt={chat.name}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm`}
      style={{ backgroundColor: color }}
    >
      {chat.isGroup ? <Users className="w-5 h-5" /> : chat.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Chat List Item ────────────────────────────────────────────────────────────
function ChatItem({ chat, active, onClick }: { chat: EvolutionChat; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left relative ${
        active ? 'bg-primary/8' : ''
      }`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#25D366] rounded-r" />}
      <Avatar chat={chat} size={11} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-1">
          <p className="text-sm font-medium truncate">{chat.name}</p>
          {(chat.unreadCount ?? 0) > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-[#25D366] text-white rounded-full flex items-center justify-center">
              {chat.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {chat.isGroup ? '👥 Grupo' : chat.remoteJid.split('@')[0]}
        </p>
      </div>
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, fromMe, showName, isGroup, isFirst, isLast,
}: {
  msg: EvolutionMessage; fromMe: boolean; showName: boolean;
  isGroup: boolean; isFirst: boolean; isLast: boolean;
}) {
  const text = getMessageText(msg);
  if (!text) return null;

  const br = fromMe
    ? `rounded-2xl ${isFirst ? 'rounded-tr-sm' : ''} ${!isLast ? 'rounded-br-md' : 'rounded-br-sm'}`
    : `rounded-2xl ${isFirst ? 'rounded-tl-sm' : ''} ${!isLast ? 'rounded-bl-md' : 'rounded-bl-sm'}`;

  return (
    <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[72%] px-3 py-2 text-sm shadow-sm ${br} ${
        fromMe
          ? 'bg-[#dcf8c6] dark:bg-[#025c4c] text-gray-900 dark:text-gray-100'
          : 'bg-white dark:bg-[#1f2c33] text-gray-900 dark:text-gray-100 border border-border/30'
      }`}>
        {!fromMe && showName && isGroup && msg.pushName && (
          <p className="text-xs font-semibold mb-1" style={{ color: avatarColor(msg.pushName) }}>
            {msg.pushName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
        <p className={`text-[10px] mt-0.5 text-right select-none ${
          fromMe ? 'text-[#025c4c]/60 dark:text-white/40' : 'text-muted-foreground'
        }`}>
          {fullTime(msg.messageTimestamp)}
        </p>
      </div>
    </div>
  );
}

// ── Date Separator ────────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="bg-[#e1f3fb] dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-xs px-3 py-1 rounded-full shadow-sm">
        {label}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WhatsApp() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [chats, setChats] = useState<EvolutionChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChat, setActiveChat] = useState<EvolutionChat | null>(null);
  const [messages, setMessages] = useState<EvolutionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filterGroup, setFilterGroup] = useState<'all' | 'contacts' | 'groups'>('all');
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChats = useCallback(async () => {
    setLoadingChats(true); setChatsError(null);
    try {
      setChats(await fetchChats(80));
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Erro desconhecido';
      const msg = raw.includes('non-2xx')
        ? 'Evolution API não configurada.'
        : raw;
      setChatsError(msg);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const loadMessages = useCallback(async (chat: EvolutionChat) => {
    setLoadingMessages(true); setMessages([]);
    try { setMessages(await fetchMessages(chat.remoteJid, 50)); }
    catch (err) { toast.error('Erro ao carregar mensagens: ' + (err instanceof Error ? err.message : '')); }
    finally { setLoadingMessages(false); }
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!activeChat) return;
    try { setMessages(await fetchMessages(activeChat.remoteJid, 50)); }
    catch { /* silent */ }
  }, [activeChat]);

  useEffect(() => { if (unlocked) loadChats(); }, [unlocked, loadChats]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!unlocked || !activeChat) return;
    loadMessages(activeChat);
    pollRef.current = setInterval(refreshMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat, unlocked, loadMessages, refreshMessages]);

  // Scroll para o fim quando chegam novas mensagens
  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 120;
    if (isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detecta se está longe do fim
  const handleScroll = () => {
    const area = messagesAreaRef.current;
    if (!area) return;
    setShowScrollBtn(area.scrollHeight - area.scrollTop - area.clientHeight > 200);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleSend = async () => {
    if (!messageInput.trim() || !activeChat || sending) return;
    setSending(true);
    const text = messageInput.trim();
    setMessageInput('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    try {
      await sendTextMessage(activeChat.remoteJid, text);
      setTimeout(refreshMessages, 1000);
    } catch (err) {
      toast.error('Erro ao enviar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSending(false);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const filteredChats = chats.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter =
      filterGroup === 'all' ||
      (filterGroup === 'groups' && c.isGroup) ||
      (filterGroup === 'contacts' && !c.isGroup);
    return matchSearch && matchFilter;
  });

  // Agrupa mensagens por data e por remetente consecutivo
  type GroupedItem =
    | { type: 'date'; label: string }
    | { type: 'msg'; msg: EvolutionMessage; isFirst: boolean; isLast: boolean };

  const groupedItems: GroupedItem[] = [];
  let lastDateLabel = '';
  messages.forEach((msg, i) => {
    const dl = dateLabel(msg.messageTimestamp);
    if (dl !== lastDateLabel) {
      groupedItems.push({ type: 'date', label: dl });
      lastDateLabel = dl;
    }
    const fromMe = msg.key?.fromMe ?? false;
    const prevMsg = messages[i - 1];
    const nextMsg = messages[i + 1];
    const prevFromMe = prevMsg?.key?.fromMe ?? null;
    const nextFromMe = nextMsg?.key?.fromMe ?? null;
    const prevDate = prevMsg ? dateLabel(prevMsg.messageTimestamp) : '';
    const nextDate = nextMsg ? dateLabel(nextMsg.messageTimestamp) : '';
    const isFirst = prevFromMe !== fromMe || prevDate !== dl;
    const isLast  = nextFromMe !== fromMe || nextDate !== dl;
    groupedItems.push({ type: 'msg', msg, isFirst, isLast });
  });

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border shadow-sm overflow-hidden bg-card">

      {/* ── Sidebar ── */}
      <div className="w-[340px] shrink-0 flex flex-col border-r">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              WhatsApp
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={loadChats} disabled={loadingChats} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loadingChats ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar conversa..." className="pl-9 h-9 text-sm bg-muted/40 border-transparent focus:border-border"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
            {([['all', 'Todos'], ['contacts', 'Contatos'], ['groups', 'Grupos']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilterGroup(val)}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${
                  filterGroup === val
                    ? 'bg-white dark:bg-[#1f2c33] shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
                  <div className="w-11 h-11 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                    <div className="h-2.5 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : chatsError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 p-4 text-center">
              <WifiOff className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Não foi possível carregar</p>
              <Button variant="outline" size="sm" onClick={loadChats}>Tentar novamente</Button>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {chats.length === 0 ? 'Nenhuma conversa' : 'Nenhum resultado'}
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {filteredChats.map(chat => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  active={activeChat?.id === chat.id}
                  onClick={() => setActiveChat(chat)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Área de mensagens ── */}
      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header do chat */}
          <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-3">
            <Avatar chat={activeChat} size={10} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{activeChat.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {activeChat.isGroup ? 'Grupo' : activeChat.remoteJid.split('@')[0]}
              </p>
            </div>
            <div className="flex items-center gap-0.5 text-muted-foreground">
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex" title="Atualizar mensagens"
                onClick={refreshMessages}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mensagens */}
          <div
            ref={messagesAreaRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(var(--border)/0.3) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Carregando mensagens...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <MessageSquare className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma mensagem</p>
              </div>
            ) : (
              groupedItems.map((item, i) =>
                item.type === 'date' ? (
                  <DateSeparator key={`date-${i}`} label={item.label} />
                ) : (
                  <div key={item.msg.id} className={item.isFirst ? 'mt-2' : 'mt-0.5'}>
                    <MessageBubble
                      msg={item.msg}
                      fromMe={item.msg.key?.fromMe ?? false}
                      showName={item.isFirst}
                      isGroup={activeChat.isGroup}
                      isFirst={item.isFirst}
                      isLast={item.isLast}
                    />
                  </div>
                )
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Botão scroll-to-bottom */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-8 w-10 h-10 bg-card border shadow-md rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t bg-muted/10 flex items-end gap-2">
            <div className="flex-1 bg-card border rounded-2xl px-4 py-2 flex items-end gap-2 shadow-sm">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-transparent text-sm resize-none outline-none max-h-[120px] min-h-[24px] leading-relaxed"
                value={messageInput}
                onChange={handleTextareaInput}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!messageInput.trim() || sending}
              className="h-10 w-10 p-0 rounded-full shrink-0 bg-[#25D366] hover:bg-[#20bc5a] text-white disabled:opacity-40"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)/0.3) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}>
          <div className="bg-card rounded-2xl p-10 flex flex-col items-center gap-4 shadow-sm border">
            <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-[#25D366]" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Suas mensagens</p>
              <p className="text-sm text-muted-foreground mt-1">Selecione uma conversa para começar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
