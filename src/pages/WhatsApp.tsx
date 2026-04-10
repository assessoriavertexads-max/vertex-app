import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Send, Loader2, MessageSquare, Users, User, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  fetchChats, fetchMessages, sendTextMessage,
  getMessageText, formatTimestamp,
  EvolutionChat, EvolutionMessage,
} from '@/lib/evolution';
import { toast } from 'sonner';

export default function WhatsApp() {
  const [chats, setChats] = useState<EvolutionChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChat, setActiveChat] = useState<EvolutionChat | null>(null);
  const [messages, setMessages] = useState<EvolutionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filterGroup, setFilterGroup] = useState<'all' | 'contacts' | 'groups'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const data = await fetchChats(50);
      setChats(data);
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const loadMessages = useCallback(async (chat: EvolutionChat) => {
    setLoadingMessages(true);
    try {
      const data = await fetchMessages(chat.remoteJid, 50);
      setMessages(data);
    } catch {
      toast.error('Erro ao carregar mensagens');
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
      // silently fail on poll
    }
  }, [activeChat]);

  useEffect(() => { loadChats(); }, [loadChats]);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat);
      // Poll a cada 5s
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(refreshMessages, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat, loadMessages, refreshMessages]);

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
    } catch {
      toast.error('Erro ao enviar mensagem');
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadChats}>
              <RefreshCw className="w-4 h-4 text-slate-500" />
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
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Nenhuma conversa encontrada</div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 text-left ${
                  activeChat?.id === chat.id ? 'bg-green-50 border-l-2 border-l-green-500' : ''
                }`}
              >
                {/* Avatar */}
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
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Nenhuma mensagem encontrada
              </div>
            ) : (
              messages.map(msg => {
                const text = getMessageText(msg);
                if (!text) return null;
                const fromMe = msg.key.fromMe;
                return (
                  <div key={msg.id} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      fromMe
                        ? 'bg-green-500 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 rounded-bl-sm border'
                    }`}>
                      {!fromMe && activeChat.isGroup && (
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
