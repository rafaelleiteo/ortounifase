import React, { useState } from 'react';
import {
  AgendaAluno,
  AgendaFixaItem,
  HORARIOS_MANHA,
  HORARIOS_TARDE,
  DIAS_SEMANA,
  normalizarHorario,
  formatarHorarioExibicao
} from '@/lib/agendaTypes';
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
  AlertTriangle
} from 'lucide-react';

interface AgendaFixaTabProps {
  turmaId: string;
  turmaNome: string;
  alunos: AgendaAluno[];
  agendaFixa: AgendaFixaItem[];
  onSalvarItem: (item: Partial<AgendaFixaItem>) => Promise<void>;
  onRemoverItem: (id: string) => Promise<void>;
  onCriarAluno: (nome: string) => Promise<void>;
  isCoordenadorOrAdmin?: boolean;
}

export const AgendaFixaTab: React.FC<AgendaFixaTabProps> = ({
  turmaId,
  turmaNome,
  alunos,
  agendaFixa,
  onSalvarItem,
  onRemoverItem,
  onCriarAluno,
  isCoordenadorOrAdmin = true
}) => {
  const [diaSelecionado, setDiaSelecionado] = useState<string>('QUINTA');
  const [periodo, setPeriodo] = useState<'MANHA' | 'TARDE' | 'TODOS'>('TODOS');
  const [novoAlunoNome, setNovoAlunoNome] = useState<string>('');
  const [criandoAluno, setCriandoAluno] = useState<boolean>(false);

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

  const horarios =
    periodo === 'MANHA'
      ? HORARIOS_MANHA
      : periodo === 'TARDE'
      ? HORARIOS_TARDE
      : [...HORARIOS_MANHA, ...HORARIOS_TARDE];

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
      alunoId: alunos[0]?.id || ''
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

  const handleExportarCSV = () => {
    if (agendaFixa.length === 0) {
      alert('Não há registros na Agenda Fixa para exportar.');
      return;
    }

    const alunoNomeMap = new Map<string, string>();
    alunos.forEach((a) => alunoNomeMap.set(a.id, a.nome));

    // Cabeçalho CSV
    const headers = ['dia_semana', 'horario', 'paciente', 'aluno'];
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
        escapeCSV(alunoNome)
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
    URL.revokeObjectURL(url);
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Seletor de Dia da Semana */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dia da Semana:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {DIAS_SEMANA.map((dia) => (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaSelecionado(dia)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  diaSelecionado === dia
                    ? 'bg-white text-brand-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dia}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Período */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Turno:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['TODOS', 'MANHA', 'TARDE'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodo === p
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p === 'TODOS' ? 'Todos os Horários' : p === 'MANHA' ? 'Manhã (08h - 11h30)' : 'Tarde (13h30 - 15h45)'}
              </button>
            ))}
          </div>
        </div>

        {/* Ações da Turma: Adicionar Aluno, Adicionar Paciente e Exportar */}
        <div className="flex flex-wrap items-center gap-2">
          {isCoordenadorOrAdmin && (
            <button
              type="button"
              onClick={() =>
                setModalNovoPaciente({
                  isOpen: true,
                  pacienteNome: '',
                  diaSemana: diaSelecionado,
                  horario: '08:00',
                  alunoId: alunos[0]?.id || ''
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
      </div>

      {/* Grid / Tabela Kanban da Agenda Fixa */}
      {alunos.length === 0 ? (
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
                  {alunos.map((aluno) => (
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
                  const isTurnoDivisor = h === '13:30' && periodo === 'TODOS';
                  return (
                    <React.Fragment key={h}>
                      {isTurnoDivisor && (
                        <tr className="bg-slate-100/80 font-bold text-slate-500 text-[11px]">
                          <td colSpan={alunos.length + 1} className="py-1 px-3 border-y border-slate-200">
                            --- Turno da Tarde (Intervalos de 15 min) ---
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 text-center font-mono">
                          {h}
                        </td>
                        {alunos.map((aluno) => {
                          const hNorm = normalizarHorario(h);
                          const item = itemMap.get(`${aluno.id}_${hNorm}`);

                          return (
                            <td
                              key={aluno.id}
                              className="p-2 border-r border-slate-100 align-top relative group"
                            >
                              {item ? (
                                <div className="p-2 rounded-xl bg-brand-50/70 border border-brand-200/90 shadow-2xs flex flex-col justify-between group-hover:border-brand-400 group-hover:bg-brand-50 transition-all">
                                  <div className="font-semibold text-slate-800 break-words mb-1.5">
                                    {item.paciente}
                                  </div>
                                  <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 pt-1 border-t border-brand-200/50">
                                    <button
                                      type="button"
                                      title="Editar Nome do Paciente"
                                      onClick={() =>
                                        setModalEditarNome({
                                          isOpen: true,
                                          item,
                                          pacienteNome: item.paciente
                                        })
                                      }
                                      className="p-1 text-slate-500 hover:text-brand-600 rounded-md hover:bg-white"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Mover Paciente (Horário/Dia)"
                                      onClick={() =>
                                        setModalMoverHorario({
                                          isOpen: true,
                                          item,
                                          diaSemana: item.dia_semana || diaSelecionado,
                                          horario: formatarHorarioExibicao(item.horario),
                                          alunoId: item.aluno_id,
                                          erro: undefined
                                        })
                                      }
                                      className="p-1 text-slate-500 hover:text-blue-600 rounded-md hover:bg-white"
                                    >
                                      <CalendarClock className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Mover para outro Aluno"
                                      onClick={() => setMoverModal({ isOpen: true, item, novoAlunoId: '' })}
                                      className="p-1 text-slate-500 hover:text-amber-600 rounded-md hover:bg-white"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Remover"
                                      onClick={() => onRemoverItem(item.id)}
                                      className="p-1 text-slate-500 hover:text-rose-600 rounded-md hover:bg-white"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirCelular(aluno.id, h)}
                                  className="w-full h-11 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50/30 transition-all group/btn"
                                >
                                  <Plus className="w-3.5 h-3.5 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                </button>
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
                {alunos
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
                  {alunos.map((a) => (
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
                  {alunos.map((a) => (
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
    </div>
  );
};
