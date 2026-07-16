import { useState, useEffect } from 'react';
import {
  Plus, FolderKanban, CheckCircle2, Circle,
  Building2, Calendar, ChevronRight, Loader2,
  Pencil, Trash2, X, MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  status: 'pending' | 'done';
  sort_order: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  is_template: boolean;
  created_at: string;
  company_name?: string;
  milestones?: Milestone[];
}

interface Company { id: string; name: string; }

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const BUILT_IN_TEMPLATES: { name: string; description: string; milestones: string[] }[] = [
  {
    name: 'Onboarding de Cliente',
    description: 'Processo padrão de entrada de um novo cliente na agência.',
    milestones: [
      'Reunião de briefing',
      'Coleta de acessos e senhas',
      'Configuração de ferramentas',
      'Alinhamento de cronograma',
      'Primeira entrega',
    ],
  },
  {
    name: 'Lançamento de Campanha',
    description: 'Fluxo completo para lançamento de campanha de tráfego pago.',
    milestones: [
      'Briefing criativo',
      'Produção de criativos',
      'Aprovação pelo cliente',
      'Configuração de campanhas',
      'Publicação e monitoramento',
      'Relatório de resultados',
    ],
  },
  {
    name: 'Relatório Mensal',
    description: 'Ciclo mensal de análise e entrega de relatório para o cliente.',
    milestones: [
      'Coleta de dados e métricas',
      'Análise e insights',
      'Montagem do relatório',
      'Apresentação ao cliente',
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function milestoneProgress(milestones: Milestone[]) {
  if (!milestones.length) return 0;
  return Math.round((milestones.filter(m => m.status === 'done').length / milestones.length) * 100);
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Projects() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [templateStep, setTemplateStep] = useState<'choose' | 'fill'>('choose');
  const [chosenTemplate, setChosenTemplate] = useState<(typeof BUILT_IN_TEMPLATES)[0] | null>(null);
  const [newForm, setNewForm] = useState({
    name: '', description: '', company_id: '', status: 'active', start_date: '', end_date: '',
  });
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name').is('deleted_at', null).order('name');
      return (data ?? []) as Company[];
    },
  });

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, name, description, company_id, status, start_date, end_date, is_template, created_at,
          companies(name),
          project_milestones(id, name, due_date, status, sort_order)
        `)
        .eq('is_template', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        company_name: (p.companies as { name?: string } | null)?.name ?? null,
        milestones: Array.isArray(p.project_milestones)
          ? (p.project_milestones as Milestone[]).sort((a, b) => a.sort_order - b.sort_order)
          : [],
      })) as Project[];
    },
  });

  const { data: projectMilestones = [], refetch: refetchMilestones } = useQuery<Milestone[]>({
    queryKey: ['milestones', selectedProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', selectedProject!.id)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
    enabled: !!selectedProject?.id && sheetOpen,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createProject = useMutation({
    mutationFn: async ({ form, milestoneNames }: { form: typeof newForm; milestoneNames: string[] }) => {
      const { data: proj, error } = await supabase.from('projects').insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        company_id: form.company_id || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }).select('id').single();
      if (error) throw error;
      if (milestoneNames.length) {
        await supabase.from('project_milestones').insert(
          milestoneNames.map((name, i) => ({ project_id: proj.id, name, sort_order: i }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto criado!');
      setShowNewModal(false);
      resetForm();
    },
    onError: () => toast.error('Erro ao criar projeto.'),
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Project> }) => {
      const { error } = await supabase.from('projects').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (selectedProject) {
        setSelectedProject(p => p ? { ...p, ...updateProject.variables?.updates } : p);
      }
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSheetOpen(false);
      toast.success('Projeto removido.');
    },
  });

  const toggleMilestone = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'done' }) => {
      const { error } = await supabase.from('project_milestones').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchMilestones();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const addMilestone = useMutation({
    mutationFn: async (name: string) => {
      const nextOrder = projectMilestones.length;
      const { error } = await supabase.from('project_milestones').insert({
        project_id: selectedProject!.id, name, sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchMilestones();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNewMilestoneName('');
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_milestones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => refetchMilestones(),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  function resetForm() {
    setNewForm({ name: '', description: '', company_id: '', status: 'active', start_date: '', end_date: '' });
    setTemplateStep('choose');
    setChosenTemplate(null);
  }

  function openProject(p: Project) {
    setSelectedProject(p);
    setEditTitle(p.name);
    setSheetOpen(true);
  }

  function applyTemplate(tpl: (typeof BUILT_IN_TEMPLATES)[0]) {
    setChosenTemplate(tpl);
    setNewForm(f => ({ ...f, name: tpl.name, description: tpl.description }));
    setTemplateStep('fill');
  }

  const handleCreate = () => {
    if (!newForm.name.trim()) { toast.error('Informe um nome.'); return; }
    createProject.mutate({
      form: newForm,
      milestoneNames: chosenTemplate?.milestones ?? [],
    });
  };

  useEffect(() => {
    if (!sheetOpen) setSelectedProject(null);
  }, [sheetOpen]);

  const progress = milestoneProgress(projectMilestones);
  const done = projectMilestones.filter(m => m.status === 'done').length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie projetos, marcos e entregas por cliente.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowNewModal(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      {/* Projects grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center border border-dashed border-border rounded-xl">
          <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhum projeto ainda.</p>
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowNewModal(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Criar primeiro projeto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const pct = milestoneProgress(p.milestones ?? []);
            const doneCount = (p.milestones ?? []).filter(m => m.status === 'done').length;
            const totalCount = (p.milestones ?? []).length;
            return (
              <div
                key={p.id}
                onClick={() => openProject(p)}
                className="bg-card border border-border rounded-xl p-5 space-y-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    {p.company_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.company_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? ''}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openProject(p)}>
                          <Pencil className="h-4 w-4 mr-2" /> Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => deleteProject.mutate(p.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}

                {totalCount > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{doneCount}/{totalCount} marcos</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )}

                {(p.start_date || p.end_date) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {formatDate(p.start_date)} {p.start_date && p.end_date && '→'} {formatDate(p.end_date)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Project Detail Sheet ───────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-[520px] p-0 flex flex-col">
          {selectedProject && (
            <>
              <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between gap-3">
                  {editingName ? (
                    <Input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => {
                        if (editTitle.trim() && editTitle !== selectedProject.name) {
                          updateProject.mutate({ id: selectedProject.id, updates: { name: editTitle.trim() } });
                          setSelectedProject(p => p ? { ...p, name: editTitle.trim() } : p);
                        }
                        setEditingName(false);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="text-lg font-semibold h-auto py-0 border-none focus-visible:ring-0 px-0"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-lg font-semibold text-foreground text-left hover:text-primary transition-colors truncate"
                    >
                      {selectedProject.name}
                    </button>
                  )}
                  <button onClick={() => setSheetOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {selectedProject.company_name && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {selectedProject.company_name}
                    </span>
                  )}
                  <Select
                    value={selectedProject.status}
                    onValueChange={v => {
                      updateProject.mutate({ id: selectedProject.id, updates: { status: v as Project['status'] } });
                      setSelectedProject(p => p ? { ...p, status: v as Project['status'] } : p);
                    }}
                  >
                    <SelectTrigger className={`h-6 text-xs font-medium border-0 px-2 py-0 rounded-full w-auto ${STATUS_COLORS[selectedProject.status]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(selectedProject.start_date || selectedProject.end_date) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedProject.start_date)} {selectedProject.start_date && selectedProject.end_date && '→'} {formatDate(selectedProject.end_date)}
                    </span>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
                {/* Milestones */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Marcos ({done}/{projectMilestones.length})
                    </h3>
                    {projectMilestones.length > 0 && (
                      <span className="text-xs text-muted-foreground">{progress}%</span>
                    )}
                  </div>

                  {projectMilestones.length > 0 && <Progress value={progress} className="h-1.5" />}

                  <div className="space-y-1">
                    {projectMilestones.map(m => (
                      <div key={m.id} className="flex items-center gap-2 group/m py-1">
                        <button
                          onClick={() => toggleMilestone.mutate({ id: m.id, status: m.status === 'done' ? 'pending' : 'done' })}
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {m.status === 'done'
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : <Circle className="h-4 w-4" />
                          }
                        </button>
                        <span className={`flex-1 text-sm ${m.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {m.name}
                        </span>
                        {m.due_date && (
                          <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.due_date)}</span>
                        )}
                        <button
                          onClick={() => deleteMilestone.mutate(m.id)}
                          className="opacity-0 group-hover/m:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add milestone */}
                  <div className="flex gap-2">
                    <Input
                      value={newMilestoneName}
                      onChange={e => setNewMilestoneName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newMilestoneName.trim()) {
                          addMilestone.mutate(newMilestoneName.trim());
                        }
                      }}
                      placeholder="Adicionar marco..."
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      disabled={!newMilestoneName.trim()}
                      onClick={() => addMilestone.mutate(newMilestoneName.trim())}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {selectedProject.description && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProject.description}</p>
                  </div>
                )}

                {/* Delete */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => deleteProject.mutate(selectedProject.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir projeto
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── New Project Modal ──────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg">
            {templateStep === 'choose' ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">Novo Projeto</h2>
                  <button onClick={() => setShowNewModal(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setTemplateStep('fill')}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">Projeto em branco</p>
                      <p className="text-xs text-muted-foreground">Comece do zero, adicione marcos depois</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <p className="text-xs text-muted-foreground px-1 pt-1">Ou escolha um template:</p>
                  {BUILT_IN_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      onClick={() => applyTemplate(tpl)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                        <p className="text-xs text-muted-foreground">{tpl.milestones.length} marcos pré-configurados</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {chosenTemplate ? chosenTemplate.name : 'Novo Projeto'}
                    </h2>
                    {chosenTemplate && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {chosenTemplate.milestones.length} marcos serão criados automaticamente
                      </p>
                    )}
                  </div>
                  <button onClick={() => setShowNewModal(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nome *</Label>
                    <Input
                      value={newForm.name}
                      onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nome do projeto"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Empresa</Label>
                    <Select value={newForm.company_id} onValueChange={v => setNewForm(f => ({ ...f, company_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sem empresa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem empresa</SelectItem>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Início</Label>
                      <Input type="date" value={newForm.start_date} onChange={e => setNewForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Fim</Label>
                      <Input type="date" value={newForm.end_date} onChange={e => setNewForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Textarea
                      value={newForm.description}
                      onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Objetivo do projeto..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setTemplateStep('choose')}>
                    ← Voltar
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)}>Cancelar</Button>
                    <Button size="sm" disabled={createProject.isPending} onClick={handleCreate}>
                      {createProject.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                      Criar Projeto
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
