import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Send, Loader2, MessageSquare, Users, RefreshCw, Lock, Eye, EyeOff, WifiOff } from 'lucide-react';
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
      const { data, error: fnError } = await supabase.functions.invoke('verify-pin', {
        body: { pin },
      });
      if (fnError) {
        const msg = (fnError as { message?: string })?.message ?? '';
        if (msg.toLowerCase().includes('não configurado') || msg.includes('503')) {
          toast.error('PIN não configurado. Defina o secret WHATSAPP_PIN no Supabase.');
        } else if (msg.includes('401') || msg.toLowerCase().includes('autorizado')) {
          toast.error('Sessão expirada. Faça login novamente.');
        } else {
          toast.error('Erro ao verificar PIN. Tente novamente.');
        }
        setPin('');
      } else if (data?.not_configured) {
        toast.warning('PIN não configurado — acesso liberado. Defina WHATSAPP_PIN nos secrets do Supabase.');
        sessionStorage.setItem(SESSION_KEY, '1');
        onUnlock();
      } else if (!data?.valid) {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 1500);
      } else {
        sessionStorage.setItem(SESSION_KEY, '1');
        onUnlock();
      }
    } catch {
      toast.error('Erro de conexão. Verifique sua internet.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-6">
      <div className="bg-white rounded-2xl border shadow-sm p-8 w-80 flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-800">WhatsApp Protegido</h2>
          <p className="text-sm text-slate-500 mt-1">Digite o PIN para acessar</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative">
            <Input
              type={showPin ? 'text' : 'password'}
              maxLength={30}
              placeholder="Senha"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className={`text-center text-xl tracking-widest h-12 ${error ? 'border-red-400 bg-red-50' : ''}`}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 text-center">PIN incorreto</p>}
          <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Todos os hooks devem ser declarados antes de qualquer return condicional
  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    setChatsError(null);
    try {
      const data = await fetchChats(50);
      setChats(data);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Erro desconhecido';
      const msg = raw.includes('non-2xx')
        ? 'Evolution API não configurada. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME nos Supabase Secrets.'
        : raw;
      setChatsError(msg);
      toast.error('Erro ao carregar conversas: ' + msg);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const loadMessages = useCallback(async (chat: EvolutionChat) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const data = await fetchMessages(chat.remoteJid, 50);
      setMessages(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao carregar mensagens: ' + msg);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!activeChat) return;
    try {
      const data = await fetchMessages(activeChat.remoteJid, 50);
      setMessages(data);
    } catch {
      // silently fail on poll — evita spam de toasts
    }
  }, [activeChat]);

  // Carrega chats apenas quando desbloqueado
  useEffect(() => {
    if (unlocked) loadChats();
  }, [unlocked, loadChats]);

  // Carrega mensagens e inicia polling ao mudar de chat
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!unlocked || !activeChat) return;
    loadMessages(activeChat);
    pollRef.current = setInterval(refreshMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat, unlocked, loadMessages, refreshMessages]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageInput.trim() || !activeChat || sending) return;
    setSending(true);
    try {
      await sendTextMessage(activeChat.remoteJid, messageInput.trim());
      setMessageInput('');
      setTimeout(refreshMessages, 1000);
    } catch (err) {
      toast.error('Erro ao enviar mensagem: ' + (err instanceof Error ? err.message : 'Tente novamente'));
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterGroup === 'all' ||
      (filterGroup === 'groups' && c.isGroup) ||
      (filterGroup === 'contacts' && !c.isGroup);
    return matchesSearch && matchesFilter;
  });

  // Return condicional APÓS todos os hooks
  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl border shadow-sm overflow-hidden">

      {/* Sidebar de chats */}
      <div className="w-80 flex flex-col border-r shrink-0">
        {/* Header */}
        <div className="p-4 border-b bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              WhatsApp
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadChats} disabled={loadingChats}>
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingChats ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-9 h-9 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {([['all', 'Todos'], ['contacts', 'Contatos'], ['groups', 'Grupos']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterGroup(val)}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                  filterGroup === val ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <p className="text-xs text-slate-400">Carregando conversas...</p>
            </div>
          ) : chatsError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 p-4 text-center">
              <WifiOff className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-500">Não foi possível carregar as conversas</p>
              <p className="text-xs text-slate-400">{chatsError}</p>
              <Button variant="outline" size="sm" onClick={loadChats}>Tentar novamente</Button>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              {chats.length === 0 ? 'Nenhuma conversa disponível' : 'Nenhuma conversa encontrada'}
            </div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 text-left ${
                  activeChat?.id === chat.id ? 'bg-green-50 border-l-2 border-l-green-500' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm ${
                  chat.isGroup ? 'bg-violet-500' : 'bg-green-500'
                }`}>
                  {chat.isGroup
                    ? <Users className="w-5 h-5" />
                    : chat.name.charAt(0).toUpperCase()
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-800 truncate">{chat.name}</p>
                    {chat.unreadCount ? (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-500 text-white rounded-full shrink-0">
                        {chat.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {chat.isGroup ? 'Grupo' : chat.remoteJid.split('@')[0]}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Área de mensagens */}
      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header do chat */}
          <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              activeChat.isGroup ? 'bg-violet-500' : 'bg-green-500'
            }`}>
              {activeChat.isGroup ? <Users className="w-4 h-4" /> : activeChat.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{activeChat.name}</p>
              <p className="text-xs text-slate-400">
                {activeChat.isGroup ? 'Grupo' : activeChat.remoteJid.split('@')[0]}
              </p>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <p className="text-xs text-slate-400">Carregando mensagens...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Nenhuma mensagem encontrada
              </div>
            ) : (
              messages.map(msg => {
                const text = getMessageText(msg);
                if (!text) return null;
                const fromMe = msg.key?.fromMe ?? false;
                return (
                  <div key={msg.id} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      fromMe
                        ? 'bg-green-500 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 rounded-bl-sm border'
                    }`}>
                      {!fromMe && activeChat.isGroup && msg.pushName && (
                        <p className="text-xs font-semibold text-violet-600 mb-1">{msg.pushName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{text}</p>
                      <p className={`text-xs mt-1 text-right ${fromMe ? 'text-green-100' : 'text-slate-400'}`}>
                        {formatTimestamp(msg.messageTimestamp)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de envio */}
          <div className="px-4 py-3 border-t bg-white flex gap-2 items-center">
            <Input
              placeholder="Digite uma mensagem..."
              className="flex-1 h-10"
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button
              onClick={handleSend}
              disabled={!messageInput.trim() || sending}
              className="h-10 w-10 p-0 bg-green-500 hover:bg-green-600 text-white"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-sm font-medium">Selecione uma conversa</p>
          <p className="text-xs">Escolha um chat na lista ao lado</p>
        </div>
      )}
    </div>
  );
}
