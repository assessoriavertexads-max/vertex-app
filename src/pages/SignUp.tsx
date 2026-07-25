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

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não correspondem',
  path: ['confirmPassword'],
});

type SignUpFormData = z.infer<typeof signupSchema>;

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<SignUpFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message || 'Erro ao criar conta');
        return;
      }

      toast.success('Conta criada com sucesso! Você será redirecionado para o login.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      toast.error('Erro inesperado ao criar conta');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0e1116]">
      {/* Painel esquerdo — identidade da marca */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] shrink-0 p-12 relative overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#0DB878]/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#0DB878]/5 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0DB878] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 12L8 4L13 12H3Z" fill="white" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-wider" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>VERTOS</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#0DB878] uppercase">Nova conta</p>
            <h2 className="text-3xl font-bold text-white leading-tight" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>
              Comece agora,<br />sem burocracia.
            </h2>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Crie sua conta gratuitamente e centralize toda a gestão da sua agência em minutos.
            </p>
          </div>
          <div className="space-y-3">
            {['Configuração em menos de 5 minutos', 'Sem cartão de crédito necessário', 'Suporte incluído no onboarding'].map(f => (
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

        <p className="relative z-10 text-white/20 text-xs">© 2026 Vertos</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
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
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>Criar conta</h1>
            <p className="text-white/40 text-sm">Preencha os dados abaixo para começar.</p>
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
              <Label htmlFor="password" className="text-white/60 text-xs font-medium uppercase tracking-wide">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60 focus-visible:ring-[#0DB878]/20"
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
              <p className="text-xs text-white/25 leading-relaxed">Mínimo 8 caracteres, 1 maiúscula e 1 número</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-white/60 text-xs font-medium uppercase tracking-wide">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60 focus-visible:ring-[#0DB878]/20"
                disabled={isLoading}
              />
              {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[#0DB878] hover:bg-[#0DB878]/90 text-white font-semibold rounded-lg mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando conta...</>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/30 text-sm">
              Já tem conta?{' '}
              <Link to="/login" className="text-[#0DB878] hover:text-[#0DB878]/80 font-medium transition-colors">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
