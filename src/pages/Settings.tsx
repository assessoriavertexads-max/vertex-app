import { User, Bell, Shield, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas preferências</p>
      </div>

      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Perfil</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input defaultValue="Admin" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue="admin@gestaopro.com" />
          </div>
        </div>
      </div>

      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Notificações</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: "Notificações por e-mail", desc: "Receba atualizações no e-mail" },
            { label: "Alertas de pagamento", desc: "Notificar sobre pagamentos pendentes" },
            { label: "Insights da IA", desc: "Receba sugestões inteligentes" },
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

      <div className="flex justify-end">
        <Button>Salvar Alterações</Button>
      </div>
    </div>
  );
}
