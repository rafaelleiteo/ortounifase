import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AgendaAluno,
  AgendaFixaItem,
  AgendaMensalItem,
  isAtendimentoExtra,
  getMembrosDupla
} from '@/lib/agendaTypes';
import {
  Users,
  Search,
  Edit2,
  Check,
  X,
  ArrowRightLeft,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  Plus
} from 'lucide-react';

interface GerenciarAlunosModalProps {
  isOpen: boolean;
  onClose: () => void;
  turmaId: string;
  turmaNome: string;
  alunos: AgendaAluno[];
  agendaFixa: AgendaFixaItem[];
  agendaMensal: AgendaMensalItem[];
  onAtualizar: () => Promise<void>;
}

export const GerenciarAlunosModal: React.FC<GerenciarAlunosModalProps> = ({
  isOpen,
  onClose,
  turmaId,
  turmaNome,
  alunos,
  agendaFixa,
  agendaMensal,
  onAtualizar
}) => {
  const [busca, setBusca] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [criandoAluno, setCriandoAluno] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const isEsp2 = (turmaNome || '').toUpperCase().includes('ESP2');

  // Estado para Edição de Nome Inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  // Estado para Modal de Mesclagem
  const [modalMesclar, setModalMesclar] = useState<{
    isOpen: boolean;
    alunoOficial?: AgendaAluno;
    alunoDuplicadoId: string;
    loading: boolean;
    erro?: string;
  }>({
    isOpen: false,
    alunoDuplicadoId: '',
    loading: false
  });

  // Contagem de atendimentos por aluno
  const fixaCountMap = useMemo(() => {
    const map = new Map<string, number>();
    agendaFixa.forEach((item) => {
      if (item.aluno_id) {
        map.set(item.aluno_id, (map.get(item.aluno_id) || 0) + 1);
      }
    });
    return map;
  }, [agendaFixa]);

  const mensalCountMap = useMemo(() => {
    const map = new Map<string, number>();
    agendaMensal.forEach((item) => {
      if (item.aluno_id) {
        map.set(item.aluno_id, (map.get(item.aluno_id) || 0) + 1);
      }
    });
    return map;
  }, [agendaMensal]);

  // Lista filtrada por busca
  const alunosFiltrados = useMemo(() => {
    return alunos.filter((a) =>
      a.nome.toLowerCase().includes(busca.trim().toLowerCase())
    );
  }, [alunos, busca]);

  const totalAtivos = alunos.filter((a) => a.ativo !== false).length;
  const totalInativos = alunos.filter((a) => a.ativo === false).length;

  // 1. Criar novo aluno
  const handleCriarAluno = async () => {
    if (!novoNome.trim()) return;
    setCriandoAluno(true);
    setErro(null);
    try {
      const { error: errInsert } = await supabase.from('agenda_alunos').insert({
        nome: novoNome.trim(),
        turma_id: turmaId,
        ativo: true
      });
      if (errInsert) throw errInsert;
      setNovoNome('');
      await onAtualizar();
      setMensagemSucesso('Aluno adicionado com sucesso!');
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err: any) {
      setErro('Erro ao adicionar aluno: ' + err.message);
    } finally {
      setCriandoAluno(false);
    }
  };

  // 2. Salvar Edição de Nome
  const handleIniciarEdicao = (aluno: AgendaAluno) => {
    setEditandoId(aluno.id);
    setNomeEmEdicao(aluno.nome);
  };

  const handleSalvarEdicaoNome = async (alunoId: string) => {
    if (!nomeEmEdicao.trim()) return;
    setSalvandoNome(true);
    setErro(null);
    try {
      const { error: errUpdate } = await supabase
        .from('agenda_alunos')
        .update({ nome: nomeEmEdicao.trim() })
        .eq('id', alunoId);

      if (errUpdate) throw errUpdate;

      setEditandoId(null);
      await onAtualizar();
      setMensagemSucesso('Nome do aluno atualizado com sucesso!');
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err: any) {
      setErro('Erro ao renomear aluno: ' + err.message);
    } finally {
      setSalvandoNome(false);
    }
  };

  // 3. Alternar Ativo / Inativo (Soft delete)
  const handleToggleAtivo = async (aluno: AgendaAluno) => {
    const novoStatus = aluno.ativo === false;
    setErro(null);
    try {
      const { error: errToggle } = await supabase
        .from('agenda_alunos')
        .update({ ativo: novoStatus })
        .eq('id', aluno.id);

      if (errToggle) throw errToggle;

      await onAtualizar();
      setMensagemSucesso(
        `Aluno "${aluno.nome}" marcado como ${novoStatus ? 'ativo' : 'inativo'}.`
      );
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err: any) {
      setErro('Erro ao alterar status do aluno: ' + err.message);
    }
  };

  // 4. Abrir Modal de Mesclagem
  const handleAbrirMesclar = (aluno: AgendaAluno) => {
    setModalMesclar({
      isOpen: true,
      alunoOficial: aluno,
      alunoDuplicadoId: '',
      loading: false,
      erro: undefined
    });
  };

  // 5. Executar Mesclagem Atômica
  const handleConfirmarMesclagem = async () => {
    if (!modalMesclar.alunoOficial || !modalMesclar.alunoDuplicadoId) return;

    setModalMesclar((prev) => ({ ...prev, loading: true, erro: undefined }));
    try {
      const { data, error: rpcError } = await supabase.rpc('mesclar_alunos', {
        p_aluno_oficial_id: modalMesclar.alunoOficial.id,
        p_aluno_duplicado_id: modalMesclar.alunoDuplicadoId
      });

      if (rpcError) throw rpcError;

      const dupNome = alunos.find((a) => a.id === modalMesclar.alunoDuplicadoId)?.nome || 'Duplicado';
      const fixaMigrados = data?.fixa_migrados || 0;
      const mensalMigrados = data?.mensal_migrados || 0;

      setModalMesclar({ isOpen: false, alunoDuplicadoId: '', loading: false });
      await onAtualizar();

      setMensagemSucesso(
        `Alunos mesclados com sucesso! Cadastro "${dupNome}" foi absorvido em "${modalMesclar.alunoOficial.nome}" (${fixaMigrados} atendimentos fixos e ${mensalMigrados} mensais migrados).`
      );
      setTimeout(() => setMensagemSucesso(null), 8000);
    } catch (err: any) {
      setModalMesclar((prev) => ({
        ...prev,
        loading: false,
        erro: err.message || 'Falha ao mesclar alunos.'
      }));
    }
  };

  // Quantidade de registros do aluno duplicado selecionado no modal
  const dupFixaCount = modalMesclar.alunoDuplicadoId
    ? fixaCountMap.get(modalMesclar.alunoDuplicadoId) || 0
    : 0;
  const dupMensalCount = modalMesclar.alunoDuplicadoId
    ? mensalCountMap.get(modalMesclar.alunoDuplicadoId) || 0
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div
        id="modal-gerenciar-alunos"
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                {isEsp2 ? 'Gerenciar Duplas — ' : 'Gerenciar Alunos — '}<span className="text-brand-600">{turmaNome}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {alunos.length} {isEsp2 ? 'duplas cadastradas' : 'alunos cadastrados'} ({totalAtivos} {isEsp2 ? 'ativas' : 'ativos'}, {totalInativos} {isEsp2 ? 'inativas' : 'inativos'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Feedback Messages */}
        {mensagemSucesso && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
            <span>{mensagemSucesso}</span>
            <button type="button" onClick={() => setMensagemSucesso(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
          </div>
        )}

        {erro && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{erro}</span>
            </div>
            <button type="button" onClick={() => setErro(null)} className="text-rose-600 hover:text-rose-800 font-bold">✕</button>
          </div>
        )}

        {/* Barra de Ações: Busca e Adicionar Aluno */}
        <div className="px-6 pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={isEsp2 ? "Buscar dupla ou membro..." : "Buscar aluno..."}
              className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder={isEsp2 ? "Nova dupla (ex: Nome 1 e Nome 2)..." : "Novo aluno..."}
              onKeyDown={(e) => e.key === 'Enter' && handleCriarAluno()}
              className="text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 w-full sm:w-48"
            />
            <button
              type="button"
              onClick={handleCriarAluno}
              disabled={criandoAluno || !novoNome.trim()}
              className="px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {isEsp2 ? 'Adicionar Dupla' : 'Adicionar'}
            </button>
          </div>
        </div>

        {/* Lista de Alunos */}
        <div className="p-6 overflow-y-auto space-y-2 flex-1">
          {alunosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum aluno encontrado para os critérios informados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
              {alunosFiltrados.map((aluno) => {
                const isExtra = isAtendimentoExtra(aluno.nome);
                const isEditando = editandoId === aluno.id;
                const isAtivo = aluno.ativo !== false;
                const totalFixa = fixaCountMap.get(aluno.id) || 0;
                const totalMensal = mensalCountMap.get(aluno.id) || 0;

                return (
                  <div
                    key={aluno.id}
                    data-aluno-row={aluno.id}
                    className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                      !isAtivo ? 'bg-slate-50/60 opacity-75' : 'hover:bg-slate-50/40'
                    }`}
                  >
                    {/* Informações do Aluno / Edição Inline */}
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isExtra
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : isAtivo
                            ? 'bg-brand-50 text-brand-700 border border-brand-200/70'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {aluno.nome.charAt(0).toUpperCase()}
                      </div>

                      {isEditando ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                          <input
                            type="text"
                            autoFocus
                            data-input-edicao-nome={aluno.id}
                            value={nomeEmEdicao}
                            onChange={(e) => setNomeEmEdicao(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSalvarEdicaoNome(aluno.id);
                              if (e.key === 'Escape') setEditandoId(null);
                            }}
                            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => handleSalvarEdicaoNome(aluno.id)}
                            disabled={salvandoNome || !nomeEmEdicao.trim()}
                            title="Salvar"
                            data-btn-salvar-edicao={aluno.id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoId(null)}
                            title="Cancelar"
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate" title={aluno.nome}>
                              {aluno.nome}
                            </span>
                            {isEsp2 && !isExtra && getMembrosDupla(aluno).length > 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                                Dupla
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold border ${
                                isAtivo
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isAtivo ? 'Ativo' : 'Inativo'}
                            </span>
                            {isExtra && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                                Atendimento Extra
                              </span>
                            )}
                          </div>
                          {isEsp2 && !isExtra && getMembrosDupla(aluno).length > 1 && (
                            <div className="text-[11px] font-medium text-indigo-700 mt-0.5">
                              Membros: {getMembrosDupla(aluno).join(' e ')}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {totalFixa} na agenda fixa • {totalMensal} na mensal
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação */}
                    {!isEditando && (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Editar Nome */}
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicao(aluno)}
                          title="Editar Nome do Aluno"
                          data-btn-editar={aluno.id}
                          className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1 font-medium"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>

                        {/* Mesclar com... */}
                        <button
                          type="button"
                          onClick={() => handleAbrirMesclar(aluno)}
                          title="Mesclar e absorver outro aluno duplicado neste cadastro"
                          data-btn-mesclar={aluno.id}
                          className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-1 font-medium"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Mesclar</span>
                        </button>

                        {/* Ativar / Desativar */}
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(aluno)}
                          title={isAtivo ? 'Desativar aluno (soft delete)' : 'Reativar aluno'}
                          data-btn-toggle-ativo={aluno.id}
                          className={`px-2.5 py-1.5 text-xs rounded-xl transition-all flex items-center gap-1 font-medium ${
                            isAtivo
                              ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isAtivo ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Desativar</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Reativar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Alunos inativos não aparecem como colunas vazias na agenda, preservando o histórico existente.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/70 bg-slate-100 rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Secundário: Confirmar Mesclagem */}
      {modalMesclar.isOpen && modalMesclar.alunoOficial && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            id="modal-confirmar-mesclar"
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Mesclar Alunos Duplicados</h4>
              </div>
              <button
                type="button"
                onClick={() => setModalMesclar({ isOpen: false, alunoDuplicadoId: '', loading: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-700 space-y-2">
              <p>
                Escolha o aluno duplicado que será <strong>absorvido e excluído</strong>. Todos os seus atendimentos serão reatribuídos para o aluno oficial:
              </p>
              <div className="p-3 bg-brand-50/70 border border-brand-200/80 rounded-xl">
                <div className="text-[11px] text-brand-700 font-bold uppercase tracking-wider">Aluno Oficial (Mantido):</div>
                <div className="text-sm font-bold text-brand-900 mt-0.5">{modalMesclar.alunoOficial.nome}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Aluno Duplicado a ser Absorvido <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-aluno-duplicado"
                value={modalMesclar.alunoDuplicadoId}
                onChange={(e) => setModalMesclar({ ...modalMesclar, alunoDuplicadoId: e.target.value, erro: undefined })}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Selecione o aluno duplicado...</option>
                {alunos
                  .filter((a) => a.id !== modalMesclar.alunoOficial?.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({fixaCountMap.get(a.id) || 0} fixos, {mensalCountMap.get(a.id) || 0} mensais)
                    </option>
                  ))}
              </select>
            </div>

            {/* Aviso de impacto */}
            {modalMesclar.alunoDuplicadoId && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  Impacto da Mesclagem:
                </div>
                <div>
                  • <strong>{dupFixaCount}</strong> atendimentos da Agenda Fixa serão transferidos.
                </div>
                <div>
                  • <strong>{dupMensalCount}</strong> atendimentos da Agenda Mensal serão transferidos.
                </div>
                <div className="text-rose-700 pt-1 font-semibold">
                  • O cadastro duplicado será permanentemente excluído após a migração.
                </div>
              </div>
            )}

            {modalMesclar.erro && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{modalMesclar.erro}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalMesclar({ isOpen: false, alunoDuplicadoId: '', loading: false })}
                disabled={modalMesclar.loading}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-mesclagem"
                onClick={handleConfirmarMesclagem}
                disabled={!modalMesclar.alunoDuplicadoId || modalMesclar.loading}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {modalMesclar.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mesclando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Confirmar Mesclagem
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
