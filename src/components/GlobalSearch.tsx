import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckSquare, DollarSign } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Command, CommandInput, CommandList, CommandGroup,
  CommandItem, CommandEmpty, CommandSeparator,
} from '@/components/ui/command';
import { supabase } from '@/lib/supabase';

interface Result {
  id: string;
  label: string;
  type: 'company' | 'task' | 'transaction';
  subtitle?: string;
  path: string;
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const [companiesRes, tasksRes, txRes] = await Promise.all([
        supabase.from('companies').select('id, name, status').ilike('name', `%${q}%`).is('deleted_at', null).limit(5),
        supabase.from('tasks').select('id, name, status').ilike('name', `%${q}%`).limit(5),
        supabase.from('financial_transactions').select('id, category, amount, type').ilike('category', `%${q}%`).limit(5),
      ]);
      setResults([
        ...(companiesRes.data ?? []).map(c => ({
          id: c.id,
          label: String(c.name),
          type: 'company' as const,
          subtitle: String(c.status ?? ''),
          path: `/companies/${c.id}`,
        })),
        ...(tasksRes.data ?? []).map(t => ({
          id: t.id,
          label: String(t.name),
          type: 'task' as const,
          subtitle: String(t.status ?? ''),
          path: '/tasks',
        })),
        ...(txRes.data ?? []).map(t => ({
          id: t.id,
          label: String(t.category ?? 'Transação'),
          type: 'transaction' as const,
          subtitle: `R$ ${Number(t.amount).toLocaleString('pt-BR')}`,
          path: '/finance',
        })),
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); }
  }, [open]);

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  const companies = results.filter(r => r.type === 'company');
  const tasks     = results.filter(r => r.type === 'task');
  const txs       = results.filter(r => r.type === 'transaction');

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="overflow-hidden p-0 shadow-xl max-w-xl">
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput
            placeholder="Buscar empresas, tarefas, transações..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[400px]">
            {query.trim().length < 2 ? (
              <CommandEmpty>Digite ao menos 2 letras para buscar.</CommandEmpty>
            ) : loading ? (
              <CommandEmpty>Buscando...</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>Nenhum resultado para "{query}".</CommandEmpty>
            ) : (
              <>
                {companies.length > 0 && (
                  <CommandGroup heading="Empresas">
                    {companies.map(r => (
                      <CommandItem key={r.id} value={r.id} onSelect={() => handleSelect(r.path)}>
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{r.label}</span>
                        {r.subtitle && <span className="ml-2 text-xs text-muted-foreground capitalize">{r.subtitle}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {companies.length > 0 && (tasks.length > 0 || txs.length > 0) && <CommandSeparator />}
                {tasks.length > 0 && (
                  <CommandGroup heading="Tarefas">
                    {tasks.map(r => (
                      <CommandItem key={r.id} value={r.id} onSelect={() => handleSelect(r.path)}>
                        <CheckSquare className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{r.label}</span>
                        {r.subtitle && <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {tasks.length > 0 && txs.length > 0 && <CommandSeparator />}
                {txs.length > 0 && (
                  <CommandGroup heading="Financeiro">
                    {txs.map(r => (
                      <CommandItem key={r.id} value={r.id} onSelect={() => handleSelect(r.path)}>
                        <DollarSign className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{r.label}</span>
                        {r.subtitle && <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
          <div className="border-t border-border px-3 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">↵</kbd> abrir</span>
            <span><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">Esc</kbd> fechar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
