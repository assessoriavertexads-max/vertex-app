import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
  confirm: z.string().min(1, 'Confirme a senha'),
}).refine(d => d.password === d.confirm, {
  message: 'As senhas não coincidem',
  path: ['confirm'],
});

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    // Supabase injeta a sessão de recuperação via hash fragment na URL
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsValidSession(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setIsValidSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setIsLoading(false);
    if (error) {
      toast.error(error.message || 'Erro ao redefinir senha');
    } else {
      setDone(true);
      setTimeout(() => navigate('/'), 3000);
    }
  };

  const BrandMark = () => (
    <div className="flex items-center gap-3 mb-10">
      <div className="w-8 h-8 rounded-lg bg-[#0DB878] flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 12L8 4L13 12H3Z" fill="white" />
        </svg>
      </div>
      <span className="text-white font-bold text-xl tracking-wider" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>VERTOS</span>
    </div>
  );

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1116] px-4">
        <div className="w-full max-w-sm">
          <BrandMark />
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 shadow-xl text-center space-y-4">
            <p className="text-white/50 text-sm leading-relaxed">
              Link de redefinição inválido ou expirado.<br />Solicite um novo link na página de login.
            </p>
            <Button
              className="w-full bg-[#0DB878] hover:bg-[#0DB878]/90 text-white"
              onClick={() => navigate('/login')}
            >
              Voltar ao Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1116] px-4">
      <div className="w-full max-w-sm">
        <BrandMark />

        <div className="bg-white/5 border border-white/10 rounded-xl p-8 shadow-xl">
          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-[#0DB878]/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#0DB878]" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>Senha redefinida!</h2>
              <p className="text-white/40 text-sm">Você será redirecionado em instantes...</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>Nova senha</h2>
              <p className="text-white/40 text-sm mb-6">Escolha uma senha forte para sua conta.</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-white/60 text-xs font-medium uppercase tracking-wide">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    {...register('password')}
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60 focus-visible:ring-[#0DB878]/20"
                    disabled={isLoading}
                  />
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-white/60 text-xs font-medium uppercase tracking-wide">Confirmar senha</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repita a nova senha"
                    {...register('confirm')}
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#0DB878]/60 focus-visible:ring-[#0DB878]/20"
                    disabled={isLoading}
                  />
                  {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#0DB878] hover:bg-[#0DB878]/90 text-white font-semibold rounded-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                  ) : (
                    'Redefinir Senha'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
