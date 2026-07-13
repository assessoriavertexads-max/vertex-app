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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Vertos</h1>
          <p className="text-slate-400">Gestão de Performance</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6">Fazer Login</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                disabled={isLoading}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-200">Senha</Label>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Esqueci minha senha
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Modal reset de senha */}
          {showReset && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl">
                <h3 className="text-white font-semibold mb-1">Redefinir senha</h3>
                {resetSent ? (
                  <>
                    <p className="text-slate-400 text-sm mb-4">Email enviado! Verifique sua caixa de entrada e siga as instruções.</p>
                    <Button className="w-full" onClick={() => { setShowReset(false); setResetSent(false); }}>Fechar</Button>
                  </>
                ) : (
                  <form onSubmit={handleReset} className="space-y-3 mt-3">
                    <p className="text-slate-400 text-sm">Informe seu email para receber o link de redefinição.</p>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                      required
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setShowReset(false)}>Cancelar</Button>
                      <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={resetLoading}>
                        {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              Não tem conta?{' '}
              <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 Vertos. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
