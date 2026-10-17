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
  normalizarHorario,
  formatarHorarioExibicao,
  isAtendimentoExtra,
  DiaSemana
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
  Lock
} from 'lucide-react';
import { AgendaCardAtendimento } from './AgendaCardAtendimento';

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

/**
 * Sugere automaticamente a próxima sequência lógica de atendimento ao fechar/bloquear um horário.
 * Baseia-se nos atendimentos já cadastrados para aquele aluno naquele dia.
 */
export function sugerirSequenciaFecharHorario(
  agenda: AgendaFixaItem[],
  alunoId: string,
  diaSemana: string,
  horario: string
): string {
  const hNorm = normalizarHorario(horario);

  const atendimentosDoAluno = agenda
    .filter(
      (item) =>
        item.aluno_id === alunoId &&
        (item.dia_semana || '').toUpperCase().trim() === diaSemana.toUpperCase().trim() &&
        item.paciente &&
        item.paciente.trim().length > 0
    )
    .sort((a, b) => normalizarHorario(a.horario).localeCompare(normalizarHorario(b.horario)));

  // 1. Procura o atendimento imediatamente anterior
  const anteriores = atendimentosDoAluno.filter(
    (item) => normalizarHorario(item.horario) < hNorm
  );

  if (anteriores.length > 0) {
    const ultimo = anteriores[anteriores.length - 1];
    const pacienteNome = ultimo.paciente.trim();

    // Se o anterior for continuação numerada: "Continuação 2 - Nome" -> "Continuação 3 - Nome"
    const matchNum = pacienteNome.match(/^continuação\s+(\d+)\s*[-:]?\s*(.*)$/i);
    if (matchNum) {
      const proximoNum = parseInt(matchNum[1], 10) + 1;
      const nomeBase = matchNum[2].trim() || 'Atendimento';
      return `Continuação ${proximoNum} - ${nomeBase}`;
    }

    // Se o anterior for continuação simples: "Continuação - Nome" -> "Continuação 2 - Nome"
    const matchSimples = pacienteNome.match(/^continuação\s*[-:]?\s*(.*)$/i);
    if (matchSimples) {
      const nomeBase = matchSimples[1].trim() || 'Atendimento';
      return `Continuação 2 - ${nomeBase}`;
    }

    // Atendimento inicial do paciente -> primeira continuação
    return `Continuação - ${pacienteNome}`;
  }

  // 2. Se não houver atendimento anterior, mas houver atendimento posterior naquele dia
  const posteriores = atendimentosDoAluno.filter(
    (item) => normalizarHorario(item.horario) > hNorm
  );
  if (posteriores.length > 0) {
    const proximo = posteriores[0];
    const pacienteNome = proximo.paciente.replace(/^continuação(\s+\d+)?\s*[-:]?\s*/i, '').trim();
    return `Continuação - ${pacienteNome}`;
  }

  return 'Bloqueio de Horário';
}

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

  const [periodoLocal, setPeriodoLocal] = useState<TurnoAgenda>('TODOS');
  const periodo = periodoProp !== undefined ? periodoProp : periodoLocal;
  const handlePeriodoChange = onPeriodoChange || setPeriodoLocal;

  const [novoAlunoNome, setNovoAlunoNome] = useState<string>('');
  const [criandoAluno, setCriandoAluno] = useState<boolean>(false);

  // Filtra "Atendimento Extra" e alunos inativos da grade da Agenda Fixa,
  // exibindo somente alunos regulares e ativos (a menos que já possuam algum item fixo vinculado).
  const alunosFixa = useMemo(() => {
    return alunos.filter((a) => {
      if (isAtendimentoExtra(a.nome)) {
        return agendaFixa.some((item) => item.aluno_id === a.id);
      }
      if (a.ativo === false) {
        return agendaFixa.some((item) => item.aluno_id === a.id);
      }
      return true;
    });
  }, [alunos, agendaFixa]);

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
    descricao: string;
  }>({
    isOpen: false,
    alunoId: '',
    horario: '',
    diaSemana: 'QUINTA',
    descricao: ''
  });

  const horarios = getHorariosPorTurno(periodo);

  // Indexa itens por chave: alunoId_horarioNormalizado
  const itemMap = new Map<string, AgendaFixaItem>();
  agendaFixa
    .filter((item) => (item.dia_semana || '').toUpperCase() === diaSelecionado.toUpperCase())
    .forEach((item) => {
      const hNorm = normalizarHorario(item.horario);
      const key = `${item.aluno_id}_${hNorm}`;
      itemMap.set(key, item);
    });

  const handleAbrirCelular = (alunoId: string, horario: string) => {
    const hNorm = normalizarHorario(horario);
    const key = `${alunoId}_${hNorm}`;
    const existente = itemMap.get(key);

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
    await onSalvarItem({
      id: modalCell.itemExistente?.id,
      aluno_id: modalCell.alunoId,
      horario: normalizarHorario(modalCell.horario),
      dia_semana: modalCell.diaSemana,
      turma_id: turmaId,
      paciente: modalCell.pacienteNome.trim()
    });
    setModalCell({ ...modalCell, isOpen: false, pacienteNome: '' });
  };

  const handleSalvarNovoPaciente = async () => {
    if (!modalNovoPaciente.pacienteNome.trim() || !modalNovoPaciente.alunoId) return;
    await onSalvarItem({
      aluno_id: modalNovoPaciente.alunoId,
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
      alunoId: alunosFixa[0]?.id || ''
    });
  };

  const handleSalvarEdicaoNome = async () => {
    if (!modalEditarNome.item || !modalEditarNome.pacienteNome.trim()) return;
    await onSalvarItem({
      id: modalEditarNome.item.id,
      aluno_id: modalEditarNome.item.aluno_id,
      horario: modalEditarNome.item.horario,
      dia_semana: modalEditarNome.item.dia_semana,
      turma_id: turmaId,
      paciente: modalEditarNome.pacienteNome.trim()
    });
    setModalEditarNome({ isOpen: false, pacienteNome: '' });
  };

  const handleSalvarFecharHorario = async () => {
    if (!modalFecharHorario.descricao.trim() || !modalFecharHorario.alunoId) return;
    await onSalvarItem({
      aluno_id: modalFecharHorario.alunoId,
      horario: normalizarHorario(modalFecharHorario.horario),
      dia_semana: modalFecharHorario.diaSemana,
      turma_id: turmaId,
      paciente: modalFecharHorario.descricao.trim(),
      tipo_registro: 'bloqueio'
    });
    setModalFecharHorario({
      isOpen: false,
      alunoId: '',
      horario: '',
      diaSemana: 'QUINTA',
      descricao: ''
    });
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
      const alunoNome =
        item.agenda_alunos?.nome ||
        alunoNomeMap.get(item.aluno_id) ||
        'Não Informado';

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
    await onSalvarItem({
      id: moverModal.item.id,
      aluno_id: moverModal.novoAlunoId,
      horario: moverModal.item.horario,
      dia_semana: moverModal.item.dia_semana,
      turma_id: turmaId,
      paciente: moverModal.item.paciente
    });
    setMoverModal({ isOpen: false, novoAlunoId: '' });
  };

  const handleConfirmarMoverHorario = async () => {
    if (!modalMoverHorario.item || !modalMoverHorario.alunoId) return;

    const { item, diaSemana, horario, alunoId } = modalMoverHorario;
    const hNormDestino = normalizarHorario(horario);

    // Validação: verificar se já existe outro paciente no slot de destino
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

    await onSalvarItem({
      id: item.id,
      paciente: item.paciente,
      dia_semana: diaSemana,
      horario: hNormDestino,
      aluno_id: alunoId,
      turma_id: turmaId
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
      {/* Barra Superior de Controles: Dias e Períodos */}
      <AgendaFiltrosHeader
        diaSelecionado={diaSelecionado as DiaSemana}
        onDiaChange={handleDiaChange}
        periodo={periodo}
        onPeriodoChange={handlePeriodoChange}
      >
        {/* Ações da Turma: Adicionar Aluno, Adicionar Paciente e Exportar */}
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
                  alunoId: alunosFixa[0]?.id || ''
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

      {/* Grid / Tabela Kanban da Agenda Fixa */}
      {alunosFixa.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Nenhum aluno cadastrado nesta turma</h4>
          <p className="text-xs text-slate-500 mt-1">Adicione alunos acima ou importe um JSON para criá-los automaticamente.</p>
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
                  {alunosFixa.map((aluno) => (
                    <th
                      key={aluno.id}
                      className="p-3 text-xs font-bold text-slate-800 border-r border-slate-200 min-w-[200px]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span className="truncate" title={aluno.nome}>{aluno.nome}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {horarios.map((h) => {
                  const isTurnoDivisor = h === HORARIO_DIVISOR_TURNO && periodo === 'TODOS';
                  return (
                    <React.Fragment key={h}>
                      {isTurnoDivisor && (
                        <tr className="bg-slate-100/80 font-bold text-slate-500 text-[11px]">
                          <td colSpan={alunosFixa.length + 1} className="py-1 px-3 border-y border-slate-200">
                            --- Turno da Tarde (Intervalos de 15 min) ---
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 text-center font-mono">
                          {h}
                        </td>
                        {alunosFixa.map((aluno) => {
                          const hNorm = normalizarHorario(h);
                          const item = itemMap.get(`${aluno.id}_${hNorm}`);

                          return (
                            <td
                              key={aluno.id}
                              className="p-2 border-r border-slate-100 align-top relative group"
                            >
                              {item ? (
                                <AgendaCardAtendimento
                                  item={{
                                    id: item.id,
                                    paciente: item.paciente,
                                    aluno_id: item.aluno_id,
                                    aluno: item.agenda_alunos?.nome || alunos.find((a) => a.id === item.aluno_id)?.nome,
                                    horario: item.horario,
                                    dia_semana: item.dia_semana,
                                    tipo_registro: item.tipo_registro
                                  }}
                                  podeEditar={isCoordenadorOrAdmin}
                                  onEditar={() =>
                                    setModalEditarNome({
                                      isOpen: true,
                                      item,
                                      pacienteNome: item.paciente
                                    })
                                  }
                                  onReagendar={() =>
                                    setModalMoverHorario({
                                      isOpen: true,
                                      item,
                                      diaSemana: item.dia_semana || diaSelecionado,
                                      horario: formatarHorarioExibicao(item.horario),
                                      alunoId: item.aluno_id,
                                      erro: undefined
                                    })
                                  }
                                  onTrocarAluno={() => setMoverModal({ isOpen: true, item, novoAlunoId: '' })}
                                  onExcluir={() => onRemoverItem(item.id)}
                                />
                              ) : (
                                <div className="w-full h-11 border border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-1 p-0.5 group/empty hover:border-slate-300 transition-all">
                                  <button
                                    type="button"
                                    title="Adicionar Paciente"
                                    onClick={() => handleAbrirCelular(aluno.id, h)}
                                    className="flex-1 h-full rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50/50 transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5 opacity-60 group-hover/empty:opacity-100 transition-opacity" />
                                  </button>
                                  {isCoordenadorOrAdmin && (
                                    <button
                                      type="button"
                                      title="Fechar Horário (Bloqueio)"
                                      onClick={() => {
                                        const sugestao = sugerirSequenciaFecharHorario(
                                          agendaFixa,
                                          aluno.id,
                                          diaSelecionado,
                                          h
                                        );
                                        setModalFecharHorario({
                                          isOpen: true,
                                          alunoId: aluno.id,
                                          horario: h,
                                          diaSemana: diaSelecionado,
                                          descricao: sugestao
                                        });
                                      }}
                                      className="h-full px-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50/80 transition-all"
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
              <div><strong>Aluno:</strong> {alunos.find((a) => a.id === modalCell.alunoId)?.nome}</div>
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
              <label className="text-xs font-bold text-slate-700 block mb-1">Selecione o Novo Aluno</label>
              <select
                value={moverModal.novoAlunoId}
                onChange={(e) => setMoverModal({ ...moverModal, novoAlunoId: e.target.value })}
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Selecione um aluno...</option>
                {alunosFixa
                  .filter((a) => a.id !== moverModal.item?.aluno_id)
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
                    {[...HORARIOS_MANHA, ...HORARIOS_TARDE].map((h) => (
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
                  {alunosFixa.map((a) => (
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
                    {[...HORARIOS_MANHA, ...HORARIOS_TARDE].map((h) => (
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
                  {alunosFixa.map((a) => (
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
          <div id="modal-fechar-horario" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Lock className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Fechar Horário (Bloqueio)</h4>
              </div>
              <button
                type="button"
                onClick={() => setModalFecharHorario({ ...modalFecharHorario, isOpen: false, descricao: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1 border border-slate-100">
              <div><strong>Dia:</strong> {modalFecharHorario.diaSemana}</div>
              <div><strong>Horário:</strong> {formatarHorarioExibicao(modalFecharHorario.horario)}</div>
              <div>
                <strong>Aluno:</strong>{' '}
                {alunos.find((a) => a.id === modalFecharHorario.alunoId)?.nome || 'Aluno'}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Sequência / Descrição do Bloqueio <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-fechar-horario-descricao"
                type="text"
                autoFocus
                value={modalFecharHorario.descricao}
                onChange={(e) => setModalFecharHorario({ ...modalFecharHorario, descricao: e.target.value })}
                placeholder="Ex: Continuação - Nome do Paciente"
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSalvarFecharHorario()}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Este horário ficará marcado com cadeado e não gerará inconsistência nos relatórios.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalFecharHorario({ ...modalFecharHorario, isOpen: false, descricao: '' })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarFecharHorario}
                disabled={!modalFecharHorario.descricao.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50"
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
