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

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">Vertex</h1>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-xl">
            <p className="text-slate-300 text-sm">
              Link de redefinição inválido ou expirado. Solicite um novo link na página de login.
            </p>
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Vertex</h1>
          <p className="text-slate-400">Redefinição de senha</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-xl">
          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Senha redefinida!</h2>
              <p className="text-slate-400 text-sm">Você será redirecionado em instantes...</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-6">Nova senha</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    {...register('password')}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    disabled={isLoading}
                  />
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-slate-200">Confirmar senha</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repita a nova senha"
                    {...register('confirm')}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    disabled={isLoading}
                  />
                  {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 rounded-lg"
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
