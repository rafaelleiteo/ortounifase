import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  CalendarDays,
  FileText,
  Info
} from 'lucide-react';
import {
  Turma,
  AlinhadorCalendario,
  formatarDataBR,
  formatarDataISO,
  agruparBlocos,
  BlocoClinica
} from '@/lib/alinhadoresTypes';
import {
  listarDatasCalendario,
  adicionarDataCalendario,
  adicionarDatasCalendarioEmLote,
  removerDataCalendario,
  verificarPedidosVinculadosData,
  sincronizarProximosPedidos
} from '@/lib/alinhadoresService';

interface AlinhadoresCalendarioTabProps {
  turmas: Turma[];
  turmaSelecionadaId: string;
  onSelecionarTurma: (turmaId: string) => void;
}

export const AlinhadoresCalendarioTab: React.FC<AlinhadoresCalendarioTabProps> = ({
  turmas,
  turmaSelecionadaId,
  onSelecionarTurma
}) => {
  const [datas, setDatas] = useState<AlinhadorCalendario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Inserção individual
  const [dataIndividual, setDataIndividual] = useState('');
  const [salvandoIndividual, setSalvandoIndividual] = useState(false);

  // Inserção em lote
  const [textoLote, setTextoLote] = useState('');
  const [salvandoLote, setSalvandoLote] = useState(false);
  const [mostrarLote, setMostrarLote] = useState(false);

  // Confirmação de exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<AlinhadorCalendario | null>(null);
  const [pedidosVinculadosCount, setPedidosVinculadosCount] = useState<number | null>(null);
  const [mudancaBaseInfo, setMudancaBaseInfo] = useState<{ proximaBase: string; pedidosAfetados: number } | null>(null);
  const [verificandoVinculos, setVerificandoVinculos] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const hojeISO = formatarDataISO(new Date());

  const carregarDatas = async () => {
    if (!turmaSelecionadaId) return;
    try {
      setCarregando(true);
      setErro(null);
      const lista = await listarDatasCalendario(turmaSelecionadaId);
      setDatas(lista);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao carregar datas do calendário.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDatas();
  }, [turmaSelecionadaId]);

  // Limpa mensagens após 5 segundos
  useEffect(() => {
    if (sucesso) {
      const timer = setTimeout(() => setSucesso(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [sucesso]);

  // Blocos calculados da turma
  const blocosCalculados = useMemo(() => {
    const datasStr = datas.map((d) => d.data);
    return agruparBlocos(datasStr);
  }, [datas]);

  // Mapeamento de cada data para seu bloco correspondente
  const mapaDataParaBloco = useMemo(() => {
    const mapa = new Map<string, { bloco: BlocoClinica; ehBase: boolean }>();
    for (const b of blocosCalculados) {
      for (const d of b.dias) {
        mapa.set(d, { bloco: b, ehBase: d === b.base });
      }
    }
    return mapa;
  }, [blocosCalculados]);

  // Adicionar data individual
  const handleAdicionarIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataIndividual || !turmaSelecionadaId) return;

    try {
      setSalvandoIndividual(true);
      setErro(null);

      // Verificar se já existe localmente
      if (datas.some((d) => d.data === dataIndividual)) {
        setErro(`A data ${formatarDataBR(dataIndividual)} já está cadastrada para esta turma.`);
        return;
      }

      await adicionarDataCalendario(turmaSelecionadaId, dataIndividual);
      await sincronizarProximosPedidos();
      setDataIndividual('');
      setSucesso(`Data ${formatarDataBR(dataIndividual)} cadastrada com sucesso!`);
      await carregarDatas();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao adicionar data no calendário.');
    } finally {
      setSalvandoIndividual(false);
    }
  };

  // Processar e adicionar em lote
  const handleAdicionarLote = async () => {
    if (!textoLote.trim() || !turmaSelecionadaId) return;

    try {
      setSalvandoLote(true);
      setErro(null);

      const linhas = textoLote
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const datasNormalizadas: string[] = [];
      const errosLinhas: string[] = [];

      for (const linha of linhas) {
        // Aceita DD/MM/AAAA ou AAAA-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(linha)) {
          const [dia, mes, ano] = linha.split('/').map(Number);
          if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
            errosLinhas.push(`Data inválida: ${linha}`);
          } else {
            const dataObj = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
            datasNormalizadas.push(formatarDataISO(dataObj));
          }
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(linha)) {
          datasNormalizadas.push(linha);
        } else {
          errosLinhas.push(`Formato não reconhecido: ${linha} (use dd/mm/aaaa)`);
        }
      }

      if (errosLinhas.length > 0) {
        setErro(`Erros encontrados no texto:\n${errosLinhas.join('\n')}`);
        return;
      }

      if (datasNormalizadas.length === 0) {
        setErro('Nenhuma data válida encontrada no texto.');
        return;
      }

      const resultado = await adicionarDatasCalendarioEmLote(turmaSelecionadaId, datasNormalizadas);
      await sincronizarProximosPedidos();
      setTextoLote('');
      setMostrarLote(false);
      setSucesso(
        `${resultado.adicionadas} data(s) adicionada(s) com sucesso.${
          resultado.ignoradas > 0 ? ` (${resultado.ignoradas} já existiam e foram ignoradas)` : ''
        }`
      );
      await carregarDatas();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao adicionar datas em lote.');
    } finally {
      setSalvandoLote(false);
    }
  };

  // Abrir diálogo de exclusão com verificação de mudança de base do bloco
  const handleIniciarExclusao = async (item: AlinhadorCalendario) => {
    setItemParaExcluir(item);
    setMudancaBaseInfo(null);
    setVerificandoVinculos(true);
    try {
      const count = await verificarPedidosVinculadosData(turmaSelecionadaId, item.data);
      setPedidosVinculadosCount(count);

      // Checa se esta data é a base de um bloco com mais de 1 dia
      const infoBloco = mapaDataParaBloco.get(item.data);
      if (infoBloco && infoBloco.ehBase && infoBloco.bloco.dias.length > 1) {
        const proximaBase = infoBloco.bloco.dias[1];
        setMudancaBaseInfo({
          proximaBase,
          pedidosAfetados: count
        });
      }
    } catch (err) {
      console.error(err);
      setPedidosVinculadosCount(0);
    } finally {
      setVerificandoVinculos(false);
    }
  };

  // Confirmar exclusão
  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return;

    try {
      setExcluindo(true);
      setErro(null);
      await removerDataCalendario(itemParaExcluir.id);
      await sincronizarProximosPedidos();
      setSucesso(`Data ${formatarDataBR(itemParaExcluir.data)} removida do calendário.`);
      setItemParaExcluir(null);
      setPedidosVinculadosCount(null);
      setMudancaBaseInfo(null);
      await carregarDatas();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao remover data do calendário.');
    } finally {
      setExcluindo(false);
    }
  };

  const turmaAtual = turmas.find((t) => t.id === turmaSelecionadaId);

  return (
    <div className="space-y-6">
      {/* Orientação e Seletor de Turma */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold text-slate-800">
              Calendário de Atendimentos Clínicos
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Estas datas definem os dias de atendimento de alinhadores de cada turma e alimentam a seleção de retornos dos pacientes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600 shrink-0">
            Turma:
          </label>
          <select
            value={turmaSelecionadaId}
            onChange={(e) => onSelecionarTurma(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mensagens de Sucesso e Erro */}
      {sucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{sucesso}</span>
        </div>
      )}

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {/* Painel de Inserção de Datas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {/* Card: Inserção Individual */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Adicionar Data
              </h4>
              <span className="text-[11px] text-brand-600 font-semibold">
                {turmaAtual?.nome}
              </span>
            </div>

            <form onSubmit={handleAdicionarIndividual} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Selecione a data da clínica:
                </label>
                <input
                  type="date"
                  value={dataIndividual}
                  onChange={(e) => setDataIndividual(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={salvandoIndividual || !dataIndividual}
                className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {salvandoIndividual ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Salvar Data</span>
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMostrarLote(!mostrarLote)}
                className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{mostrarLote ? 'Fechar Inserção em Lote' : 'Inserir Várias Datas (Lote)'}</span>
              </button>
            </div>
          </div>

          {/* Card: Inserção em Lote (Expansível) */}
          {mostrarLote && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  Colar Múltiplas Datas
                </h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Cole uma data por linha no formato <strong>dd/mm/aaaa</strong>. Datas duplicadas já existentes na turma serão ignoradas.
              </p>

              <textarea
                rows={6}
                value={textoLote}
                onChange={(e) => setTextoLote(e.target.value)}
                placeholder={'25/11/2026\n16/12/2026\n20/01/2027'}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <button
                type="button"
                onClick={handleAdicionarLote}
                disabled={salvandoLote || !textoLote.trim()}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {salvandoLote ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Processar e Inserir Datas</span>
              </button>
            </div>
          )}

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Importante</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              O cálculo de antecedência de 20 dias para lembrete e solicitação é gerado a partir da data de retorno do paciente vinculada a estas datas clínicas.
            </p>
          </div>
        </div>

        {/* Lista de Datas Cadastradas */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Datas Cadastradas ({datas.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Ordenadas cronologicamente para a turma {turmaAtual?.nome}
                </p>
              </div>

              {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>

            {carregando && datas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span>Carregando calendário da turma...</span>
              </div>
            ) : datas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Nenhuma data cadastrada para esta turma.</p>
                <p className="text-[11px] text-slate-400">
                  Utilize o formulário ao lado para adicionar as datas de atendimento clínico.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {blocosCalculados.map((bloco: BlocoClinica, idx: number) => {
                  const ehPassado = bloco.fim < hojeISO;
                  const ehHoje = bloco.dias.includes(hojeISO);
                  const ehFuturo = bloco.base > hojeISO;

                  let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                  let badgeTexto = 'Passado';

                  if (ehHoje) {
                    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                    badgeTexto = 'Hoje';
                  } else if (ehFuturo) {
                    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    badgeTexto = 'Futuro';
                  }

                  const ehIsolado = bloco.dias.length === 1;
                  const ehMaiorQueTres = bloco.dias.length > 3;

                  const labelBloco = ehIsolado
                    ? `Bloco ${formatarDataBR(bloco.base)} (base ${formatarDataBR(bloco.base)})`
                    : `Bloco ${formatarDataBR(bloco.base)} a ${formatarDataBR(bloco.fim)} (base ${formatarDataBR(bloco.base)})`;

                  return (
                    <div key={`${bloco.base}-${idx}`} className="p-4 space-y-3 bg-white">
                      {/* Cabeçalho do Bloco */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs">
                            {bloco.dias.length}d
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">
                              {labelBloco}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-2 font-mono">
                              ({bloco.dias.length} {bloco.dias.length === 1 ? 'dia' : 'dias'})
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {badgeTexto}
                        </span>
                      </div>

                      {/* Avisos Amarelos de Validação de Bloco */}
                      {ehIsolado && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Dia isolado: confira se não é erro de digitação.</span>
                        </div>
                      )}

                      {ehMaiorQueTres && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Bloco com mais de 3 dias seguidos ({bloco.dias.length} dias). O padrão usual da clínica é de 3 dias.</span>
                        </div>
                      )}

                      {/* Dias individuais do Bloco */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {bloco.dias.map((diaStr: string) => {
                          const itemCadastrado = datas.find((d) => d.data === diaStr);
                          if (!itemCadastrado) return null;
                          const ehBase = diaStr === bloco.base;

                          return (
                            <div
                              key={itemCadastrado.id}
                              className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                                ehBase
                                  ? 'bg-brand-50/50 border-brand-200 text-brand-950 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div>
                                  <span className="text-xs">{formatarDataBR(diaStr)}</span>
                                  {ehBase && (
                                    <span className="ml-1.5 text-[10px] uppercase font-bold text-brand-700 bg-brand-100/70 px-1.5 py-0.2 rounded">
                                      Base
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleIniciarExclusao(itemCadastrado)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Remover data do calendário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {itemParaExcluir && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Remover Data do Calendário
                </h3>
                <p className="text-xs text-slate-500">
                  Data: {formatarDataBR(itemParaExcluir.data)}
                </p>
              </div>
            </div>

            {verificandoVinculos ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando pedidos vinculados a esta data...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Alerta de Mudança de Base do Bloco */}
                {mudancaBaseInfo && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Atenção: Mudança da Data Base do Bloco</span>
                    </div>
                    <p>
                      Esta data é a <strong>primeira data (base)</strong> do bloco clínico.
                    </p>
                    <p>
                      Ao removê-la, a base do bloco passará para o dia seguinte: <strong>{formatarDataBR(mudancaBaseInfo.proximaBase)}</strong>.
                    </p>
                    {mudancaBaseInfo.pedidosAfetados > 0 ? (
                      <p className="text-amber-800 font-semibold">
                        Aproximadamente {mudancaBaseInfo.pedidosAfetados} pedido(s) de pacientes da turma vinculados a esta base serão sincronizados para a nova data base.
                      </p>
                    ) : (
                      <p className="text-amber-700">
                        Nenhum pedido existente está vinculado diretamente a esta data, e os próximos pedidos passarão a usar a nova base.
                      </p>
                    )}
                  </div>
                )}

                {/* Pedidos Vinculados */}
                {pedidosVinculadosCount && pedidosVinculadosCount > 0 && !mudancaBaseInfo ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Atenção: Pedidos vinculados</span>
                    </div>
                    <p>
                      Existem <strong>{pedidosVinculadosCount}</strong> pedido(s) de pacientes cadastrados para esta data na turma {turmaAtual?.nome}.
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Ao remover a data do calendário, os pedidos já existentes não serão apagados automaticamente se já foram solicitados.
                    </p>
                  </div>
                ) : null}

                {!mudancaBaseInfo && (!pedidosVinculadosCount || pedidosVinculadosCount === 0) && (
                  <p className="text-xs text-slate-600">
                    Tem certeza de que deseja remover a data <strong>{formatarDataBR(itemParaExcluir.data)}</strong> do calendário da turma {turmaAtual?.nome}?
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setItemParaExcluir(null);
                  setPedidosVinculadosCount(null);
                  setMudancaBaseInfo(null);
                }}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={excluindo || verificandoVinculos}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
              >
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirmar Remoção</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
