import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import {
  AgendaFixaItem,
  AgendaMensalItem,
  formatarHorarioExibicao,
  isItemBloqueio
} from '@/lib/agendaTypes';
import {
  planejarPromocao,
  PlanoPromocao,
  DadosDepoisPromocao,
  CandidatoPromocao
} from '@/lib/agendaPromocao';
import { pacientesNoHorario, formatarAvisoOcupacao } from '@/lib/agendaOcupacao';
import { promoverParaFixa, SolicitacaoPromocaoFixa } from '@/lib/agendaService';

export interface ModalPromoverParaFixaProps {
  aberto: boolean;
  onFechar: () => void;
  turmaId: string;
  mesReferencia: string;
  agendaFixa: AgendaFixaItem[];
  // Pode receber um item individual ou uma lista para lote
  itens: (AgendaMensalItem | any)[];
  titulo?: string;
  onSucesso: () => Promise<void> | void;
}

export const ModalPromoverParaFixa: React.FC<ModalPromoverParaFixaProps> = ({
  aberto,
  onFechar,
  turmaId,
  mesReferencia,
  agendaFixa,
  itens,
  titulo,
  onSucesso
}) => {
  const isLote = itens.length > 1;

  // Estado para modo individual
  const [candidatoEscolhidoId, setCandidatoEscolhidoId] = useState<string | 'NOVO'>('NOVO');

  // Estado para modo lote
  const [itensLoteSelecionados, setItensLoteSelecionados] = useState<Record<string, boolean>>({});

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inicializacao quando o modal abre
  useEffect(() => {
    if (!aberto || itens.length === 0) {
      setErro(null);
      return;
    }

    if (!isLote) {
      const plano = planejarPromocao({ itemMensal: itens[0], fixaItens: agendaFixa });
      if (plano.acao === 'ATUALIZAR' && plano.itemEscolhido) {
        setCandidatoEscolhidoId(plano.itemEscolhido.id);
      } else if (plano.candidatos.length > 0) {
        setCandidatoEscolhidoId(plano.candidatos[0].item.id);
      } else {
        setCandidatoEscolhidoId('NOVO');
      }
    } else {
      // Em lote, seleciona por padrao os que sao ATUALIZAR ou CRIAR
      const selecoes: Record<string, boolean> = {};
      itens.forEach((it) => {
        const plano = planejarPromocao({ itemMensal: it, fixaItens: agendaFixa });
        selecoes[it.id] = plano.acao === 'ATUALIZAR' || plano.acao === 'CRIAR';
      });
      setItensLoteSelecionados(selecoes);
    }
  }, [aberto, itens, agendaFixa, isLote]);

  if (!aberto || itens.length === 0) return null;

  // Renderizacao do Modo Individual
  const itemIndividual = itens[0];
  const planoIndividual = planejarPromocao({
    itemMensal: itemIndividual,
    fixaItens: agendaFixa
  });

  // Verificacao de ocupacao do horario de destino na fixa
  const ocupantesDestino = pacientesNoHorario(
    agendaFixa,
    planoIndividual.depois.dia_semana,
    planoIndividual.depois.horario,
    { excluirId: candidatoEscolhidoId !== 'NOVO' ? candidatoEscolhidoId : undefined }
  );
  const avisoOcupacaoDestino = formatarAvisoOcupacao(ocupantesDestino);

  const handleConfirmarIndividual = async () => {
    try {
      setSalvando(true);
      setErro(null);

      const solicitacao: SolicitacaoPromocaoFixa = {
        acao: candidatoEscolhidoId === 'NOVO' ? 'CRIAR' : 'ATUALIZAR',
        fixaId: candidatoEscolhidoId === 'NOVO' ? undefined : candidatoEscolhidoId,
        depois: planoIndividual.depois
      };

      const res = await promoverParaFixa(turmaId, [solicitacao], mesReferencia);

      if (res.erros.length > 0) {
        setErro(`Erro ao processar promocao: ${res.erros[0].erro}`);
        return;
      }

      await onSucesso();
      onFechar();
    } catch (err: any) {
      console.error('Falha ao promover para a agenda fixa:', err);
      setErro(err?.message || 'Falha inesperada ao atualizar a agenda fixa.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarLote = async () => {
    try {
      setSalvando(true);
      setErro(null);

      const solicitacoes: SolicitacaoPromocaoFixa[] = [];

      itens.forEach((it) => {
        if (!itensLoteSelecionados[it.id]) return;
        const plano = planejarPromocao({ itemMensal: it, fixaItens: agendaFixa });

        if (plano.acao === 'ATUALIZAR' && plano.itemEscolhido) {
          solicitacoes.push({
            acao: 'ATUALIZAR',
            fixaId: plano.itemEscolhido.id,
            depois: plano.depois
          });
        } else if (plano.acao === 'CRIAR') {
          solicitacoes.push({
            acao: 'CRIAR',
            depois: plano.depois
          });
        } else if (plano.acao === 'ESCOLHER' && plano.candidatos.length > 0) {
          // No lote, se houver candidato unico (parecido), atualiza ele
          solicitacoes.push({
            acao: 'ATUALIZAR',
            fixaId: plano.candidatos[0].item.id,
            depois: plano.depois
          });
        }
      });

      if (solicitacoes.length === 0) {
        setErro('Nenhum item selecionado para promocao.');
        return;
      }

      const res = await promoverParaFixa(turmaId, solicitacoes, mesReferencia);

      if (res.erros.length > 0) {
        const msg = res.erros.map((e) => `${e.paciente}: ${e.erro}`).join('; ');
        setErro(`Alguns itens falharam: ${msg}`);
      }

      await onSucesso();
      if (res.erros.length === 0) {
        onFechar();
      }
    } catch (err: any) {
      console.error('Falha ao processar lote para a agenda fixa:', err);
      setErro(err?.message || 'Falha inesperada ao atualizar a agenda fixa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecalho */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {titulo || (isLote ? 'Atualizar Agenda Fixa em Lote' : 'Promover Paciente para Agenda Fixa')}
              </h3>
              <p className="text-[11px] text-slate-500">
                Sincroniza os atendimentos da agenda mensal com a rotina da agenda fixa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Banner Informativo Obrigatorio */}
        <div className="p-4 px-6 bg-amber-50/90 border-b border-amber-200/80 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed font-medium">
            <strong>Atenção:</strong> A agenda mensal pode ter mudanças pontuais. Confirme apenas o que deve virar rotina fixa.
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {erro && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {!isLote ? (
            /* Modo Individual */
            <div className="space-y-4">
              {/* Card de Resumo do Mensal (Depois) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Dados da Agenda Mensal (Destino na Fixa)
                </span>
                <div className="text-sm font-bold text-slate-900">
                  {planoIndividual.depois.paciente}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {planoIndividual.depois.dia_semana}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {formatarHorarioExibicao(planoIndividual.depois.horario)}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {planoIndividual.depois.aluno || 'ATENDIMENTO EXTRA'}
                  </span>
                </div>
              </div>

              {/* Aviso de Ocupacao no Horario de Destino */}
              {avisoOcupacaoDestino && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    {avisoOcupacaoDestino}
                  </div>
                </div>
              )}

              {/* Opcoes de Candidatos / Acao */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Escolha como atualizar a Agenda Fixa:
                </label>

                {planoIndividual.candidatos.length > 0 && (
                  <div className="space-y-2">
                    {planoIndividual.candidatos.map((cand) => {
                      const f = cand.item;
                      const selecionado = candidatoEscolhidoId === f.id;
                      return (
                        <label
                          key={f.id}
                          className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                            selecionado
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="candidatoFixa"
                            value={f.id}
                            checked={selecionado}
                            onChange={() => setCandidatoEscolhidoId(f.id)}
                            className="mt-1 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                Atualizar registro existente: {f.paciente}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  cand.tipoMatch === 'exato'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                {cand.tipoMatch === 'exato' ? 'Nome Exato' : 'Nome Parecido'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>Atualmente na Fixa: {f.dia_semana} {formatarHorarioExibicao(f.horario)}</span>
                              <span>Aluno: {f.aluno || f.agenda_alunos?.nome || 'ATENDIMENTO EXTRA'}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Opcao de Criar Novo */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    candidatoEscolhidoId === 'NOVO'
                      ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="candidatoFixa"
                    value="NOVO"
                    checked={candidatoEscolhidoId === 'NOVO'}
                    onChange={() => setCandidatoEscolhidoId('NOVO')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Criar novo paciente na Agenda Fixa
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Insere este atendimento como uma nova rotina fixa sem alterar registros anteriores.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            /* Modo Lote */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 pb-1 border-b border-slate-100">
                <div>
                  Itens elegíveis para sincronização: <strong className="text-slate-800">{itens.length}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const todosMarcados = Object.values(itensLoteSelecionados).every(Boolean);
                    const novas: Record<string, boolean> = {};
                    itens.forEach((it) => {
                      novas[it.id] = !todosMarcados;
                    });
                    setItensLoteSelecionados(novas);
                  }}
                  className="text-xs text-brand-600 hover:underline font-bold"
                >
                  {Object.values(itensLoteSelecionados).every(Boolean)
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </button>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {itens.map((it) => {
                  const plano = planejarPromocao({ itemMensal: it, fixaItens: agendaFixa });
                  const marcado = Boolean(itensLoteSelecionados[it.id]);

                  // Ocupacao no destino
                  const ocupantes = pacientesNoHorario(
                    agendaFixa,
                    plano.depois.dia_semana,
                    plano.depois.horario,
                    { excluirId: plano.itemEscolhido?.id }
                  );
                  const avisoOc = formatarAvisoOcupacao(ocupantes);

                  return (
                    <label
                      key={it.id}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                        marcado
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) =>
                          setItensLoteSelecionados({
                            ...itensLoteSelecionados,
                            [it.id]: e.target.checked
                          })
                        }
                        className="mt-1 rounded-sm text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {it.paciente}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              plano.acao === 'ATUALIZAR'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : plano.acao === 'CRIAR'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {plano.acao === 'ATUALIZAR' ? 'Atualizar Fixa' : plano.acao === 'CRIAR' ? 'Criar na Fixa' : 'Revisar'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                          {plano.diferenca ? (
                            <span>
                              {plano.diferenca.diaAntes} {formatarHorarioExibicao(plano.diferenca.horarioAntes)} ➔{' '}
                              <strong>{plano.diferenca.diaDepois} {formatarHorarioExibicao(plano.diferenca.horarioDepois)}</strong>
                            </span>
                          ) : (
                            <span>
                              Destino: <strong>{plano.depois.dia_semana} {formatarHorarioExibicao(plano.depois.horario)}</strong> ({plano.depois.aluno || 'Extra'})
                            </span>
                          )}
                        </div>

                        {avisoOc && (
                          <div className="text-[10px] text-amber-700 flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{avisoOc}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodape com Botoes */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={salvando}
            onClick={isLote ? handleConfirmarLote : handleConfirmarIndividual}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {salvando ? (
              <span>Salvando...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isLote
                    ? `Confirmar Atualização em Lote (${Object.values(itensLoteSelecionados).filter(Boolean).length})`
                    : candidatoEscolhidoId === 'NOVO'
                    ? 'Criar na Agenda Fixa'
                    : 'Atualizar Registro na Fixa'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
