import { useState, useEffect } from "react";
import { User, Bell, Shield, Loader2, MessageSquare, Mail, KeyRound, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type NotifKey = 'payment_alerts' | 'new_leads' | 'task_due';

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
    payment_alerts: true,
    new_leads: true,
    task_due: true,
  });
}

export default function Settings() {
  const { user, profile } = useAuth();
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [sendChannels, setSendChannels]     = useState(getSendChannels);
  const [notifications, setNotifications]   = useState(getNotifications);
  const [newPin, setNewPin]                 = useState('');
  const [isSavingPin, setIsSavingPin]       = useState(false);
  const [whatsappPhone, setWhatsappPhone]   = useState('');
  const [isSavingPhone, setIsSavingPhone]   = useState(false);

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
    if (error) {
      toast.error('Erro ao salvar número: ' + error.message);
    } else {
      toast.success('Número WhatsApp salvo!');
    }
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
    if (!newPin || newPin.length < 4) {
      toast.error('O PIN deve ter no mínimo 4 caracteres.');
      return;
    }
    setIsSavingPin(true);
    try {
      const { error } = await supabase.functions.invoke('verify-pin', {
        body: { pin: '__set__', newPin },
      });
      if (error) {
        toast.info('Configure o WHATSAPP_PIN nos Secrets do Supabase para alterar o PIN.');
      } else {
        toast.success('Solicitação enviada. Configure o novo PIN nos Secrets do Supabase.');
      }
    } catch {
      toast.info('Configure o WHATSAPP_PIN diretamente nos Secrets do Supabase Dashboard.');
    } finally {
      setIsSavingPin(false);
      setNewPin('');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setIsSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSavingPassword(false);
    if (error) {
      toast.error(`Erro ao atualizar senha: ${error.message}`);
    } else {
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas preferências de conta</p>
      </div>

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
            <Input
              id="whatsapp-phone"
              type="tel"
              placeholder="5511999999999"
              value={whatsappPhone}
              onChange={e => setWhatsappPhone(e.target.value)}
              className="font-mono"
            />
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
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={() => toggleNotification(item.key)}
              />
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
          <Input
            type="password"
            placeholder="Novo PIN"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            minLength={4}
          />
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
