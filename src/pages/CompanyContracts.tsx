import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FileText, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Contract {
  id: string;
  title: string;
  description?: string;
  file_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: string;
  name: string;
}

export default function CompanyContracts() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!companyId) return;
      
      setLoading(true);
      
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId)
        .single();

      if (companyError) {
        console.error('Erro ao buscar empresa:', companyError);
        toast.error('Erro ao carregar dados da empresa');
      } else if (companyData) {
        setCompany(companyData as Company);
      }

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (contractsError) {
        console.error('Erro ao buscar contratos:', contractsError);
        if (contractsError.code !== 'PGRST116') {
          toast.error('Erro ao carregar contratos');
        }
      } else if (contractsData) {
        setContracts(contractsData as Contract[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/companies')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Empresa não encontrada</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400';
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'expired': return 'bg-red-500/20 text-red-400';
      case 'cancelled': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'draft': 'Rascunho',
      'active': 'Ativo',
      'expired': 'Expirado',
      'cancelled': 'Cancelado',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/companies')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div>
        <h1 className="text-3xl font-bold text-foreground">Contratos - {company.name}</h1>
        <p className="text-muted-foreground mt-2">Visualize e gerencie todos os contratos desta empresa.</p>
      </div>

      {contracts.length > 0 ? (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{contract.title}</h3>
                    {contract.description && (
                      <p className="text-sm text-muted-foreground mt-1">{contract.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(contract.status)}`}>
                        {getStatusLabel(contract.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {contract.file_url && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => window.open(contract.file_url, '_blank')}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const link = document.createElement('a');
                        link.href = contract.file_url!;
                        link.download = contract.title;
                        link.click();
                      }}>
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg border border-border p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Nenhum contrato cadastrado para esta empresa ainda.</p>
        </div>
      )}
    </div>
  );
}
