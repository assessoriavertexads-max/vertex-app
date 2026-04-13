import { useState } from "react";
import { User, Bell, Shield, Loader2, MessageSquare, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function getSendChannels(): { whatsapp: boolean; email: boolean } {
  try { return { whatsapp: true, email: false, ...JSON.parse(localStorage.getItem('vertex_send_channels') || '{}') }; }
  catch { return { whatsapp: true, email: false }; }
}
function saveSendChannels(channels: { whatsapp: boolean; email: boolean }) {
  localStorage.setItem('vertex_send_channels', JSON.stringify(channels));
}

export default function Settings() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [sendChannels, setSendChannels] = useState(getSendChannels);

  const toggleChannel = (channel: 'whatsapp' | 'email') => {
    const updated = { ...sendChannels, [channel]: !sendChannels[channel] };
    setSendChannels(updated);
    saveSendChannels(updated);
    toast.success('Configuração salva!');
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
          {[
            { label: "Alertas de pagamento", desc: "Notificar sobre pagamentos pendentes ou vencidos" },
            { label: "Novos leads", desc: "Avisar quando um lead mudar de etapa" },
            { label: "Tarefas vencendo", desc: "Lembrar de tarefas com prazo próximo" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
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
