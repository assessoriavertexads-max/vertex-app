import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { toast.error(error.message); return; }
      setResetSent(true);
    } catch {
      toast.error('Erro ao enviar email de redefinição');
    } finally {
      setResetLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message || 'Erro ao fazer login');
        return;
      }

      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (err) {
      toast.error('Erro inesperado ao fazer login');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0e1116]">
      {/* Painel esquerdo — identidade da marca */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] shrink-0 p-12 relative overflow-hidden border-r border-white/5">
        {/* Glow de fundo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#0DB878]/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#0DB878]/5 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0DB878] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 12L8 4L13 12H3Z" fill="white" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-wider" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>VERTOS</span>
        </div>

        {/* Claim central */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#0DB878] uppercase">Plataforma de Gestão</p>
            <h2 className="text-3xl font-bold text-white leading-tight" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>
              Sua operação,<br />em um só lugar.
            </h2>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              CRM, financeiro, projetos, automações e inteligência artificial para agências e empresas.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3">
            {[
              'Pipeline comercial com Kanban',
              'Financeiro com cobrança automática',
              'Calendário, tarefas e projetos',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-[#0DB878]/20 flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2.5" stroke="#0DB878" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-sm text-white/50">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer esquerdo */}
        <p className="relative z-10 text-white/20 text-xs">© 2026 Vertos</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-[#0DB878] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 12L8 4L13 12H3Z" fill="white" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-wider" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>VERTOS</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>Entrar na conta</h1>
            <p className="text-white/40 text-sm">Bem-vindo de volta.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/60 text-xs font-medium uppercase tracking-wide">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60 focus-visible:ring-[#0DB878]/20"
                disabled={isLoading}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/60 text-xs font-medium uppercase tracking-wide">Senha</Label>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-[#0DB878]/70 hover:text-[#0DB878] transition-colors"
                >
                  Esqueci a senha
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60 focus-visible:ring-[#0DB878]/20"
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[#0DB878] hover:bg-[#0DB878]/90 text-white font-semibold rounded-lg mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/30 text-sm">
              Não tem conta?{' '}
              <Link to="/signup" className="text-[#0DB878] hover:text-[#0DB878]/80 font-medium transition-colors">
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Modal reset de senha */}
      {showReset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#161b22] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[#0DB878]/20 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h8M6 2v8" stroke="#0DB878" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-sm">Redefinir senha</h3>
            </div>
            {resetSent ? (
              <>
                <p className="text-white/50 text-sm mb-4">Email enviado! Verifique sua caixa de entrada e siga as instruções.</p>
                <Button
                  className="w-full bg-[#0DB878] hover:bg-[#0DB878]/90 text-white"
                  onClick={() => { setShowReset(false); setResetSent(false); }}
                >
                  Fechar
                </Button>
              </>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <p className="text-white/40 text-sm">Informe seu email para receber o link de redefinição.</p>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60"
                  required
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                    onClick={() => setShowReset(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#0DB878] hover:bg-[#0DB878]/90 text-white"
                    disabled={resetLoading}
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
