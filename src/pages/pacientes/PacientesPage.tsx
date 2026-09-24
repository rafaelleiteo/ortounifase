import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Calendar,
  FileText,
  Merge,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  ChevronRight,
  X,
  Phone,
  Clock,
  ShieldCheck,
  Building2,
  Sparkles
} from 'lucide-react';

export interface Paciente {
  id: string;
  nome: string;
  nome_normalizado: string;
  data_nascimento: string;
  telefone?: string | null;
  status: 'ativo' | 'mesclado';
  mesclado_com_id?: string | null;
  criado_em: string;
  fichas_count?: number;
}

export interface Ficha {
  id: string;
  paciente_id: string;
  form_response_id: string;
  respostas: Record<string, any>;
  nome_informado: string;
  nascimento_informado: string;
  status: 'vinculada' | 'pendente';
  criado_em: string;
}

function normalizar(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatarData(dataISO: string): string {
  if (!dataISO) return '-';
  const partes = dataISO.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataISO;
}

export const PacientesPage: React.FC = () => {
  const { effectiveRole, user } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingConflictsCount, setPendingConflictsCount] = useState<number>(0);

  // Modal de Detalhes do Paciente
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [pacienteFichas, setPacienteFichas] = useState<Ficha[]>([]);
  const [loadingFichas, setLoadingFichas] = useState<boolean>(false);
  const [expandedFichaId, setExpandedFichaId] = useState<string | null>(null);

  // Modal de Mesclar Pacientes
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [targetPacienteId, setTargetPacienteId] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const isCoordinator = effectiveRole === 'coordenador' || effectiveRole === 'admin_master';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Busca pacientes ativos
      const { data: pacData, error: pacErr } = await supabase
        .from('pacientes')
        .select('*')
        .eq('status', 'ativo')
        .order('nome', { ascending: true });

      if (pacErr) throw pacErr;

      // 2. Busca contagem de fichas por paciente
      const { data: fichasData } = await supabase
        .from('fichas')
        .select('paciente_id');

      const fichasMap: Record<string, number> = {};
      if (fichasData) {
        fichasData.forEach((f) => {
          if (f.paciente_id) {
            fichasMap[f.paciente_id] = (fichasMap[f.paciente_id] || 0) + 1;
          }
        });
      }

      const mergedList = (pacData || []).map((p) => ({
        ...p,
        fichas_count: fichasMap[p.id] || 0
      }));

      setPacientes(mergedList);

      // 3. Contagem de conflitos pendentes (se coordenador)
      if (isCoordinator) {
        const { count } = await supabase
          .from('fila_conflitos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente');
        setPendingConflictsCount(count || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar pacientes no Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [effectiveRole]);

  const handleOpenPaciente = async (paciente: Paciente) => {
    setSelectedPaciente(paciente);
    setLoadingFichas(true);
    try {
      const { data: fData, error: fErr } = await supabase
        .from('fichas')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('criado_em', { ascending: false });

      if (fErr) throw fErr;
      setPacienteFichas(fData || []);
    } catch (err: any) {
      console.error('Erro ao buscar fichas:', err);
    } finally {
      setLoadingFichas(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!selectedPaciente || !targetPacienteId) {
      setMergeError('Selecione o paciente principal para o qual mover as fichas.');
      return;
    }
    if (targetPacienteId === selectedPaciente.id) {
      setMergeError('O paciente de destino não pode ser o mesmo paciente atual.');
      return;
    }

    setIsMerging(true);
    setMergeError(null);

    try {
      // 1. Mover todas as fichas do paciente duplicado para o paciente de destino
      const { error: errFichas } = await supabase
        .from('fichas')
        .update({ paciente_id: targetPacienteId })
        .eq('paciente_id', selectedPaciente.id);

      if (errFichas) throw errFichas;

      // 2. Marcar paciente duplicado como mesclado
      const { error: errPac } = await supabase
        .from('pacientes')
        .update({
          status: 'mesclado',
          mesclado_com_id: targetPacienteId
        })
        .eq('id', selectedPaciente.id);

      if (errPac) throw errPac;

      setIsMergeModalOpen(false);
      setSelectedPaciente(null);
      await fetchData();
    } catch (err: any) {
      setMergeError(err.message || 'Erro ao executar mesclagem no banco de dados.');
    } finally {
      setIsMerging(false);
    }
  };

  // Filtro de busca por nome normalizado ou data de nascimento
  const filteredPacientes = pacientes.filter((p) => {
    if (!searchTerm.trim()) return true;
    const termNorm = normalizar(searchTerm);
    return (
      p.nome_normalizado.includes(termNorm) ||
      p.data_nascimento.includes(searchTerm.trim()) ||
      formatarData(p.data_nascimento).includes(searchTerm.trim())
    );
  });

  return (
    <DashboardLayout
      pageTitle="Cadastro Unificado de Pacientes"
      pageSubtitle="Prontuário e histórico de fichas clínicas enviadas pelo Google Forms"
    >
      <div className="space-y-6">
        {/* Banner com estatísticas & Botão de Validação */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Central de Pacientes OrtoUnifase
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Visualização unificada de pacientes e histórico de fichas. O sistema realiza deduplicação automática de dados clínicos recebidos.
              </p>
            </div>
          </div>

          {isCoordinator && (
            <Link
              to="/pacientes/validacao"
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors shrink-0 relative"
            >
              <UserCheck className="w-4 h-4" />
              <span>Fila de Validação de Fichas</span>
              {pendingConflictsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-rose-600 text-white text-[11px] font-extrabold rounded-full animate-pulse">
                  {pendingConflictsCount}
                </span>
              )}
            </Link>
          )}
        </div>

        {/* Barra de Pesquisa */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar paciente por nome ou data de nascimento (ex: Ana Maria, 12/04/1995)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-medium">Carregando pacientes do Supabase...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-5 shadow-xs flex items-start gap-3 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">Erro ao consultar pacientes</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Lista de Resultados */}
        {!loading && !error && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Pacientes Cadastrados ({filteredPacientes.length})
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Tabela public.pacientes
              </span>
            </div>

            {filteredPacientes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum paciente encontrado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {filteredPacientes.map((paciente) => (
                  <div
                    key={paciente.id}
                    onClick={() => handleOpenPaciente(paciente)}
                    className="p-5 hover:bg-slate-50/80 transition-colors flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                        {paciente.nome.substring(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {paciente.nome}
                        </h4>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Data Nasc: <strong className="text-slate-700 font-mono">{formatarData(paciente.data_nascimento)}</strong>
                          </span>

                          {paciente.telefone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {paciente.telefone}
                            </span>
                          )}

                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                            <FileText className="w-3 h-3 text-brand-600" />
                            {paciente.fichas_count || 0} ficha(s) vinculada(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-600 font-semibold group-hover:translate-x-1 transition-transform flex items-center">
                        Ver Histórico
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Paciente & Histórico de Fichas */}
      {selectedPaciente && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 border border-brand-200 flex items-center justify-center font-bold text-xs">
                  {selectedPaciente.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedPaciente.nome}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Nascimento: {formatarData(selectedPaciente.data_nascimento)} | ID: {selectedPaciente.id.substring(0, 8)}...
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isCoordinator && (
                  <button
                    onClick={() => {
                      setTargetPacienteId('');
                      setMergeError(null);
                      setIsMergeModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Merge className="w-3.5 h-3.5" />
                    <span>Mesclar com Outro Paciente</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedPaciente(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content / Fichas Chronological List */}
            <div className="p-6 overflow-y-auto space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" />
                <span>Histórico de Fichas do Forms ({pacienteFichas.length})</span>
              </h4>

              {loadingFichas ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                </div>
              ) : pacienteFichas.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                  Nenhuma ficha vinculada a este paciente.
                </div>
              ) : (
                <div className="space-y-3">
                  {pacienteFichas.map((ficha) => {
                    const isExpanded = expandedFichaId === ficha.id;
                    return (
                      <div
                        key={ficha.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 block">
                              Ficha enviada em {new Date(ficha.criado_em).toLocaleDateString('pt-BR')} às {new Date(ficha.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              ID Form: {ficha.form_response_id}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Vinculada
                            </span>
                            <button
                              onClick={() => setExpandedFichaId(isExpanded ? null : ficha.id)}
                              className="px-2.5 py-1 text-xs bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer"
                            >
                              {isExpanded ? 'Ocultar Respostas' : 'Ver Respostas Completas'}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Form Answers */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 bg-white p-4 rounded-lg border border-slate-200">
                            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                              Respostas do Formulário Google Forms:
                            </h5>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {Object.entries(ficha.respostas || {}).map(([pergunta, resposta]) => (
                                <div key={pergunta} className="bg-slate-50 p-2.5 rounded border border-slate-100">
                                  <span className="font-bold text-slate-800 block text-[11px]">{pergunta}</span>
                                  <span className="text-slate-600 mt-0.5 block leading-relaxed">
                                    {String(resposta)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mesclagem de Pacientes (Apenas Coordenador) */}
      {isMergeModalOpen && selectedPaciente && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 text-rose-600">
              <Merge className="w-6 h-6 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mesclar Paciente Duplicado</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Todas as fichas de <strong className="text-slate-800">{selectedPaciente.nome}</strong> serão movidas para o paciente principal selecionado abaixo. O paciente atual será marcado como <span className="text-rose-600 font-bold">mesclado/inativo</span>.
                </p>
              </div>
            </div>

            {mergeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {mergeError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selecione o Paciente Principal (Destino) *
              </label>
              <select
                value={targetPacienteId}
                onChange={(e) => setTargetPacienteId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="">-- Selecione o Paciente Principal --</option>
                {pacientes
                  .filter((p) => p.id !== selectedPaciente.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Nascimento: {formatarData(p.data_nascimento)})
                    </option>
                  ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={isMerging}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mesclando...</span>
                  </>
                ) : (
                  <>
                    <Merge className="w-3.5 h-3.5" />
                    <span>Confirmar Mesclagem</span>
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

export default PacientesPage;
