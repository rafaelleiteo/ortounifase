import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Link2,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  FileText,
  ClipboardList,
  Building2,
  Globe,
  BookOpen,
  Calendar,
  UserCheck,
  SlidersHorizontal,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  X,
  CheckCircle2,
  LucideIcon
} from 'lucide-react';

export interface LinkUtilItem {
  id: string;
  titulo: string;
  url: string;
  icone?: string | null;
  descricao?: string | null;
  papeis_visiveis: string[];
  ordem: number;
}

const AVAILABLE_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'ExternalLink', label: 'Link Externo (ExternalLink)', icon: ExternalLink },
  { key: 'FileText', label: 'Documento / Form (FileText)', icon: FileText },
  { key: 'ClipboardList', label: 'Prontuário / Triagem (ClipboardList)', icon: ClipboardList },
  { key: 'Building2', label: 'Sistema / Empresa (Building2)', icon: Building2 },
  { key: 'Globe', label: 'Website / Portal (Globe)', icon: Globe },
  { key: 'BookOpen', label: 'Manual / Guia (BookOpen)', icon: BookOpen },
  { key: 'Link2', label: 'Link Genérico (Link2)', icon: Link2 },
  { key: 'Calendar', label: 'Agenda / Calendário (Calendar)', icon: Calendar },
  { key: 'UserCheck', label: 'Acesso / Validação (UserCheck)', icon: UserCheck },
  { key: 'SlidersHorizontal', label: 'Parâmetros (SlidersHorizontal)', icon: SlidersHorizontal },
  { key: 'ShieldCheck', label: 'Segurança (ShieldCheck)', icon: ShieldCheck }
];

export const GestaoLinksUteisPage: React.FC = () => {
  const { effectiveRole } = useAuth();
  const [links, setLinks] = useState<LinkUtilItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados do Modal de Cadastro/Edição
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<LinkUtilItem | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    url: '',
    icone: 'ExternalLink',
    descricao: '',
    ordem: 1,
    papeis_visiveis: ['aluno', 'professor'] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Estados do Modal de Exclusão
  const [deletingItem, setDeletingItem] = useState<LinkUtilItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('links_uteis')
        .select('*')
        .order('ordem', { ascending: true });

      if (dbError) {
        setError(dbError.message);
      } else {
        setLinks(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar links do banco.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      titulo: '',
      url: '',
      icone: 'ExternalLink',
      descricao: '',
      ordem: links.length + 1,
      papeis_visiveis: ['aluno', 'professor']
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: LinkUtilItem) => {
    setEditingItem(item);
    setFormData({
      titulo: item.titulo,
      url: item.url,
      icone: item.icone || 'ExternalLink',
      descricao: item.descricao || '',
      ordem: item.ordem || 1,
      papeis_visiveis: item.papeis_visiveis || ['aluno', 'professor']
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleTogglePapel = (papel: string) => {
    setFormData((prev) => {
      const exists = prev.papeis_visiveis.includes(papel);
      if (exists) {
        return { ...prev, papeis_visiveis: prev.papeis_visiveis.filter((p) => p !== papel) };
      } else {
        return { ...prev, papeis_visiveis: [...prev.papeis_visiveis, papel] };
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim() || !formData.url.trim()) {
      setModalError('Título e URL são campos obrigatórios.');
      return;
    }
    if (formData.papeis_visiveis.length === 0) {
      setModalError('Selecione ao menos um papel de visualização.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        titulo: formData.titulo.trim(),
        url: formData.url.trim(),
        icone: formData.icone,
        descricao: formData.descricao.trim() || null,
        ordem: Number(formData.ordem) || 0,
        papeis_visiveis: formData.papeis_visiveis
      };

      if (editingItem) {
        const { error: updateErr } = await supabase
          .from('links_uteis')
          .update(payload)
          .eq('id', editingItem.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('links_uteis')
          .insert([payload]);

        if (insertErr) throw insertErr;
      }

      setIsModalOpen(false);
      await fetchLinks();
    } catch (err: any) {
      setModalError(err.message || 'Erro ao salvar link no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('links_uteis')
        .delete()
        .eq('id', deletingItem.id);

      if (delErr) throw delErr;

      setDeletingItem(null);
      await fetchLinks();
    } catch (err: any) {
      alert(`Erro ao excluir link: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isAccessAllowed = effectiveRole === 'coordenador' || effectiveRole === 'admin_master';

  if (!isAccessAllowed) {
    return (
      <DashboardLayout pageTitle="Acesso Negado">
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-6 text-rose-800">
          <h3 className="font-bold text-base">Acesso Restrito</h3>
          <p className="text-xs mt-1">Apenas Coordenadores e Admin Master têm permissão para gerenciar a lista de links úteis.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      pageTitle="Gestão de Links Úteis"
      pageSubtitle="Cadastrar, editar e excluir formulários e sistemas externos visíveis para alunos e professores"
    >
      <div className="space-y-6">
        {/* Banner Informativo & Ações */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shrink-0">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Painel Administrativo de Links Úteis
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Gerencie os atalhos exibidos para alunos e professores. As edições realizadas refletem instantaneamente no banco Supabase.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Link</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-medium">Carregando dados do Supabase...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-5 shadow-xs flex items-start gap-3 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">Erro de Banco de Dados</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Tabela de Links */}
        {!loading && !error && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Links Cadastrados ({links.length})
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Tabela public.links_uteis
              </span>
            </div>

            {links.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum link cadastrado no banco de dados. Clique em "Novo Link" para adicionar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 text-xs font-semibold">
                      <th className="py-3.5 px-4 w-12 text-center">Ordem</th>
                      <th className="py-3.5 px-6">Título & Descrição</th>
                      <th className="py-3.5 px-6">Ícone</th>
                      <th className="py-3.5 px-6">Papéis Visíveis</th>
                      <th className="py-3.5 px-6">URL Externa</th>
                      <th className="py-3.5 px-6 text-right w-28">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {links.map((item) => {
                      const iconObj = AVAILABLE_ICONS.find((i) => i.key === item.icone);
                      const IconComponent = iconObj ? iconObj.icon : Link2;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-4 text-center font-bold text-slate-500">
                            {item.ordem}
                          </td>
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-bold text-slate-900">{item.titulo}</p>
                              {item.descricao && (
                                <p className="text-[11px] text-slate-500 mt-0.5 max-w-md line-clamp-1">
                                  {item.descricao}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-brand-50 text-brand-600 border border-brand-100">
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-mono text-slate-600">
                                {item.icone || 'Padrao'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.papeis_visiveis.map((p) => (
                                <span
                                  key={p}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    p === 'aluno'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-mono text-brand-600 hover:underline max-w-[220px] truncate block"
                            >
                              {item.url}
                            </a>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar link"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingItem(item)}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Excluir link"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-brand-600" />
                <span>{editingItem ? 'Editar Link Útil' : 'Novo Link Útil'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título do Link *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sistema Clinicorp"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL Externa *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ícone Lucide
                  </label>
                  <select
                    value={formData.icone}
                    onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  >
                    {AVAILABLE_ICONS.map((i) => (
                      <option key={i.key} value={i.key}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve texto explicando a finalidade deste link..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Papéis Visíveis *
                </label>
                <div className="flex items-center gap-6 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.papeis_visiveis.includes('aluno')}
                      onChange={() => handleTogglePapel('aluno')}
                      className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span>Aluno</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.papeis_visiveis.includes('professor')}
                      onChange={() => handleTogglePapel('professor')}
                      className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span>Professor</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{editingItem ? 'Salvar Alterações' : 'Criar Link'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Excluir Link Útil</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tem certeza que deseja apagar o link <strong className="text-slate-800">{deletingItem.titulo}</strong>? Esta ação removerá o atalho para alunos e professores.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default GestaoLinksUteisPage;
