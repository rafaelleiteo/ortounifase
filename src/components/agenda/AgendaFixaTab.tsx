import React, { useState, useMemo } from 'react';
import {
  AgendaAluno,
  AgendaFixaItem,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  DIAS_SEMANA,
  TurnoAgenda,
  OPCOES_TURNO,
  HORARIO_DIVISOR_TURNO,
  getHorariosPorTurno,
  getHorariosTurma,
  obterHorariosCompletos,
  normalizarHorario,
  formatarHorarioExibicao,
  isAtendimentoExtra,
  NOME_ATENDIMENTO_EXTRA,
  obterColunasTurma,
  DiaSemana,
  TipoBloqueio,
  getTipoBloqueio,
  getDescricaoBloqueio,
  isItemBloqueio,
  sugerirSequenciaFecharHorario
} from '@/lib/agendaTypes';
import { AgendaFiltrosHeader } from './AgendaFiltrosHeader';
import {
  Calendar,
  User,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CalendarClock,
  ArrowRightLeft,
  X,
  Check,
  ChevronDown,
  Download,
  AlertTriangle,
  Lock,
  Link2,
  FileText,
  Printer
} from 'lucide-react';
import { AgendaCardAtendimento } from './AgendaCardAtendimento';
import { AgendaPrintHeader } from './AgendaPrintHeader';

interface AgendaFixaTabProps {
  turmaId: string;
  turmaNome: string;
  alunos: AgendaAluno[];
  agendaFixa: AgendaFixaItem[];
  diaSelecionado?: string;
  onDiaSelecionadoChange?: (dia: string) => void;
  periodo?: TurnoAgenda;
  onPeriodoChange?: (periodo: TurnoAgenda) => void;
  onSalvarItem: (item: Partial<AgendaFixaItem>) => Promise<void>;
  onRemoverItem: (id: string) => Promise<void>;
  onCriarAluno: (nome: string) => Promise<void>;
  isCoordenadorOrAdmin?: boolean;
}

// Re-exporta sugerirSequenciaFecharHorario para compatibilidade
export { sugerirSequenciaFecharHorario };

export const AgendaFixaTab: React.FC<AgendaFixaTabProps> = ({
  turmaId,
  turmaNome,
  alunos,
  agendaFixa,
  diaSelecionado: diaProp,
  onDiaSelecionadoChange,
  periodo: periodoProp,
  onPeriodoChange,
  onSalvarItem,
  onRemoverItem,
  onCriarAluno,
  isCoordenadorOrAdmin = true
}) => {
  const [diaLocal, setDiaLocal] = useState<string>('QUINTA');
  const diaSelecionadoRaw = diaProp !== undefined ? diaProp : diaLocal;
  const diaSelecionado = (diaSelecionadoRaw && diaSelecionadoRaw !== 'TODOS') ? diaSelecionadoRaw : 'QUINTA';
  const handleDiaChange = onDiaSelecionadoChange || setDiaLocal;

  // Turno ativo local para atalho de rolagem na Agenda Fixa (sem filtrar linhas)
  const [turnoAtivo, setTurnoAtivo] = useState<TurnoAgenda>('TODOS');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const tardeDivisorRef = React.useRef<HTMLTableRowElement>(null);

  const handleTurnoClick = (turno: TurnoAgenda) => {
    setTurnoAtivo(turno);
    if (turno === 'TARDE') {
      if (scrollContainerRef.current) {
        const el = tardeDivisorRef.current || document.getElementById('turno-tarde-fixa');
        if (el) {
          const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
          const elTop = el.getBoundingClientRect().top;
          const currentScroll = scrollContainerRef.current.scrollTop;
          // Compensação de 45px para a thead sticky não sobrepor o divisor
          const targetScroll = currentScroll + (elTop - containerTop) - 45;
          scrollContainerRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }
      }
    } else {
      // MANHA ou TODOS: rola suavemente para o início do dia
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const el = tardeDivisorRef.current || document.getElementById('turno-tarde-fixa');
    if (el) {
      const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      if (elTop <= containerTop + 55) {
        setTurnoAtivo('TARDE');
      } else {
        setTurnoAtivo('MANHA');
      }
    }
  };

  const [novoAlunoNome, setNovoAlunoNome] = useState<string>('');
  const [criandoAluno, setCriandoAluno] = useState<boolean>(false);

  // Colunas da Agenda Fixa com single source of truth:
  // - ESP2: As 4 duplas na ordem estrita + Atendimento Extra por último (sempre visível, mesmo vazia)
  // - ESP1 e Serviço: Alunos ativos + Atendimento Extra por último (sempre visível, mesmo vazia)
  const colunasFixa = useMemo(() => {
    return obterColunasTurma(turmaNome, alunos, agendaFixa);
  }, [turmaNome, alunos, agendaFixa]);

  // Modal para adicionar / editar paciente em célula
  const [modalCell, setModalCell] = useState<{
    isOpen: boolean;
    itemExistente?: AgendaFixaItem;
    alunoId: string;
    horario: string;
    diaSemana: string;
    pacienteNome: string;
  }>({
    isOpen: false,
    alunoId: '',
    horario: '',
    diaSemana: 'QUINTA',
    pacienteNome: ''
  });

  // Modal para mover paciente de aluno
  const [moverModal, setMoverModal] = useState<{
    isOpen: boolean;
    item?: AgendaFixaItem;
    novoAlunoId: string;
  }>({
    isOpen: false,
    novoAlunoId: ''
  });

  // Modal para "+ Adicionar Paciente"
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

  // Modal para "Editar Nome do Paciente"
  const [modalEditarNome, setModalEditarNome] = useState<{
    isOpen: boolean;
    item?: AgendaFixaItem;
    pacienteNome: string;
  }>({
    isOpen: false,
    pacienteNome: ''
  });

  // Modal para "Mover Paciente de Horário / Dia / Aluno"
  const [modalMoverHorario, setModalMoverHorario] = useState<{
    isOpen: boolean;
    item?: AgendaFixaItem;
    diaSemana: string;
    horario: string;
    alunoId: string;
    erro?: string;
  }>({
    isOpen: false,
    diaSemana: 'QUINTA',
    horario: '08:00',
    alunoId: ''
  });

  // Modal para "Fechar Horário (Bloqueio)"
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

  // Exibe sempre todos os horários da turma em rolagem contínua na Agenda Fixa,
  // com proteção contra sumiço para qualquer horário fora da grade padrão.
  const horarios = useMemo(() => {
    return obterHorariosCompletos({
      turmaNome,
      periodo: 'TODOS',
      itens: agendaFixa,
      diaSelecionado
    });
  }, [turmaNome, agendaFixa, diaSelecionado]);

  const divisorTarde = useMemo(() => {
    return horarios.find((h) => h >= '12:00') || HORARIO_DIVISOR_TURNO;
  }, [horarios]);

  // Indexa itens por chave: colId_horarioNormalizado (suporta múltiplos atendimentos na coluna extra)
  const itemMap = new Map<string, AgendaFixaItem[]>();
  agendaFixa
    .filter((item) => (item.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase())
    .forEach((item) => {
      const hNorm = normalizarHorario(item.horario);
      const isExtra = !item.aluno_id || isAtendimentoExtra(item.agenda_alunos?.nome || item.aluno);
      const colId = isExtra ? 'EXTRA_VIRTUAL' : (item.aluno_id || 'EXTRA_VIRTUAL');
      const key = `${colId}_${hNorm}`;
      const list = itemMap.get(key) || [];
      list.push(item);
      itemMap.set(key, list);
    });

  const handleAbrirCelular = (alunoId: string, horario: string) => {
    const hNorm = normalizarHorario(horario);
    const key = `${alunoId}_${hNorm}`;
    const itens = itemMap.get(key) || [];
    const existente = itens[0];

    setModalCell({
      isOpen: true,
      itemExistente: existente,
      alunoId,
      horario,
      diaSemana: diaSelecionado,
      pacienteNome: existente ? existente.paciente : ''
    });
  };

  const handleSalvarCelula = async () => {
    if (!modalCell.pacienteNome.trim()) return;
    const isExtra = modalCell.alunoId === 'EXTRA_VIRTUAL';
    await onSalvarItem({
      id: modalCell.itemExistente?.id,
      aluno_id: isExtra ? null : modalCell.alunoId,
      aluno: isExtra ? NOME_ATENDIMENTO_EXTRA : undefined,
      horario: normalizarHorario(modalCell.horario),
      dia_semana: modalCell.diaSemana,
      turma_id: turmaId,
      paciente: modalCell.pacienteNome.trim()
    });
    setModalCell({ ...modalCell, isOpen: false, pacienteNome: '' });
  };

  const handleSalvarNovoPaciente = async () => {
    if (!modalNovoPaciente.pacienteNome.trim() || !modalNovoPaciente.alunoId) return;
    const isExtra = modalNovoPaciente.alunoId === 'EXTRA_VIRTUAL';
    await onSalvarItem({
      aluno_id: isExtra ? null : modalNovoPaciente.alunoId,
      aluno: isExtra ? NOME_ATENDIMENTO_EXTRA : undefined,
      horario: normalizarHorario(modalNovoPaciente.horario),
      dia_semana: modalNovoPaciente.diaSemana,
      turma_id: turmaId,
      paciente: modalNovoPaciente.pacienteNome.trim()
    });
    setModalNovoPaciente({
      isOpen: false,
      pacienteNome: '',
      diaSemana: diaSelecionado,
      horario: '08:00',
      alunoId: colunasFixa[0]?.id || ''
    });
  };

  const handleSalvarEdicaoNome = async () => {
    if (!modalEditarNome.item || !modalEditarNome.pacienteNome.trim()) return;
    const isBloqueio = modalEditarNome.item.tipo_registro === 'bloqueio';
    const tipo = modalEditarNome.item.tipo_bloqueio || getTipoBloqueio(modalEditarNome.item);
    const pacienteSalvar = isBloqueio
      ? `[${tipo}] ${modalEditarNome.pacienteNome.trim().replace(/^\[(SEQUENCIA|LIVRE|OUTRO)\]\s*/i, '')}`
      : modalEditarNome.pacienteNome.trim();

    await onSalvarItem({
      id: modalEditarNome.item.id,
      aluno_id: modalEditarNome.item.aluno_id,
      aluno: modalEditarNome.item.aluno,
      horario: modalEditarNome.item.horario,
      dia_semana: modalEditarNome.item.dia_semana,
      turma_id: turmaId,
      paciente: pacienteSalvar,
      tipo_registro: modalEditarNome.item.tipo_registro,
      tipo_bloqueio: isBloqueio ? tipo : undefined
    });
    setModalEditarNome({ isOpen: false, pacienteNome: '' });
  };

  const handleSalvarFecharHorario = async () => {
    if (!modalFecharHorario.alunoId) return;
    const isExtra = modalFecharHorario.alunoId === 'EXTRA_VIRTUAL';
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

    await onSalvarItem({
      aluno_id: isExtra ? null : modalFecharHorario.alunoId,
      aluno: isExtra ? NOME_ATENDIMENTO_EXTRA : undefined,
      horario: normalizarHorario(modalFecharHorario.horario),
      dia_semana: modalFecharHorario.diaSemana,
      turma_id: turmaId,
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

  // Auto-escala com MEDIÇÃO REAL do DOM no modo de impressão
  const ajustarEscalaImpressao = React.useCallback(() => {
    // 1. Aplica estilos de impressão temporariamente no DOM para medição real
    document.documentElement.classList.add('agenda-modo-impressao');
    document.documentElement.style.removeProperty('--agenda-print-scale');

    const wrapper = document.querySelector('.agenda-print-wrapper') as HTMLElement | null;
    if (!wrapper) {
      document.documentElement.classList.remove('agenda-modo-impressao');
      return;
    }

    // 2. Mede a altura real da tabela impressa com o cabeçalho de impressão
    const rect = wrapper.getBoundingClientRect();
    const alturaReal = Math.max(wrapper.scrollHeight, rect.height, wrapper.offsetHeight);

    // 3. Altura útil da página A4 paisagem com margens de 5mm (210mm - 10mm = 200mm = ~756px; área útil segura: 680px)
    const alturaUtilPagina = 680;
    let scale = 1.0;
    if (alturaReal > alturaUtilPagina) {
      scale = alturaUtilPagina / alturaReal;
    }

    // 4. Piso estrito de 0.75 para manter legibilidade das fontes (>= 6pt no pior caso)
    scale = Math.max(0.75, Math.min(1.0, Math.round(scale * 100) / 100));
    document.documentElement.style.setProperty('--agenda-print-scale', String(scale));
  }, []);

  React.useEffect(() => {
    const handleBeforePrint = () => {
      ajustarEscalaImpressao();
    };
    const handleAfterPrint = () => {
      document.documentElement.classList.remove('agenda-modo-impressao');
      document.documentElement.style.removeProperty('--agenda-print-scale');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.documentElement.classList.remove('agenda-modo-impressao');
      document.documentElement.style.removeProperty('--agenda-print-scale');
    };
  }, [ajustarEscalaImpressao]);

  const handleImprimir = () => {
    ajustarEscalaImpressao();
    window.print();
  };

  const handleExportarCSV = () => {
    if (agendaFixa.length === 0) {
      alert('Não há registros na Agenda Fixa para exportar.');
      return;
    }

    const alunoNomeMap = new Map<string, string>();
    alunos.forEach((a) => alunoNomeMap.set(a.id, a.nome));

    // Cabeçalho CSV
    const headers = ['dia_semana', 'horario', 'paciente', 'aluno', 'tipo_registro'];
    const rows = agendaFixa.map((item) => {
      const isExtra = !item.aluno_id || isAtendimentoExtra(item.aluno) || isAtendimentoExtra(item.agenda_alunos?.nome);
      const alunoNome = isExtra
        ? 'ATENDIMENTO EXTRA'
        : (item.agenda_alunos?.nome || (item.aluno_id ? alunoNomeMap.get(item.aluno_id) : null) || 'ATENDIMENTO EXTRA');

      const escapeCSV = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

      return [
        escapeCSV(item.dia_semana),
        escapeCSV(formatarHorarioExibicao(item.horario)),
        escapeCSV(item.paciente),
        escapeCSV(alunoNome),
        escapeCSV(item.tipo_registro || 'paciente')
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const dataHoje = new Date().toISOString().split('T')[0];
    const nomeLimpoTurma = turmaNome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `agenda_fixa_${nomeLimpoTurma}_${dataHoje}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleMoverPaciente = async () => {
    if (!moverModal.item || !moverModal.novoAlunoId) return;
    const isDestinoExtra = moverModal.novoAlunoId === 'EXTRA_VIRTUAL';
    await onSalvarItem({
      id: moverModal.item.id,
      aluno_id: isDestinoExtra ? null : moverModal.novoAlunoId,
      aluno: isDestinoExtra ? NOME_ATENDIMENTO_EXTRA : undefined,
      horario: moverModal.item.horario,
      dia_semana: moverModal.item.dia_semana,
      turma_id: turmaId,
      paciente: moverModal.item.paciente,
      tipo_registro: moverModal.item.tipo_registro,
      tipo_bloqueio: moverModal.item.tipo_bloqueio
    });
    setMoverModal({ isOpen: false, novoAlunoId: '' });
  };

  const handleConfirmarMoverHorario = async () => {
    if (!modalMoverHorario.item || !modalMoverHorario.alunoId) return;

    const { item, diaSemana, horario, alunoId } = modalMoverHorario;
    const hNormDestino = normalizarHorario(horario);
    const isDestinoExtra = alunoId === 'EXTRA_VIRTUAL';

    // Validação: verificar conflito somente para alunos regulares (Atendimento Extra permite múltiplos)
    if (!isDestinoExtra) {
      const conflito = agendaFixa.find(
        (outro) =>
          outro.id !== item.id &&
          (outro.dia_semana || '').toUpperCase() === diaSemana.toUpperCase() &&
          normalizarHorario(outro.horario) === hNormDestino &&
          outro.aluno_id === alunoId
      );

      if (conflito) {
        const alunoNome = alunos.find((a) => a.id === alunoId)?.nome || 'o aluno selecionado';
        setModalMoverHorario((prev) => ({
          ...prev,
          erro: `Horário ocupado! Já existe o paciente "${conflito.paciente}" agendado para ${alunoNome} na ${diaSemana} às ${formatarHorarioExibicao(horario)}. Escolha outro slot ou aluno.`
        }));
        return;
      }
    }

    await onSalvarItem({
      id: item.id,
      paciente: item.paciente,
      dia_semana: diaSemana,
      horario: hNormDestino,
      aluno_id: isDestinoExtra ? null : alunoId,
      aluno: isDestinoExtra ? NOME_ATENDIMENTO_EXTRA : undefined,
      turma_id: turmaId,
      tipo_registro: item.tipo_registro,
      tipo_bloqueio: item.tipo_bloqueio
    });

    setModalMoverHorario({
      isOpen: false,
      diaSemana: 'QUINTA',
      horario: '08:00',
      alunoId: '',
      erro: undefined
    });
  };

  const handleAdicionarAluno = async () => {
    if (!novoAlunoNome.trim()) return;
    setCriandoAluno(true);
    try {
      await onCriarAluno(novoAlunoNome.trim());
      setNovoAlunoNome('');
    } finally {
      setCriandoAluno(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Barra Superior de Controles: Dias e Períodos (Oculta na impressão) */}
      <div className="print:hidden">
        <AgendaFiltrosHeader
          diaSelecionado={diaSelecionado as DiaSemana}
          onDiaChange={handleDiaChange}
          periodo={turnoAtivo}
          onPeriodoChange={handleTurnoClick}
        >
          {/* Ações da Turma: Adicionar Aluno, Adicionar Paciente, Exportar e Imprimir */}
          <div className="flex flex-wrap items-center gap-2 w-full">
            {isCoordenadorOrAdmin && (
              <button
                type="button"
                onClick={() =>
                  setModalNovoPaciente({
                    isOpen: true,
                    pacienteNome: '',
                    diaSemana: diaSelecionado,
                    horario: '08:00',
                    alunoId: colunasFixa[0]?.id || ''
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
              onClick={handleExportarCSV}
              title="Exportar agenda fixa desta turma em formato CSV"
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Exportar
            </button>

            <button
              type="button"
              onClick={handleImprimir}
              title="Imprimir agenda deste dia em A4 paisagem (página única)"
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Imprimir
            </button>

            {/* Adicionar Aluno Rápido */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <input
                type="text"
                value={novoAlunoNome}
                onChange={(e) => setNovoAlunoNome(e.target.value)}
                placeholder="Novo aluno..."
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 w-32"
                onKeyDown={(e) => e.key === 'Enter' && handleAdicionarAluno()}
              />
              <button
                type="button"
                onClick={handleAdicionarAluno}
                disabled={criandoAluno || !novoAlunoNome.trim()}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1 disabled:opacity-50"
                title="Cadastrar Aluno na Turma"
              >
                <Plus className="w-3.5 h-3.5" />
                Aluno
              </button>
            </div>
          </div>
        </AgendaFiltrosHeader>
      </div>

      {/* Grid / Tabela Kanban da Agenda Fixa com Suporte a Impressão em Página Única */}
      {colunasFixa.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Nenhum aluno cadastrado nesta turma</h4>
          <p className="text-xs text-slate-500 mt-1">Adicione alunos acima ou importe um JSON para criá-los automaticamente.</p>
        </div>
      ) : (
        <div className="agenda-print-wrapper">
          {/* Cabeçalho exclusivo para modo de impressão */}
          <AgendaPrintHeader turmaNome={turmaNome} diaSemana={diaSelecionado} tipo="fixa" />

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none">
            <div ref={scrollContainerRef} onScroll={handleScroll} className="agenda-table-scroll overflow-x-auto max-h-[750px] relative scroll-smooth print:max-h-none print:overflow-visible print:h-auto">
              <table className="agenda-print-table w-full text-left border-collapse min-w-[800px] print:min-w-0 print:w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 print:static">
                  <tr>
                    <th className="p-3 print:p-1 text-xs font-bold text-slate-600 uppercase tracking-wider w-24 bg-slate-50 border-r border-slate-200 sticky left-0 z-20 print:static">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                        Horário
                      </div>
                    </th>
                    {colunasFixa.map((col) => {
                      const isExtra = col.id === 'EXTRA_VIRTUAL' || isAtendimentoExtra(col.nome);
                      return (
                        <th
                          key={col.id}
                          className={`p-3 print:p-1 text-xs font-bold border-r border-slate-200 min-w-[200px] print:min-w-0 ${
                            isExtra ? 'bg-amber-50/50 text-amber-900' : 'text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <User className={`w-3.5 h-3.5 shrink-0 print:hidden ${isExtra ? 'text-amber-600' : 'text-brand-600'}`} />
                              <span className="truncate" title={col.nome}>{col.nome}</span>
                            </div>
                            {isExtra && (
                              <span className="text-[10px] print:text-[9.5px] agenda-print-badge px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-semibold shrink-0">
                                Extra
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
                    const isTurnoDivisor = h === divisorTarde;
                    const hNorm = normalizarHorario(h);
                    const isLinhaVazia = colunasFixa.every((col) => {
                      const isExtraCol = col.id === 'EXTRA_VIRTUAL' || isAtendimentoExtra(col.nome);
                      const colId = isExtraCol ? 'EXTRA_VIRTUAL' : col.id;
                      const itens = itemMap.get(`${colId}_${hNorm}`);
                      return !itens || itens.length === 0;
                    });

                    return (
                      <React.Fragment key={h}>
                        {isTurnoDivisor && (
                          <tr
                            ref={tardeDivisorRef}
                            id="turno-tarde-fixa"
                            className="agenda-print-divisor-tarde bg-slate-100/80 font-bold text-slate-500 text-[11px]"
                          >
                            <td colSpan={colunasFixa.length + 1} className="py-1 px-3 border-y border-slate-200">
                              --- Turno da Tarde ---
                            </td>
                          </tr>
                        )}
                        <tr className={`hover:bg-slate-50/50 transition-colors ${isLinhaVazia ? 'agenda-print-row-empty' : ''}`}>
                          <td className="p-2.5 print:p-1 font-bold text-slate-700 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 text-center font-mono print:static">
                            {h}
                          </td>
                          {colunasFixa.map((col) => {
                            const isExtraCol = col.id === 'EXTRA_VIRTUAL' || isAtendimentoExtra(col.nome);
                            const colId = isExtraCol ? 'EXTRA_VIRTUAL' : col.id;
                            const itens = itemMap.get(`${colId}_${hNorm}`) || [];

                            return (
                              <td
                                key={col.id}
                                className={`p-2 border-r border-slate-100 align-top relative group ${
                                  isExtraCol ? 'bg-amber-50/10' : ''
                                }`}
                              >
                                {itens.length > 0 ? (
                                  <div className="space-y-1">
                                    {itens.map((item) => (
                                      <AgendaCardAtendimento
                                        key={item.id}
                                        item={{
                                          id: item.id,
                                          paciente: item.paciente,
                                          aluno_id: item.aluno_id,
                                          aluno: isExtraCol
                                            ? NOME_ATENDIMENTO_EXTRA
                                            : (item.agenda_alunos?.nome || alunos.find((a) => a.id === item.aluno_id)?.nome || col.nome),
                                          horario: item.horario,
                                          dia_semana: item.dia_semana,
                                          tipo_registro: item.tipo_registro,
                                          tipo_bloqueio: item.tipo_bloqueio
                                        }}
                                        podeEditar={isCoordenadorOrAdmin}
                                        onEditar={() =>
                                          setModalEditarNome({
                                            isOpen: true,
                                            item,
                                            pacienteNome: item.tipo_registro === 'bloqueio' ? getDescricaoBloqueio(item.paciente) : item.paciente
                                          })
                                        }
                                        onReagendar={() =>
                                          setModalMoverHorario({
                                            isOpen: true,
                                            item,
                                            diaSemana: item.dia_semana || diaSelecionado,
                                            horario: formatarHorarioExibicao(item.horario),
                                            alunoId: item.aluno_id || 'EXTRA_VIRTUAL',
                                            erro: undefined
                                          })
                                        }
                                        onTrocarAluno={() => setMoverModal({ isOpen: true, item, novoAlunoId: '' })}
                                        onExcluir={() => onRemoverItem(item.id)}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className={`agenda-slot-vazio w-full h-11 print:hidden border border-dashed rounded-xl flex items-center justify-center gap-1 p-0.5 group/empty transition-all ${
                                    isExtraCol ? 'border-amber-200/60 hover:border-amber-300' : 'border-slate-200 hover:border-slate-300'
                                  }`}>
                                    <button
                                      type="button"
                                      title="Adicionar Paciente"
                                      onClick={() => handleAbrirCelular(col.id, h)}
                                      className="flex-1 h-full rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50/50 transition-all cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5 opacity-60 group-hover/empty:opacity-100 transition-opacity" />
                                    </button>
                                  {isCoordenadorOrAdmin && (
                                    <button
                                      type="button"
                                      title="Fechar Horário (Bloqueio)"
                                      onClick={() => {
                                        const alunoIdSugestao = isExtraCol ? '' : col.id;
                                        const sugestao = sugerirSequenciaFecharHorario(
                                          agendaFixa,
                                          alunoIdSugestao,
                                          diaSelecionado,
                                          h
                                        );
                                        const hasSequencia = sugestao.toLowerCase().startsWith('continuação');
                                        const tipoInicial: TipoBloqueio = hasSequencia ? 'SEQUENCIA' : 'LIVRE';

                                        setModalFecharHorario({
                                          isOpen: true,
                                          alunoId: col.id,
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
      </div>
    )}

      {/* Modal Editar / Inserir Célula */}
      {modalCell.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800">
                {modalCell.itemExistente ? 'Editar Paciente da Agenda Fixa' : 'Novo Paciente na Agenda Fixa'}
              </h4>
              <button
                onClick={() => setModalCell({ ...modalCell, isOpen: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <div><strong>Dia:</strong> {modalCell.diaSemana}</div>
              <div><strong>Horário:</strong> {modalCell.horario}</div>
              <div>
                <strong>Aluno / Coluna:</strong>{' '}
                {modalCell.alunoId === 'EXTRA_VIRTUAL'
                  ? NOME_ATENDIMENTO_EXTRA
                  : (alunos.find((a) => a.id === modalCell.alunoId)?.nome || modalCell.alunoId)}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Paciente</label>
              <input
                type="text"
                autoFocus
                value={modalCell.pacienteNome}
                onChange={(e) => setModalCell({ ...modalCell, pacienteNome: e.target.value })}
                placeholder="Digite o nome completo do paciente..."
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSalvarCelula()}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalCell({ ...modalCell, isOpen: false })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarCelula}
                disabled={!modalCell.pacienteNome.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mover Paciente para outro Aluno */}
      {moverModal.isOpen && moverModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800">Mover Paciente para outro Aluno</h4>
              <button
                onClick={() => setMoverModal({ isOpen: false, novoAlunoId: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
              <div><strong>Paciente:</strong> {moverModal.item.paciente}</div>
              <div><strong>Horário / Dia:</strong> {moverModal.item.horario} ({moverModal.item.dia_semana})</div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Selecione o Novo Aluno Responsável</label>
              <select
                value={moverModal.novoAlunoId}
                onChange={(e) => setMoverModal({ ...moverModal, novoAlunoId: e.target.value })}
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Selecione um aluno ou dupla...</option>
                {colunasFixa
                  .filter((a) => {
                    const currentId = moverModal.item?.aluno_id || 'EXTRA_VIRTUAL';
                    return a.id !== currentId;
                  })
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMoverModal({ isOpen: false, novoAlunoId: '' })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMoverPaciente}
                disabled={!moverModal.novoAlunoId}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Confirmar Mudança
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Novo Paciente */}
      {modalNovoPaciente.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-adicionar-paciente" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800">Adicionar Paciente na Agenda Fixa</h4>
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
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Paciente</label>
                <input
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
                    {horarios.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Aluno ou Dupla Responsável</label>
                <select
                  value={modalNovoPaciente.alunoId}
                  onChange={(e) => setModalNovoPaciente({ ...modalNovoPaciente, alunoId: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">Selecione o aluno ou dupla...</option>
                  {colunasFixa.map((a) => (
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
                disabled={!modalNovoPaciente.pacienteNome.trim() || !modalNovoPaciente.alunoId}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Nome do Paciente */}
      {modalEditarNome.isOpen && modalEditarNome.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-editar-nome" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-800">Editar Nome do Paciente</h4>
              <button
                type="button"
                onClick={() => setModalEditarNome({ isOpen: false, pacienteNome: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
              <div><strong>Dia:</strong> {modalEditarNome.item.dia_semana}</div>
              <div><strong>Horário:</strong> {formatarHorarioExibicao(modalEditarNome.item.horario)}</div>
              <div>
                <strong>Aluno:</strong>{' '}
                {modalEditarNome.item.agenda_alunos?.nome ||
                  alunos.find((a) => a.id === modalEditarNome.item?.aluno_id)?.nome ||
                  'Aluno da Turma'}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Paciente</label>
              <input
                type="text"
                autoFocus
                value={modalEditarNome.pacienteNome}
                onChange={(e) => setModalEditarNome({ ...modalEditarNome, pacienteNome: e.target.value })}
                placeholder="Nome do paciente..."
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSalvarEdicaoNome()}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalEditarNome({ isOpen: false, pacienteNome: '' })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicaoNome}
                disabled={!modalEditarNome.pacienteNome.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mover Paciente (Dia / Horário / Aluno) */}
      {modalMoverHorario.isOpen && modalMoverHorario.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div id="modal-mover-horario" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Mover Paciente</h4>
              </div>
              <button
                type="button"
                onClick={() => setModalMoverHorario({ ...modalMoverHorario, isOpen: false, erro: undefined })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1 border border-slate-100">
              <div><strong>Paciente:</strong> {modalMoverHorario.item.paciente}</div>
              <div className="text-slate-500 text-[11px]">
                <strong>Posição Atual:</strong> {modalMoverHorario.item.dia_semana} às {formatarHorarioExibicao(modalMoverHorario.item.horario)} — Aluno: {modalMoverHorario.item.agenda_alunos?.nome || alunos.find((a) => a.id === modalMoverHorario.item?.aluno_id)?.nome || 'Atual'}
              </div>
            </div>

            {modalMoverHorario.erro && (
              <div id="mover-horario-erro" className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{modalMoverHorario.erro}</div>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Novo Dia da Semana</label>
                  <select
                    value={modalMoverHorario.diaSemana}
                    onChange={(e) =>
                      setModalMoverHorario({
                        ...modalMoverHorario,
                        diaSemana: e.target.value,
                        erro: undefined
                      })
                    }
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">Novo Horário</label>
                  <select
                    value={modalMoverHorario.horario}
                    onChange={(e) =>
                      setModalMoverHorario({
                        ...modalMoverHorario,
                        horario: e.target.value,
                        erro: undefined
                      })
                    }
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white font-mono"
                  >
                    {horarios.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Aluno ou Dupla Responsável</label>
                <select
                  value={modalMoverHorario.alunoId}
                  onChange={(e) =>
                    setModalMoverHorario({
                      ...modalMoverHorario,
                      alunoId: e.target.value,
                      erro: undefined
                    })
                  }
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {colunasFixa.map((a) => (
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
                onClick={() => setModalMoverHorario({ ...modalMoverHorario, isOpen: false, erro: undefined })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarMoverHorario}
                disabled={!modalMoverHorario.alunoId}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                Confirmar Mudança
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Horário (Bloqueio de Slot) */}
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
                className="text-slate-400 hover:text-slate-600"
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
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Aluno / Coluna</span>
                  <strong className="truncate block" title={modalFecharHorario.alunoId === 'EXTRA_VIRTUAL' ? NOME_ATENDIMENTO_EXTRA : (alunos.find((a) => a.id === modalFecharHorario.alunoId)?.nome || 'Aluno')}>
                    {modalFecharHorario.alunoId === 'EXTRA_VIRTUAL' ? NOME_ATENDIMENTO_EXTRA : (alunos.find((a) => a.id === modalFecharHorario.alunoId)?.nome || 'Aluno')}
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
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarFecharHorario}
                disabled={
                  modalFecharHorario.tipoBloqueio === 'OUTRO' && !modalFecharHorario.descricao.trim()
                }
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs disabled:opacity-50 transition-colors ${
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
    </div>
  );
};
