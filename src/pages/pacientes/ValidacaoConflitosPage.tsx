import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  UserCheck,
  FileText,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  HelpCircle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export interface Candidato {
  paciente_id: string;
  nome: string;
  data_nascimento: string;
  motivo: string;
  score?: number;
}

export interface FilaConflitoItem {
  id: string;
  ficha_id: string;
  pacientes_candidatos: Candidato[];
  status: 'pendente' | 'resolvida';
  resolvido_por?: string | null;
  resolvido_em?: string | null;
  decisao?: string | null;
  criado_em: string;
  fichas: {
    id: string;
    form_response_id: string;
    respostas: Record<string, any>;
    nome_informado: string;
    nascimento_informado: string;
    criado_em: string;
  };
}

function normalizarNome(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
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

export const ValidacaoConflitosPage: React.FC = () => {
  const { effectiveRole, profile } = useAuth();
  const [conflitos, setConflitos] = useState<FilaConflitoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [expandedFichaId, setExpandedFichaId] = useState<string | null>(null);

  const isCoordinator = effectiveRole === 'coordenador' || effectiveRole === 'admin_master';

  const fetchConflitos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('fila_conflitos')
        .select(`
          id,
          ficha_id,
          pacientes_candidatos,
          status,
          resolvido_por,
          resolvido_em,
          decisao,
          criado_em,
          fichas (
            id,
            form_response_id,
            respostas,
            nome_informado,
            nascimento_informado,
            criado_em
          )
        `)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false });

      if (dbErr) throw dbErr;

      // Transformação dos dados retornados
      const formatted = (data || []).map((item: any) => ({
        ...item,
        fichas: Array.isArray(item.fichas) ? item.fichas[0] : item.fichas
      }));

      setConflitos(formatted);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar fila de conflitos no Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflitos();
  }, [effectiveRole]);

  // Decisão 1: VINCULAR A PACIENTE EXISTENTE
  const handleVincularExistente = async (conflito: FilaConflitoItem, candidato: Candidato) => {
    setResolvingId(conflito.id);
    try {
      // 1. Atualiza a ficha com paciente_id e status='vinculada'
      const { error: errFicha } = await supabase
        .from('fichas')
        .update({
          paciente_id: candidato.paciente_id,
          status: 'vinculada'
        })
        .eq('id', conflito.ficha_id);

      if (errFicha) throw errFicha;

      // 2. Atualiza o registro em fila_conflitos para 'resolvida'
      const { error: errConflito } = await supabase
        .from('fila_conflitos')
        .update({
          status: 'resolvida',
          resolvido_por: profile?.id || null,
          resolvido_em: new Date().toISOString(),
          decisao: `VINCULADO_EXISTENTE: Vinculado ao paciente ${candidato.nome} (ID: ${candidato.paciente_id})`
        })
        .eq('id', conflito.id);

      if (errConflito) throw errConflito;

      await fetchConflitos();
    } catch (err: any) {
      alert(`Erro ao vincular ficha ao paciente: ${err.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  // Decisão 2: CRIAR NOVO PACIENTE
  const handleCriarNovoPaciente = async (conflito: FilaConflitoItem) => {
    setResolvingId(conflito.id);
    try {
      const nomeInf = conflito.fichas.nome_informado;
      const nascInf = conflito.fichas.nascimento_informado;
      const nomeNorm = normalizarNome(nomeInf);

      // 1. Cria novo paciente
      const { data: novoPac, error: errNovoPac } = await supabase
        .from('pacientes')
        .insert({
          nome: nomeInf,
          nome_normalizado: nomeNorm,
          data_nascimento: nascInf,
          status: 'ativo'
        })
        .select()
        .single();

      if (errNovoPac) throw errNovoPac;

      // 2. Vincula ficha ao novo paciente
      const { error: errFicha } = await supabase
        .from('fichas')
        .update({
          paciente_id: novoPac.id,
          status: 'vinculada'
        })
        .eq('id', conflito.ficha_id);

      if (errFicha) throw errFicha;

      // 3. Atualiza fila de conflitos para 'resolvida'
      const { error: errConflito } = await supabase
        .from('fila_conflitos')
        .update({
          status: 'resolvida',
          resolvido_por: profile?.id || null,
          resolvido_em: new Date().toISOString(),
          decisao: `CRIADO_NOVO_PACIENTE: Criado paciente ${novoPac.nome} (ID: ${novoPac.id})`
        })
        .eq('id', conflito.id);

      if (errConflito) throw errConflito;

      await fetchConflitos();
    } catch (err: any) {
      alert(`Erro ao criar novo paciente: ${err.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  if (!isCoordinator) {
    return (
      <DashboardLayout pageTitle="Acesso Restrito">
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-6 text-rose-800">
          <h3 className="font-bold text-base">Acesso Restrito</h3>
          <p className="text-xs mt-1">Apenas Coordenadores e Admin Master têm permissão para acessar a fila de validação de conflitos.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      pageTitle="Validação de Conflitos de Fichas"
      pageSubtitle="Fila de análise e resolução de ambiguidade para fichas recebidas do Google Forms"
    >
      <div className="space-y-6">
        {/* Banner Informativo */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Fila de Análise de Vínculos</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold">
                  {conflitos.length} pendente(s)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                As fichas listadas abaixo apresentaram similaridade com pacientes já cadastrados. Escolha se a ficha pertence a um paciente existente ou se deve criar um novo paciente.
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 bg-white border border-slate-200 rounded-xl">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin mb-2" />
            <p className="text-xs text-slate-500 font-medium">Carregando fila de conflitos do Supabase...</p>
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

        {/* Fila de Conflitos Pendentes */}
        {!loading && !error && (
          <div className="space-y-6">
            {conflitos.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200 rounded-xl text-center space-y-3 shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">Nenhum conflito pendente</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Todas as fichas recebidas do Google Forms foram vinculadas ou processadas com sucesso!
                </p>
              </div>
            ) : (
              conflitos.map((conflito) => {
                const ficha = conflito.fichas;
                const candidatos = conflito.pacientes_candidatos || [];
                const isResolving = resolvingId === conflito.id;
                const isExpanded = expandedFichaId === conflito.id;

                return (
                  <div
                    key={conflito.id}
                    className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all"
                  >
                    {/* Header do Card de Conflito */}
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Conflito de Vínculo (Ficha ID: {ficha.form_response_id})
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Recebida em {new Date(conflito.criado_em).toLocaleDateString('pt-BR')} às {new Date(conflito.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Comparação Lado a Lado */}
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* LADO ESQUERDO: FICHA RECEBIDA */}
                      <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-brand-600" />
                            Ficha Nova Recebida
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Pendente
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <span className="text-[11px] text-slate-400 block font-medium">Nome Informado:</span>
                            <span className="text-sm font-bold text-slate-900">{ficha.nome_informado}</span>
                          </div>

                          <div>
                            <span className="text-[11px] text-slate-400 block font-medium">Data de Nascimento:</span>
                            <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatarData(ficha.nascimento_informado)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60">
                          <button
                            onClick={() => setExpandedFichaId(isExpanded ? null : conflito.id)}
                            className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Ocultar Respostas do Forms' : 'Ver Respostas do Forms'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                              {Object.entries(ficha.respostas || {}).map(([p, r]) => (
                                <div key={p} className="bg-slate-50 p-2 rounded">
                                  <strong className="text-slate-700 block text-[11px]">{p}:</strong>
                                  <span className="text-slate-600">{String(r)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Botão de Criar Paciente Novo */}
                        <div className="pt-3 border-t border-slate-200">
                          <button
                            onClick={() => handleCriarNovoPaciente(conflito)}
                            disabled={isResolving}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isResolving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>Não é nenhum destes - Criar Paciente Novo</span>
                          </button>
                        </div>
                      </div>

                      {/* LADO DIREITO: CANDIDATOS ENCONTRADOS */}
                      <div className="lg:col-span-7 space-y-3">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <HelpCircle className="w-4 h-4 text-amber-600" />
                          Pacientes Candidatos Encontrados ({candidatos.length})
                        </span>

                        <div className="space-y-3">
                          {candidatos.map((cand) => (
                            <div
                              key={cand.paciente_id}
                              className="bg-white border border-slate-200 hover:border-brand-300 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                            >
                              <div className="space-y-1">
                                <h5 className="text-xs font-bold text-slate-900">{cand.nome}</h5>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  Nascimento: <strong className="text-slate-700">{formatarData(cand.data_nascimento)}</strong>
                                </p>
                                <p className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded inline-block border border-amber-100">
                                  💡 {cand.motivo}
                                </p>
                              </div>

                              <button
                                onClick={() => handleVincularExistente(conflito, cand)}
                                disabled={isResolving}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                              >
                                {isResolving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                                )}
                                <span>É este paciente</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ValidacaoConflitosPage;
