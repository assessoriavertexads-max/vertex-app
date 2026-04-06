import { useState } from 'react';
import {
  DollarSign, ArrowUpRight, ArrowDownRight,
  CreditCard, Search, Link as LinkIcon, Plus, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table';

const mockTransactions = [
  { id: '1', company: 'TechCorp Solutions', type: 'income', amount: 5000, status: 'paid', dueDate: '2024-05-10', category: 'Assessoria Mensal' },
  { id: '2', company: 'Construtora Apex', type: 'income', amount: 12000, status: 'pending', dueDate: '2024-05-25', category: 'Setup de Projeto' },
  { id: '3', company: 'Padaria do João', type: 'income', amount: 1500, status: 'overdue', dueDate: '2024-05-01', category: 'Tráfego Pago' },
  { id: '4', company: 'Vertex (Interno)', type: 'expense', amount: 850, status: 'paid', dueDate: '2024-05-05', category: 'Ferramentas (AWS/Supabase)' },
];

export default function Finance() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const totalIncome = mockTransactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((acc, t) => acc + t.amount, 0);
  const totalPending = mockTransactions.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue')).reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = mockTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const filteredTransactions = mockTransactions.filter(t => {
    const matchesSearch = t.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3" /> Pago</span>;
      case 'pending': return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400"><Clock className="h-3 w-3" /> Aguardando</span>;
      case 'overdue': return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400"><AlertCircle className="h-3 w-3" /> Vencido</span>;
      default: return null;
    }
  };

  const filterBtnClass = (type: string, activeColor: string) =>
    `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === type ? `bg-card shadow text-${activeColor}` : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de caixa e integrações de pagamento (Asaas).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Nova Saída
          </Button>
          <Button>
            <CreditCard className="h-4 w-4 mr-2" /> Cobrar Cliente (Asaas)
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Receita Recebida</span>
            <ArrowUpRight className="h-4 w-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-green-400 mt-1">+12% este mês</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">A Receber (Asaas)</span>
            <DollarSign className="h-4 w-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground mt-1">Faturas pendentes e vencidas</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Saídas / Custos</span>
            <ArrowDownRight className="h-4 w-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground mt-1">Custos operacionais Vertex</p>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setFilterType('all')} className={filterBtnClass('all', 'foreground')}>Todas</button>
            <button onClick={() => setFilterType('income')} className={filterBtnClass('income', 'green-400')}>Entradas</button>
            <button onClick={() => setFilterType('expense')} className={filterBtnClass('expense', 'red-400')}>Saídas</button>
          </div>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição / Cliente</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Ação Asaas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{t.company}</p>
                  <p className="text-xs text-muted-foreground">{t.category}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(t.dueDate).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell className={`font-semibold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  {t.type === 'income' && t.status !== 'paid' && (
                    <Button variant="outline" size="sm">
                      <LinkIcon className="h-3 w-3 mr-1" /> Link Pagamento
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
