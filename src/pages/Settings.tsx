import { useState, useEffect } from "react";
import {
  User, Bell, Shield, Loader2, MessageSquare, Mail, KeyRound,
  Phone, Plug, Plus, Trash2, Copy, Eye, EyeOff, Check, Palette,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ImageUpload";

const BRANDING_KEY = 'vertex_branding';

interface Branding { logo_url?: string; app_name?: string }

function loadBranding(): Branding {
  try { return JSON.parse(localStorage.getItem(BRANDING_KEY) ?? '{}'); }
  catch { return {}; }
}

export function applyBranding(b: Branding) {
  if (b.app_name) document.title = b.app_name;
  if (b.logo_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = b.logo_url;
  }
}

type NotifKey = 'payment_alerts' | 'new_leads' | 'task_due';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

function getStoredJson<T>(key: string, fallback: T): T {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
  catch { return fallback; }
}
function getSendChannels() {
  return getStoredJson<{ whatsapp: boolean; email: boolean }>('vertex_send_channels', { whatsapp: true, email: false });
}
function saveSendChannels(channels: { whatsapp: boolean; email: boolean }) {
  localStorage.setItem('vertex_send_channels', JSON.stringify(channels));
}
function getNotifications() {
  return getStoredJson<Record<NotifKey, boolean>>('vertex_notifications', {
    payment_alerts: true, new_leads: true, task_due: true,
  });
}

async function generateApiKey(): Promise<{ raw: string; hash: string; prefix: string }> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const hex    = Array.from(random).map((b) => b.toString(16).padStart(2, "0")).join("");
  const raw    = `vtx_live_${hex}`;
  const prefix = raw.slice(0, 16);
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash    = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hash, prefix };
}

// ── API Keys section ──────────────────────────────────────────────────────────
function ApiKeysSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName]     = useState("");
  const [newKeyPerms, setNewKeyPerms]   = useState<"read" | "readwrite">("read");
  const [revealedKey, setRevealedKey]   = useState<string | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [showNew, setShowNew]           = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at")
        .eq("auth_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      if (!newKeyName.trim()) throw new Error("Dê um nome à chave");
      const { raw, hash, prefix } = await generateApiKey();
      const perms = newKeyPerms === "readwrite" ? ["read", "write"] : ["read"];
      const { error } = await supabase.from("api_keys").insert({
        auth_user_id: userId,
        name:         newKeyName.trim(),
        key_hash:     hash,
        key_prefix:   prefix,
        permissions:  perms,
      });
      if (error) throw error;
      return raw;
    },
    onSuccess: (raw) => {
      setRevealedKey(raw);
      setNewKeyName("");
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ["api-keys", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("auth_user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys", userId] });
      toast.success("Chave revogada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyKey = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const SUPABASE_PROJECT = "zfufkschpimuiedstxyl";
  const API_BASE = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/vertex-api`;

  return (
    <div className="stat-card space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">API Keys — Integrações Externas</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowNew(!showNew)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova chave
        </Button>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Use estas chaves para conectar ao <strong>n8n</strong>, Make, Zapier e outros parceiros.
        Endpoint base:{" "}
        <code className="bg-muted px-1 rounded text-[11px] select-all">{API_BASE}</code>
      </p>

      {/* Chave recém-criada */}
      {revealedKey && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-green-600">
            Chave criada — copie agora, não será exibida novamente.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 font-mono select-all break-all">
              {revealedKey}
            </code>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
              onClick={() => copyKey(revealedKey, "new")}>
              {copiedId === "new" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Header a usar: <code className="bg-muted px-1 rounded">X-API-Key: {revealedKey.slice(0, 20)}...</code>
          </p>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setRevealedKey(null)}>
            Fechar
          </Button>
        </div>
      )}

      {/* Formulário nova chave */}
      {showNew && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da chave</Label>
              <Input
                placeholder="Ex: n8n produção"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Permissões</Label>
              <select
                value={newKeyPerms}
                onChange={(e) => setNewKeyPerms(e.target.value as "read" | "readwrite")}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="read">Somente leitura</option>
                <option value="readwrite">Leitura + escrita</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createKey.mutate()} disabled={createKey.isPending || !newKeyName.trim()}>
              {createKey.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Gerar chave
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de chaves */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma chave criada ainda.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{k.name}</span>
                  {k.permissions.includes("write")
                    ? <Badge variant="secondary" className="text-[10px] h-4">leitura + escrita</Badge>
                    : <Badge variant="outline" className="text-[10px] h-4">somente leitura</Badge>
                  }
                  {!k.is_active && <Badge variant="destructive" className="text-[10px] h-4">inativa</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {k.key_prefix}••••••••
                  {k.last_used_at && (
                    <span className="ml-2 font-sans">
                      último uso {new Date(k.last_used_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => revokeKey.mutate(k.id)}
                disabled={revokeKey.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Separator />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Exemplo n8n — HTTP Request</p>
        <div className="rounded-md bg-muted p-2.5 text-[11px] font-mono text-muted-foreground space-y-0.5">
          <p><span className="text-blue-400">URL:</span> {API_BASE}/companies</p>
          <p><span className="text-blue-400">Method:</span> GET</p>
          <p><span className="text-blue-400">Header:</span> X-API-Key: vtx_live_...</p>
          <p className="mt-1"><span className="text-green-400">POST</span> {API_BASE}/leads</p>
          <p><span className="text-blue-400">Body:</span> {"{ name, email, phone, stage }"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings ─────────────────────────────────────────────────────────────
export default function Settings() {
  const { user, profile }                         = useAuth();
  const [newPassword, setNewPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]     = useState('');
  const [isSavingPassword, setIsSavingPassword]   = useState(false);
  const [sendChannels, setSendChannels]           = useState(getSendChannels);
  const [notifications, setNotifications]         = useState(getNotifications);
  const [newPin, setNewPin]                       = useState('');
  const [isSavingPin, setIsSavingPin]             = useState(false);
  const [whatsappPhone, setWhatsappPhone]         = useState('');
  const [isSavingPhone, setIsSavingPhone]         = useState(false);
  const [showPassword, setShowPassword]           = useState(false);
  const [branding, setBranding]                   = useState<Branding>(loadBranding);

  useEffect(() => {
    if (profile?.whatsapp_phone) setWhatsappPhone(profile.whatsapp_phone);
  }, [profile]);

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingPhone(true);
    const { error } = await supabase
      .from('profiles')
      .update({ whatsapp_phone: whatsappPhone.trim() || null })
      .eq('id', user.id);
    setIsSavingPhone(false);
    if (error) toast.error('Erro ao salvar número: ' + error.message);
    else toast.success('Número WhatsApp salvo!');
  };

  const toggleChannel = (channel: 'whatsapp' | 'email') => {
    const updated = { ...sendChannels, [channel]: !sendChannels[channel] };
    setSendChannels(updated);
    saveSendChannels(updated);
    toast.success('Configuração salva!');
  };

  const toggleNotification = (key: NotifKey) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem('vertex_notifications', JSON.stringify(updated));
    toast.success('Preferência salva!');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) { toast.error('O PIN deve ter no mínimo 4 caracteres.'); return; }
    setIsSavingPin(true);
    try {
      await supabase.functions.invoke('verify-pin', { body: { pin: '__set__', newPin } });
      toast.success('Solicitação enviada. Configure o novo PIN nos Secrets do Supabase.');
    } catch {
      toast.info('Configure o WHATSAPP_PIN diretamente nos Secrets do Supabase Dashboard.');
    } finally {
      setIsSavingPin(false);
      setNewPin('');
    }
  };

  const handleSaveBranding = () => {
    localStorage.setItem(BRANDING_KEY, JSON.stringify(branding));
    applyBranding(branding);
    toast.success('Identidade visual salva!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) { toast.error('A senha deve ter no mínimo 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem.'); return; }
    setIsSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSavingPassword(false);
    if (error) toast.error(`Erro ao atualizar senha: ${error.message}`);
    else { toast.success('Senha atualizada com sucesso!'); setNewPassword(''); setConfirmPassword(''); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas preferências de conta</p>
      </div>

      {/* Identidade Visual */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Identidade Visual</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Sua logo aparece como ícone na aba do navegador e na barra do Google. O nome aparece no título da aba.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Logo / Ícone do sistema</Label>
            <ImageUpload
              bucket="branding"
              value={branding.logo_url}
              onChange={(url) => setBranding((b) => ({ ...b, logo_url: url }))}
              previewClassName="h-20 w-20"
              label="Clique para enviar logo"
            />
            <p className="text-xs text-muted-foreground">Recomendado: PNG quadrado, mínimo 192×192px</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-name" className="text-sm">Nome do sistema (aba do navegador)</Label>
            <Input
              id="app-name"
              value={branding.app_name ?? ''}
              onChange={(e) => setBranding((b) => ({ ...b, app_name: e.target.value }))}
              placeholder="Ex: Minha Agência ERP"
              className="max-w-xs"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveBranding}>Salvar identidade visual</Button>
        </div>
      </div>

      <Separator />

      {/* Perfil */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Perfil</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled className="bg-muted/50 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <Label>ID do usuário</Label>
            <Input value={user?.id ? `${user.id.slice(0, 8)}...` : ''} disabled className="bg-muted/50 text-muted-foreground font-mono text-xs" />
          </div>
        </div>
        <Separator />
        <form onSubmit={handleSaveWhatsapp} className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="h-4 w-4 text-green-600" />
            <Label htmlFor="whatsapp-phone">WhatsApp da Agência (exibido no Portal do Cliente)</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Número com DDD e código do país. Ex: <code className="bg-muted px-1 rounded">5511999999999</code>
          </p>
          <div className="flex gap-2 max-w-sm">
            <Input id="whatsapp-phone" type="tel" placeholder="5511999999999"
              value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)} className="font-mono" />
            <Button type="submit" disabled={isSavingPhone}>
              {isSavingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>

      <Separator />

      {/* Segurança */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Segurança</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input id="new-password" type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} className="pr-9" />
                <Button type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-2.5"
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input id="confirm-password" type={showPassword ? "text" : "password"}
                placeholder="Repita a nova senha" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSavingPassword || !newPassword}>
              {isSavingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Atualizar Senha
            </Button>
          </div>
        </form>
      </div>

      <Separator />

      {/* API Keys */}
      {user && <ApiKeysSection userId={user.id} />}

      <Separator />

      {/* Notificações */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Notificações</h2>
        </div>
        <div className="space-y-3">
          {([
            { key: 'payment_alerts' as NotifKey, label: "Alertas de pagamento", desc: "Notificar sobre pagamentos pendentes ou vencidos" },
            { key: 'new_leads' as NotifKey, label: "Novos leads", desc: "Avisar quando um lead mudar de etapa" },
            { key: 'task_due' as NotifKey, label: "Tarefas vencendo", desc: "Lembrar de tarefas com prazo próximo" },
          ]).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={notifications[item.key]} onCheckedChange={() => toggleNotification(item.key)} />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* PIN do WhatsApp */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">PIN do WhatsApp</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          O PIN protege o acesso à aba WhatsApp. Para alterar, configure o secret{' '}
          <code className="bg-muted px-1 rounded text-xs">WHATSAPP_PIN</code> no painel do Supabase.
        </p>
        <form onSubmit={handleSavePin} className="flex gap-2 max-w-sm">
          <Input type="password" placeholder="Novo PIN" value={newPin}
            onChange={e => setNewPin(e.target.value)} minLength={4} />
          <Button type="submit" disabled={isSavingPin || !newPin}>
            {isSavingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </form>
      </div>

      <Separator />

      {/* Canais de Envio */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Canais de Envio</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Defina quais canais serão usados ao enviar cobranças personalizadas aos clientes.
          Para ativar um canal, o cadastro da empresa deve ter o contato correspondente preenchido.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Envia via Evolution API usando o telefone do cliente</p>
              </div>
            </div>
            <Switch checked={sendChannels.whatsapp} onCheckedChange={() => toggleChannel('whatsapp')} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-foreground">E-mail</p>
                <p className="text-xs text-muted-foreground">Abre o cliente de e-mail com a mensagem pré-preenchida</p>
              </div>
            </div>
            <Switch checked={sendChannels.email} onCheckedChange={() => toggleChannel('email')} />
          </div>
        </div>
      </div>
    </div>
  );
}
