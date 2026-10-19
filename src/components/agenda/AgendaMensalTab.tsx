import React, { useState, useMemo } from 'react';
import {
  AgendaAluno,
  AgendaMensalItem,
  InconsistenciaItem,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  DIAS_SEMANA,
  TurnoAgenda,
  OPCOES_TURNO,
  HORARIO_DIVISOR_TURNO,
  getHorariosPorTurno,
  getHorariosTurma,
  normalizarHorario,
  formatarHorarioExibicao,
  isAtendimentoExtra,
  NOME_ATENDIMENTO_EXTRA,
  DiaSemana,
  formatarAlteracaoParaRecepcao,
  TipoBloqueio,
  getTipoBloqueio,
  getDescricaoBloqueio,
  isItemBloqueio,
  sugerirSequenciaFecharHorario,
  obterColunasTurma
} from '@/lib/agendaTypes';
import { AgendaFiltrosHeader } from './AgendaFiltrosHeader';
import {
  Calendar,
  User,
  Clock,
  UploadCloud,
  Download,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  UserPlus,
  HelpCircle,
  Plus,
  FileText,
  Copy,
  Check,
  Lock,
  Link2
} from 'lucide-react';
import { AgendaCardAtendimento } from './AgendaCardAtendimento';
import { AgendaModaisAtendimento } from './AgendaModaisAtendimento';
import { useAgendaModais } from './useAgendaModais';

interface AgendaMensalTabProps {
  turmaNome: string;
  alunos: AgendaAluno[];
  agendaMensal: AgendaMensalItem[];
  inconsistencias: InconsistenciaItem[];
  mesReferencia: string;
  onMesReferenciaChange: (mes: string) => void;
  diaSelecionado?: string;
  onDiaSelecionadoChange?: (dia: string) => void;
  periodo?: TurnoAgenda;
  onPeriodoChange?: (periodo: TurnoAgenda) => void;
  onAbrirImportModal: () => void;
  onSalvarItem?: (dados: {
    id?: string;
    paciente?: string;
    aluno_id?: string | null;
    horario?: string;
    dia_semana?: string;
    tipo_registro?: 'paciente' | 'bloqueio';
    tipo_bloqueio?: TipoBloqueio;
  }) => Promise<void> | void;
  onRemoverItem?: (id: string, pacienteNome?: string) => Promise<void> | void;
  isCoordenadorOrAdmin?: boolean;
}

export const AgendaMensalTab: React.FC<AgendaMensalTabProps> = ({
  turmaNome,
  alunos,
  agendaMensal,
  inconsistencias,
  mesReferencia,
  onMesReferenciaChange,
  diaSelecionado: diaProp,
  onDiaSelecionadoChange,
  periodo: periodoProp,
  onPeriodoChange,
  onAbrirImportModal,
  onSalvarItem,
  onRemoverItem,
  isCoordenadorOrAdmin = false
}) => {
  const [diaLocal, setDiaLocal] = useState<string>('QUINTA');
  const diaSelecionadoRaw = diaProp !== undefined ? diaProp : diaLocal;
  const diaSelecionado = (diaSelecionadoRaw && diaSelecionadoRaw !== 'TODOS') ? diaSelecionadoRaw : 'QUINTA';
  const handleDiaChange = onDiaSelecionadoChange || setDiaLocal;

  const [periodoLocal, setPeriodoLocal] = useState<TurnoAgenda>('TODOS');
  const periodo = periodoProp !== undefined ? periodoProp : periodoLocal;
  const handlePeriodoChange = onPeriodoChange || setPeriodoLocal;

  // Colunas da Agenda Mensal:
  // - ESP2: As 4 duplas na ordem estrita + Atendimento Extra por último (sempre visível, mesmo vazia)
  // - ESP1 e Serviço: Alunos ativos + Atendimento Extra por último (sempre visível, mesmo vazia)
  const alunosOrdenados = useMemo(() => {
    return obterColunasTurma(turmaNome, alunos, agendaMensal);
  }, [turmaNome, alunos, agendaMensal]);

  const horarios = getHorariosPorTurno(periodo, turmaNome);

  // Mapas por chave: `${alunoId}_${horario}` => lista de itens (suporta múltiplos extras no mesmo horário)
  const mensalMap = new Map<string, AgendaMensalItem[]>();
  agendaMensal
    .filter((item) => (item.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase())
    .forEach((item) => {
      const hNorm = normalizarHorario(item.horario);
      const isItemExtra = !item.aluno_id || isAtendimentoExtra(item.aluno);
      const chaveAluno = isItemExtra ? 'EXTRA_VIRTUAL' : (item.aluno_id || 'EXTRA_VIRTUAL');
      const key = `${chaveAluno}_${hNorm}`;
      const existing = mensalMap.get(key) || [];
      existing.push(item);
      mensalMap.set(key, existing);
    });

  // Mapeia inconsistências do dia selecionado
  // Guarda por horário para cruzamento
  const incPorHorario = inconsistencias.filter(
    (inc) => (inc.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase()
  );

  // Função para determinar o status/cor da inconsistência em um card
  const getInconsistenciaInfo = (pacienteNome: string, horario: string, alunoNome?: string) => {
    const hNorm = normalizarHorario(horario);
    const match = incPorHorario.find((inc) => {
      const matchName = inc.paciente.toLowerCase() === pacienteNome.toLowerCase();
      if (inc.tipo === 'HORARIO_ALTERADO' && matchName) {
        return true;
      }
      return (
        normalizarHorario(inc.horario) === hNorm &&
        (matchName || (inc.aluno_mensal && alunoNome && inc.aluno_mensal.toLowerCase() === alunoNome.toLowerCase()))
      );
    });

    if (!match) return null;

    const tNorm = (match.tipo || '').toUpperCase().trim();
    if (tNorm === 'AUSENTE') {
      return {
        tipo: 'AUSENTE',
        corBorder: 'border-rose-400 bg-rose-50/70 text-rose-900',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
        label: 'Ausente na Fixa',
        detalhe: match.observacao || 'Paciente não compareceu no horário habitual da agenda fixa'
      };
    }
    if (tNorm === 'ALUNO_TROCADO') {
      return {
        tipo: 'ALUNO_TROCADO',
        corBorder: 'border-amber-400 bg-amber-50/70 text-amber-900',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        label: 'Aluno Trocado',
        detalhe: `Fixa: ${match.aluno_fixa || 'Outro'} ➔ Mensal: ${match.aluno_mensal || 'Outro'}`
      };
    }
    if (tNorm === 'PACIENTE_NOVO') {
      return {
        tipo: 'PACIENTE_NOVO',
        corBorder: 'border-emerald-400 bg-emerald-50/70 text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        label: 'Paciente Novo',
        detalhe: 'Não cadastrado neste dia na agenda fixa'
      };
    }
    if (tNorm === 'HORARIO_ALTERADO') {
      return {
        tipo: 'HORARIO_ALTERADO',
        corBorder: 'border-blue-400 bg-blue-50/70 text-blue-900',
        badge: 'bg-blue-100 text-blue-800 border-blue-300',
        label: 'Horário Alterado',
        detalhe: match.observacao ? `Horário alterado: ${match.observacao}` : 'Horário alterado em relação à agenda fixa'
      };
    }
    return {
      tipo: match.tipo,
      corBorder: 'border-slate-300 bg-slate-50 text-slate-800',
      badge: 'bg-slate-100 text-slate-800 border-slate-300',
      label: match.tipo || 'Inconsistência',
      detalhe: match.observacao || 'Inconsistência identificada'
    };
  };

  // Também verificar se há pacientes AUSENTES na fixa para esse dia/horário que não estão em nenhuma célula do mensal
  const ausentesDoDia = incPorHorario.filter((inc) => inc.tipo === 'AUSENTE');

  // Hook compartilhado para gestão de modais de atendimento (Editar, Reagendar, Trocar Aluno)
  const {
    modalEditar,
    modalReagendar,
    modalTrocarAluno,
    abrirEditar,
    abrirReagendar,
    abrirTrocarAluno,
    fecharEditar,
    fecharReagendar,
    fecharTrocarAluno,
    handleSalvarEditar,
    handleSalvarReagendar,
    handleSalvarTrocaAluno,
    setModalEditar,
    setModalReagendar,
    setModalTrocarAluno
  } = useAgendaModais({
    onSalvarItem: async (dados) => {
      if (onSalvarItem) {
        await onSalvarItem(dados);
      }
    },
    itensExistentes: agendaMensal.map((m) => ({
      id: m.id,
      paciente: m.paciente,
      aluno_id: m.aluno_id,
      aluno: m.aluno,
      horario: m.horario,
      dia_semana: m.dia_semana
    })),
    alunos: alunosOrdenados.filter((a) => a.id !== 'EXTRA_VIRTUAL'),
    diaDefault: diaSelecionado
  });

  // Modal para "+ Adicionar Paciente" na Agenda Mensal
  const [modalNovoPaciente, setModalNovoPaciente] = useState<{
    isOpen: boolean;
    pacienteNome: string;
    diaSemana: string;
    horario: string;
    alunoId: string;
  }>({
    isOpen: false,
    pacienteNome: '',
    diaSemana: 'QUINTA',
    horario: '08:00',
    alunoId: ''
  });

  // Modal para "Fechar Horário (Bloqueio)" na Agenda Mensal
  const [modalFecharHorario, setModalFecharHorario] = useState<{
    isOpen: boolean;
    alunoId: string;
    horario: string;
    diaSemana: string;
    tipoBloqueio: TipoBloqueio;
    descricao: string;
    sugestaoSequencia: string;
  }>({
    isOpen: false,
    alunoId: '',
    horario: '',
    diaSemana: 'QUINTA',
    tipoBloqueio: 'SEQUENCIA',
    descricao: '',
    sugestaoSequencia: ''
  });

  // Modal para visualização e cópia do Resumo de Alterações para a Recepção
  const [modalResumoRecepcao, setModalResumoRecepcao] = useState<{
    isOpen: boolean;
    copiado: boolean;
  }>({
    isOpen: false,
    copiado: false
  });

  const handleSalvarNovoPaciente = async () => {
    if (!modalNovoPaciente.pacienteNome.trim() || !onSalvarItem) return;
    const isExtra = modalNovoPaciente.alunoId === 'EXTRA_VIRTUAL' || !modalNovoPaciente.alunoId;
    await onSalvarItem({
      paciente: modalNovoPaciente.pacienteNome.trim(),
      dia_semana: modalNovoPaciente.diaSemana,
      horario: normalizarHorario(modalNovoPaciente.horario),
      aluno_id: isExtra ? null : modalNovoPaciente.alunoId
    });
    setModalNovoPaciente({
      isOpen: false,
      pacienteNome: '',
      diaSemana: diaSelecionado,
      horario: '08:00',
      alunoId: alunosOrdenados[0]?.id || ''
    });
  };

  const handleSalvarFecharHorario = async () => {
    if (!modalFecharHorario.alunoId || !onSalvarItem) return;
    const tipo = modalFecharHorario.tipoBloqueio;
    let descFinal = '';

    if (tipo === 'SEQUENCIA') {
      descFinal = modalFecharHorario.descricao.trim() || modalFecharHorario.sugestaoSequencia || 'Continuação';
    } else if (tipo === 'LIVRE') {
      descFinal = 'Horário Livre';
    } else {
      descFinal = modalFecharHorario.descricao.trim() || 'Bloqueio de Horário';
    }

    const pacientePayload = `[${tipo}] ${descFinal.replace(/^\[(SEQUENCIA|LIVRE|OUTRO)\]\s*/i, '')}`;
    const isExtra = modalFecharHorario.alunoId === 'EXTRA_VIRTUAL' || !modalFecharHorario.alunoId;

    await onSalvarItem({
      aluno_id: isExtra ? null : modalFecharHorario.alunoId,
      horario: normalizarHorario(modalFecharHorario.horario),
      dia_semana: modalFecharHorario.diaSemana,
      paciente: pacientePayload,
      tipo_registro: 'bloqueio',
      tipo_bloqueio: tipo
    });

    setModalFecharHorario({
      isOpen: false,
      alunoId: '',
      horario: '',
      diaSemana: 'QUINTA',
      tipoBloqueio: 'SEQUENCIA',
      descricao: '',
      sugestaoSequencia: ''
    });
  };

  // Mapeamento e estruturação de alterações para a recepção a partir da tabela inconsistencias (bloqueios são ignorados)
  const listaAlteracoesRecepcao = useMemo(() => {
    return inconsistencias
      .filter((inc) => !isItemBloqueio(inc))
      .map((inc) => {
        const alunoResp = inc.tipo === 'AUSENTE'
          ? (inc.aluno_fixa || 'Não informado')
          : (inc.aluno_mensal || inc.aluno_fixa || 'Não informado');

        return {
          id: inc.id,
          paciente: inc.paciente,
          alunoResp,
          diaSemana: inc.dia_semana,
          horario: formatarHorarioExibicao(inc.horario),
          tipo: inc.tipo,
          descricao: formatarAlteracaoParaRecepcao(inc),
          observacao: inc.observacao
        };
      });
  }, [inconsistencias]);

  // Exportação CSV Completa com Coluna e Seção de Resumo para Recepção
  const handleExportarCSV = () => {
    if (agendaMensal.length === 0) {
      alert('Não há registros na Agenda Mensal para exportar.');
      return;
    }

    const alunoNomeMap = new Map<string, string>();
    alunos.forEach((a) => alunoNomeMap.set(a.id, a.nome));

    const headers = ['dia_semana', 'horario', 'paciente', 'aluno', 'status_inconsistencia', 'alteracao_recepcao'];
    const escapeCSV = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

    const rows = agendaMensal.map((item) => {
      let nomeAluno = 'ATENDIMENTO EXTRA';
      if (item.aluno_id && alunoNomeMap.has(item.aluno_id)) {
        nomeAluno = alunoNomeMap.get(item.aluno_id)!;
      } else if (item.agenda_alunos?.nome) {
        nomeAluno = item.agenda_alunos.nome;
      } else if (item.aluno && item.aluno.trim()) {
        nomeAluno = item.aluno.trim();
      }

      // Procura inconsistência correspondente para determinar texto de alteração
      const matchInc = inconsistencias.find((inc) => {
        const mesmoDia = (inc.dia_semana || '').toUpperCase().trim() === (item.dia_semana || '').toUpperCase().trim();
        if (!mesmoDia) return false;

        const matchName = inc.paciente.toLowerCase().trim() === item.paciente.toLowerCase().trim();
        if (inc.tipo === 'HORARIO_ALTERADO' && matchName) {
          return true;
        }
        return (
          normalizarHorario(inc.horario) === normalizarHorario(item.horario) &&
          (matchName || (inc.aluno_mensal && nomeAluno && inc.aluno_mensal.toLowerCase() === nomeAluno.toLowerCase()))
        );
      });

      const isBloqueio = isItemBloqueio(item);
      let statusInconsistencia = isBloqueio ? 'Bloqueio' : 'OK';
      let alteracaoRecepcao = isBloqueio ? getDescricaoBloqueio(item.paciente) : 'Conforme agenda fixa';

      if (!isBloqueio && matchInc) {
        const tNorm = (matchInc.tipo || '').toUpperCase().trim();
        if (tNorm === 'HORARIO_ALTERADO') statusInconsistencia = 'Horário Alterado';
        else if (tNorm === 'ALUNO_TROCADO') statusInconsistencia = 'Aluno Trocado';
        else if (tNorm === 'PACIENTE_NOVO') statusInconsistencia = 'Paciente Novo';
        else if (tNorm === 'AUSENTE') statusInconsistencia = 'Ausente';
        else statusInconsistencia = matchInc.tipo;

        alteracaoRecepcao = formatarAlteracaoParaRecepcao(matchInc);
      }

      return [
        escapeCSV(item.dia_semana),
        escapeCSV(formatarHorarioExibicao(item.horario)),
        escapeCSV(isBloqueio ? getDescricaoBloqueio(item.paciente) : item.paciente),
        escapeCSV(nomeAluno),
        escapeCSV(statusInconsistencia),
        escapeCSV(alteracaoRecepcao)
      ].join(';');
    });

    // Seção adicional: Resumo de Alterações para a Recepção
    const headersRecepcao = ['paciente', 'aluno_responsavel', 'dia_semana', 'horario', 'alteracao_realizada'];
    const rowsRecepcao = listaAlteracoesRecepcao.map((alt) =>
      [
        escapeCSV(alt.paciente),
        escapeCSV(alt.alunoResp),
        escapeCSV(alt.diaSemana),
        escapeCSV(alt.horario),
        escapeCSV(alt.descricao)
      ].join(';')
    );

    const secaoRecepcao = [
      '',
      escapeCSV('--- RESUMO DE ALTERAÇÕES DO MÊS PARA A RECEPÇÃO ---'),
      headersRecepcao.join(';'),
      ...(rowsRecepcao.length > 0
        ? rowsRecepcao
        : [escapeCSV('Nenhuma alteração registrada neste mês - todos os atendimentos conformes com a Agenda Fixa.')])
    ];

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows, ...secaoRecepcao].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const anoMes = mesReferencia.substring(0, 7);
    const nomeLimpoTurma = turmaNome.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `agenda_mensal_${nomeLimpoTurma}_${anoMes}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Exportação de CSV exclusivo para a Recepção
  const handleBaixarCSVResumoRecepcao = () => {
    const headersRecepcao = ['paciente', 'aluno_responsavel', 'dia_semana', 'horario', 'alteracao_realizada'];
    const escapeCSV = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const anoMes = mesReferencia.substring(0, 7);
    const nomeLimpoTurma = turmaNome.replace(/[^a-zA-Z0-9_-]/g, '_');

    const rowsRecepcao = listaAlteracoesRecepcao.map((alt) =>
      [
        escapeCSV(alt.paciente),
        escapeCSV(alt.alunoResp),
        escapeCSV(alt.diaSemana),
        escapeCSV(alt.horario),
        escapeCSV(alt.descricao)
      ].join(';')
    );

    const csvContent = '\uFEFF' + [
      escapeCSV(`RESUMO DE ALTERAÇÕES PARA RECEPÇÃO - TURMA ${turmaNome.toUpperCase()} (${anoMes})`),
      headersRecepcao.join(';'),
      ...(rowsRecepcao.length > 0 ? rowsRecepcao : [escapeCSV('Nenhuma alteração registrada neste mês.')])
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agenda_mensal_alteracoes_${nomeLimpoTurma}_${anoMes}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Copiar resumo formatado para envio direto no WhatsApp
  const handleCopiarWhatsApp = () => {
    const anoMes = mesReferencia.substring(0, 7);
    const textoWhatsApp = [
      `📋 *RESUMO DE ALTERAÇÕES DA AGENDA - ${turmaNome.toUpperCase()} (${anoMes})*`,
      `Total de alterações: ${listaAlteracoesRecepcao.length}`,
      '',
      ...(listaAlteracoesRecepcao.length > 0
        ? listaAlteracoesRecepcao.map((alt) => {
            return `• *${alt.paciente}*\n  Aluno: ${alt.alunoResp} | ${alt.diaSemana} às ${alt.horario}\n  ↳ ${alt.descricao}\n`;
          })
        : ['Nenhuma alteração registrada neste mês. Todos os atendimentos conformes com a Agenda Fixa.']),
      '_Gerado pelo Painel de Gestão OrtoUnifase_'
    ].join('\n');

    navigator.clipboard.writeText(textoWhatsApp);
    setModalResumoRecepcao((prev) => ({ ...prev, copiado: true }));
    setTimeout(() => {
      setModalResumoRecepcao((prev) => ({ ...prev, copiado: false }));
    }, 2500);
  };

  return (
    <div className="space-y-5">
      {/* Barra Superior de Controles: Dias e Períodos */}
      <AgendaFiltrosHeader
        diaSelecionado={diaSelecionado as DiaSemana}
        onDiaChange={handleDiaChange}
        periodo={periodo}
        onPeriodoChange={handlePeriodoChange}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
          {/* Seletor de Mês e Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mês Ref:</span>
              <input
                type="month"
                value={mesReferencia.substring(0, 7)}
                onChange={(e) => onMesReferenciaChange(`${e.target.value}-01`)}
                className="text-xs font-bold text-slate-800 px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-slate-50"
              />
            </div>

            {isCoordenadorOrAdmin && (
              <button
                type="button"
                onClick={() =>
                  setModalNovoPaciente({
                    isOpen: true,
                    pacienteNome: '',
                    diaSemana: diaSelecionado,
                    horario: '08:00',
                    alunoId: alunosOrdenados[0]?.id || ''
                  })
                }
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 hover:shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Paciente
              </button>
            )}

            <button
              type="button"
              onClick={onAbrirImportModal}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 hover:shadow-md"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Importar e Comparar
            </button>

            <button
              type="button"
              onClick={handleExportarCSV}
              title="Exportar agenda mensal deste mês em formato CSV (com coluna e resumo de alterações)"
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Exportar
            </button>

            <button
              type="button"
              onClick={() => setModalResumoRecepcao({ isOpen: true, copiado: false })}
              title="Visualizar e exportar resumo de alterações formatado para a recepção (CSV e WhatsApp)"
              className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              Resumo Recepção
              {inconsistencias.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-bold">
                  {inconsistencias.length}
                </span>
              )}
            </button>
          </div>

          {/* Legenda de Cores de Inconsistência */}
          <div className="flex items-center gap-3 text-[11px] font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <span className="text-slate-500 font-bold">Legenda:</span>
            <div className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              Ausente
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Aluno Trocado
            </div>
            <div className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Horário Alterado
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Paciente Novo
            </div>
          </div>
        </div>
      </AgendaFiltrosHeader>

      {/* Painel de Ausentes identificados para o Dia Selecionado */}
      {ausentesDoDia.length > 0 && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-rose-800 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Pacientes Ausentes da Agenda Fixa neste dia ({ausentesDoDia.length}):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ausentesDoDia.map((ausente) => (
              <span
                key={ausente.id}
                className="text-xs px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-900 font-medium shadow-2xs flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <strong>{ausente.paciente}</strong> (Horário: {ausente.horario} | Aluno Habitual: {ausente.aluno_fixa || 'N/A'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid / Tabela Kanban da Agenda Mensal */}
      {alunosOrdenados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Nenhum dado importado para {turmaNome}</h4>
          <p className="text-xs text-slate-500 mt-1">Clique no botão "Importar e Comparar" para colar o JSON da agenda mensal.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[750px] relative">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="p-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-24 bg-slate-50 border-r border-slate-200 sticky left-0 z-20">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Horário
                    </div>
                  </th>
                  {alunosOrdenados.map((aluno) => {
                    const isExtra = isAtendimentoExtra(aluno.nome) || aluno.id === 'EXTRA_VIRTUAL';
                    return (
                      <th
                        key={aluno.id}
                        className={`p-3 text-xs font-bold border-r min-w-[210px] transition-colors ${
                          isExtra
                            ? 'bg-amber-50/80 border-amber-300 border-dashed border-r-2 text-amber-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            {isExtra ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            )}
                            <span
                              className={`truncate ${isExtra ? 'font-extrabold text-amber-900' : ''}`}
                              title={aluno.nome}
                            >
                              {aluno.nome}
                            </span>
                          </div>
                          {isExtra && (
                            <span
                              title="Coluna de atendimento extra / aguardando revisão de aluno"
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-semibold shrink-0"
                            >
                              Revisão
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {horarios.map((h) => {
                  const isTurnoDivisor = h === HORARIO_DIVISOR_TURNO && periodo === 'TODOS';
                  return (
                    <React.Fragment key={h}>
                      {isTurnoDivisor && (
                        <tr className="bg-slate-100/80 font-bold text-slate-500 text-[11px]">
                          <td colSpan={alunosOrdenados.length + 1} className="py-1 px-3 border-y border-slate-200">
                            --- Turno da Tarde (Intervalos de 15 min) ---
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 text-center font-mono">
                          {h}
                        </td>
                        {alunosOrdenados.map((aluno) => {
                          const isExtra = isAtendimentoExtra(aluno.nome) || aluno.id === 'EXTRA_VIRTUAL';
                          const hNorm = normalizarHorario(h);
                          const items = mensalMap.get(`${aluno.id}_${hNorm}`) || [];

                          return (
                            <td
                              key={aluno.id}
                              className={`p-2 border-r align-top relative transition-colors ${
                                isExtra
                                  ? 'bg-amber-50/15 border-dashed border-amber-200/80 border-r-2'
                                  : 'border-slate-100'
                              }`}
                            >
                              {items.length > 0 ? (
                                <div className="space-y-1.5">
                                  {items.map((item) => {
                                    const itemBloqueio = isItemBloqueio(item);
                                    const incInfo = itemBloqueio ? null : getInconsistenciaInfo(item.paciente, h, aluno.nome);
                                    const tipoBloq = itemBloqueio ? (item.tipo_bloqueio || getTipoBloqueio(item)) : undefined;

                                    return (
                                      <AgendaCardAtendimento
                                        key={item.id}
                                        item={{
                                          id: item.id,
                                          paciente: item.paciente,
                                          aluno_id: item.aluno_id,
                                          aluno: item.aluno || aluno.nome,
                                          horario: item.horario,
                                          dia_semana: item.dia_semana,
                                          tipo_registro: itemBloqueio ? 'bloqueio' : 'paciente',
                                          tipo_bloqueio: tipoBloq,
                                          is_extra: isExtra
                                        }}
                                        badge={
                                          itemBloqueio ? undefined : incInfo ? (
                                            <span
                                              className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${incInfo.badge}`}
                                            >
                                              {incInfo.label}
                                            </span>
                                          ) : undefined
                                        }
                                        detalhe={
                                          itemBloqueio ? undefined : incInfo ? (
                                            <div className="text-[10px] opacity-85 leading-tight">
                                              {incInfo.detalhe}
                                            </div>
                                          ) : isExtra ? (
                                            <span className="text-[10px] font-medium text-amber-700/80">
                                              Revisar alocação
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-medium text-slate-400">
                                              Conforme agenda fixa
                                            </span>
                                          )
                                        }
                                        corCard={
                                          itemBloqueio
                                            ? undefined
                                            : incInfo
                                            ? incInfo.corBorder
                                            : isExtra
                                            ? 'bg-amber-50/80 border-amber-300 text-slate-900'
                                            : 'bg-white border-slate-200 text-slate-800'
                                        }
                                        podeEditar={isCoordenadorOrAdmin}
                                        onEditar={abrirEditar}
                                        onReagendar={abrirReagendar}
                                        onTrocarAluno={abrirTrocarAluno}
                                        onExcluir={(cardItem) =>
                                          onRemoverItem && onRemoverItem(cardItem.id, cardItem.paciente)
                                        }
                                      />
                                    );
                                  })}
                                </div>
                              ) : (
                                <div
                                  className={`w-full h-11 border border-dashed rounded-xl flex items-center justify-center gap-1 p-0.5 group/empty transition-all ${
                                    isExtra
                                      ? 'border-amber-200/60 hover:border-amber-300'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {isCoordenadorOrAdmin ? (
                                    <>
                                      <button
                                        type="button"
                                        title="Adicionar Paciente neste horário"
                                        onClick={() =>
                                          setModalNovoPaciente({
                                            isOpen: true,
                                            pacienteNome: '',
                                            diaSemana: diaSelecionado,
                                            horario: h,
                                            alunoId: isExtra ? 'EXTRA_VIRTUAL' : aluno.id
                                          })
                                        }
                                        className="flex-1 h-full rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50/50 transition-all cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5 opacity-60 group-hover/empty:opacity-100 transition-opacity" />
                                      </button>
                                      <button
                                        type="button"
                                        title="Fechar Horário (Bloqueio)"
                                        onClick={() => {
                                          const alunoIdReal = isExtra ? '' : aluno.id;
                                          const sugestao = sugerirSequenciaFecharHorario(
                                            agendaMensal,
                                            alunoIdReal,
                                            diaSelecionado,
                                            h
                                          );
                                          const hasSequencia = sugestao.toLowerCase().startsWith('continuação');
                                          const tipoInicial: TipoBloqueio = hasSequencia ? 'SEQUENCIA' : 'LIVRE';

                                          setModalFecharHorario({
                                            isOpen: true,
                                            alunoId: aluno.id,
                                            horario: h,
                                            diaSemana: diaSelecionado,
                                            tipoBloqueio: tipoInicial,
                                            descricao: tipoInicial === 'SEQUENCIA' ? sugestao : (tipoInicial === 'LIVRE' ? 'Horário Livre' : ''),
                                            sugestaoSequencia: sugestao
                                          });
                                        }}
                                        className="h-full px-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50/80 transition-all cursor-pointer"
                                      >
                                        <Lock className="w-3 h-3 opacity-60 group-hover/empty:opacity-100 transition-opacity" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-slate-300">-</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modais de Edição, Reagendamento e Troca de Aluno */}
      <AgendaModaisAtendimento
        turmaNome={turmaNome}
        alunos={alunosOrdenados.filter((a) => a.id !== 'EXTRA_VIRTUAL')}
        permitirSemAluno={true}
        modalEditar={modalEditar}
        onFecharEditar={fecharEditar}
        onSalvarEditar={handleSalvarEditar}
        onUpdateModalEditar={(p) => setModalEditar((prev) => ({ ...prev, ...p }))}
        modalReagendar={modalReagendar}
        onFecharReagendar={fecharReagendar}
        onSalvarReagendar={handleSalvarReagendar}
        onUpdateModalReagendar={(p) => setModalReagendar((prev) => ({ ...prev, ...p }))}
        modalTrocarAluno={modalTrocarAluno}
        onFecharTrocarAluno={fecharTrocarAluno}
        onSalvarTrocarAluno={handleSalvarTrocaAluno}
        onUpdateModalTrocarAluno={(p) => setModalTrocarAluno((prev) => ({ ...prev, ...p }))}
      />

      {/* Modal Adicionar Novo Paciente na Agenda Mensal */}
      {modalNovoPaciente.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-adicionar-paciente-mensal" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Adicionar Paciente na Agenda Mensal</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Mês de Referência: <strong>{mesReferencia.substring(0, 7)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoPaciente({ ...modalNovoPaciente, isOpen: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Paciente <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-novo-paciente-mensal-nome"
                  type="text"
                  autoFocus
                  value={modalNovoPaciente.pacienteNome}
                  onChange={(e) => setModalNovoPaciente({ ...modalNovoPaciente, pacienteNome: e.target.value })}
                  placeholder="Nome completo do paciente..."
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSalvarNovoPaciente()}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Dia da Semana</label>
                  <select
                    value={modalNovoPaciente.diaSemana}
                    onChange={(e) => setModalNovoPaciente({ ...modalNovoPaciente, diaSemana: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {DIAS_SEMANA.map((dia) => (
                      <option key={dia} value={dia}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Horário</label>
                  <select
                    value={modalNovoPaciente.horario}
                    onChange={(e) => setModalNovoPaciente({ ...modalNovoPaciente, horario: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white font-mono"
                  >
                    {getHorariosTurma(turmaNome).map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Aluno Responsável</label>
                <select
                  value={modalNovoPaciente.alunoId}
                  onChange={(e) => setModalNovoPaciente({ ...modalNovoPaciente, alunoId: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">Selecione o aluno...</option>
                  {alunosOrdenados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalNovoPaciente({ ...modalNovoPaciente, isOpen: false })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarNovoPaciente}
                disabled={!modalNovoPaciente.pacienteNome.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Adicionar Paciente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Horário (Bloqueio de Slot na Agenda Mensal) */}
      {modalFecharHorario.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-fechar-horario" className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Lock className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Fechar Horário (Bloqueio)</h4>
              </div>
              <button
                type="button"
                onClick={() =>
                  setModalFecharHorario({
                    ...modalFecharHorario,
                    isOpen: false,
                    descricao: '',
                    sugestaoSequencia: ''
                  })
                }
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Dia</span>
                  <strong>{modalFecharHorario.diaSemana}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Horário</span>
                  <strong>{formatarHorarioExibicao(modalFecharHorario.horario)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Aluno</span>
                  <strong className="truncate block" title={alunos.find((a) => a.id === modalFecharHorario.alunoId)?.nome}>
                    {alunos.find((a) => a.id === modalFecharHorario.alunoId)?.nome || (modalFecharHorario.alunoId === 'EXTRA_VIRTUAL' ? NOME_ATENDIMENTO_EXTRA : 'Aluno')}
                  </strong>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Selecione o Tipo de Bloqueio <span className="text-rose-500">*</span>
              </label>

              {/* 3 Opções de Tipo de Bloqueio */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* 1. SEQUÊNCIA DE ATENDIMENTO */}
                <button
                  type="button"
                  onClick={() =>
                    setModalFecharHorario((prev) => ({
                      ...prev,
                      tipoBloqueio: 'SEQUENCIA',
                      descricao: prev.sugestaoSequencia || 'Continuação'
                    }))
                  }
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    modalFecharHorario.tipoBloqueio === 'SEQUENCIA'
                      ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                      modalFecharHorario.tipoBloqueio === 'SEQUENCIA'
                        ? 'bg-brand-600 text-white'
                        : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        1. Sequência de Atendimento
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-200">
                        Azul (Padrão Paciente)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Continuação do atendimento do horário anterior deste aluno.
                    </p>
                    <div className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-brand-50/50 border-brand-200 text-brand-900 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-brand-600 shrink-0" />
                      <span className="truncate">
                        {(modalFecharHorario.tipoBloqueio === 'SEQUENCIA' && modalFecharHorario.descricao) || modalFecharHorario.sugestaoSequencia || 'Continuação do Atendimento'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 2. HORÁRIO LIVRE */}
                <button
                  type="button"
                  onClick={() =>
                    setModalFecharHorario((prev) => ({
                      ...prev,
                      tipoBloqueio: 'LIVRE',
                      descricao: 'Horário Livre'
                    }))
                  }
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    modalFecharHorario.tipoBloqueio === 'LIVRE'
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-amber-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                      modalFecharHorario.tipoBloqueio === 'LIVRE'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        2. Horário Livre
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Amarelo (Slot Vago)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Marca que o slot está deliberadamente livre / sem atendimento confirmado.
                    </p>
                    <div className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-amber-50/70 border-amber-300 text-amber-900 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Horário Livre</span>
                    </div>
                  </div>
                </button>

                {/* 3. OUTRO (OBSERVAÇÃO PERSONALIZADA) */}
                <button
                  type="button"
                  onClick={() =>
                    setModalFecharHorario((prev) => ({
                      ...prev,
                      tipoBloqueio: 'OUTRO',
                      descricao: prev.tipoBloqueio === 'OUTRO' ? prev.descricao : ''
                    }))
                  }
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                    modalFecharHorario.tipoBloqueio === 'OUTRO'
                      ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-400/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                      modalFecharHorario.tipoBloqueio === 'OUTRO'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        3. Outro (Observação Livre)
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300">
                        Cinza (Personalizado)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Observação personalizada (ex: feriado, manutenção, reunião clínica, etc.).
                    </p>
                  </div>
                </button>
              </div>

              {/* Se o tipo for OUTRO, exibe campo de texto livre */}
              {modalFecharHorario.tipoBloqueio === 'OUTRO' && (
                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Descrição da Observação <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-fechar-horario-descricao"
                    type="text"
                    autoFocus
                    value={modalFecharHorario.descricao}
                    onChange={(e) => setModalFecharHorario({ ...modalFecharHorario, descricao: e.target.value })}
                    placeholder="Ex: Feriado municipal, Manutenção de cadeira, Reunião clínica..."
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-400 bg-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleSalvarFecharHorario()}
                  />
                </div>
              )}

              {/* Se o tipo for SEQUENCIA, permite personalizar o texto da sequência se desejar */}
              {modalFecharHorario.tipoBloqueio === 'SEQUENCIA' && (
                <div className="pt-1">
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    Texto da Sequência (editável se necessário):
                  </label>
                  <input
                    type="text"
                    value={modalFecharHorario.descricao}
                    onChange={(e) => setModalFecharHorario({ ...modalFecharHorario, descricao: e.target.value })}
                    placeholder="Ex: Continuação - Nome do Paciente"
                    className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-400 bg-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleSalvarFecharHorario()}
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Horários fechados/bloqueados são identificados visualmente com cadeado e não geram inconsistências nos relatórios mensais.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setModalFecharHorario({
                    ...modalFecharHorario,
                    isOpen: false,
                    descricao: '',
                    sugestaoSequencia: ''
                  })
                }
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarFecharHorario}
                disabled={
                  modalFecharHorario.tipoBloqueio === 'OUTRO' && !modalFecharHorario.descricao.trim()
                }
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs disabled:opacity-50 transition-colors cursor-pointer ${
                  modalFecharHorario.tipoBloqueio === 'SEQUENCIA'
                    ? 'bg-brand-600 hover:bg-brand-700'
                    : modalFecharHorario.tipoBloqueio === 'LIVRE'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                Bloquear Horário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumo de Alterações para Recepção */}
      {modalResumoRecepcao.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-resumo-recepcao" className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Resumo de Alterações para a Recepção
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Turma {turmaNome} — Mês de Referência: {mesReferencia.substring(0, 7)} ({listaAlteracoesRecepcao.length} {listaAlteracoesRecepcao.length === 1 ? 'alteração' : 'alterações'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalResumoRecepcao({ ...modalResumoRecepcao, isOpen: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {listaAlteracoesRecepcao.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100 p-6">
                  Nenhuma alteração registrada neste mês. Todos os atendimentos estão conformes com a Agenda Fixa.
                </div>
              ) : (
                listaAlteracoesRecepcao.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 mb-0.5 flex items-center gap-2">
                        <span>{alt.paciente}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
                          {alt.diaSemana} às {alt.horario}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mb-1">
                        Aluno Responsável: <strong className="text-slate-700">{alt.alunoResp}</strong>
                      </div>
                      <div className="text-emerald-800 font-semibold bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-[11px]">
                        <span>↳</span>
                        <span>{alt.descricao}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Ações inferiores: Copiar para WhatsApp e Baixar CSV */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-400">
                Copie o texto para repassar por WhatsApp ou baixe o arquivo CSV exclusivo.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopiarWhatsApp}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {modalResumoRecepcao.copiado ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado para WhatsApp!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar p/ WhatsApp
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleBaixarCSVResumoRecepcao}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  Baixar CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
