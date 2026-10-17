import { useState } from 'react';
import { AgendaCardItem } from './AgendaCardAtendimento';
import {
  ModalEditarState,
  ModalReagendarState,
  ModalTrocarAlunoState
} from './AgendaModaisAtendimento';
import { normalizarHorario, formatarHorarioExibicao } from '@/lib/agendaTypes';

interface UseAgendaModaisOptions {
  onSalvarItem: (dados: {
    id: string;
    paciente?: string;
    aluno_id?: string | null;
    horario?: string;
    dia_semana?: string;
  }) => Promise<void> | void;
  itensExistentes?: AgendaCardItem[];
  alunos?: Array<{ id: string; nome: string }>;
  diaDefault?: string;
}

export function useAgendaModais({
  onSalvarItem,
  itensExistentes = [],
  alunos = [],
  diaDefault = 'QUINTA'
}: UseAgendaModaisOptions) {
  const [modalEditar, setModalEditar] = useState<ModalEditarState>({
    isOpen: false,
    paciente: '',
    alunoId: '',
    horario: '08:00',
    diaSemana: diaDefault
  });

  const [modalReagendar, setModalReagendar] = useState<ModalReagendarState>({
    isOpen: false,
    horario: '08:00',
    diaSemana: diaDefault,
    alunoId: '',
    erro: undefined
  });

  const [modalTrocarAluno, setModalTrocarAluno] = useState<ModalTrocarAlunoState>({
    isOpen: false,
    novoAlunoId: ''
  });

  // 1. Abrir Modal Editar
  const abrirEditar = (item: AgendaCardItem) => {
    setModalEditar({
      isOpen: true,
      item,
      paciente: item.paciente,
      alunoId: item.aluno_id || '',
      horario: formatarHorarioExibicao(item.horario),
      diaSemana: item.dia_semana || diaDefault
    });
  };

  const fecharEditar = () => {
    setModalEditar((prev) => ({ ...prev, isOpen: false, item: undefined }));
  };

  const handleSalvarEditar = async (dados: {
    id: string;
    paciente: string;
    aluno_id: string | null;
    horario: string;
    dia_semana: string;
  }) => {
    await onSalvarItem({
      id: dados.id,
      paciente: dados.paciente.trim(),
      aluno_id: dados.aluno_id,
      horario: normalizarHorario(dados.horario),
      dia_semana: dados.dia_semana
    });
    fecharEditar();
  };

  // 2. Abrir Modal Reagendar
  const abrirReagendar = (item: AgendaCardItem) => {
    setModalReagendar({
      isOpen: true,
      item,
      horario: formatarHorarioExibicao(item.horario),
      diaSemana: item.dia_semana || diaDefault,
      alunoId: item.aluno_id || '',
      erro: undefined
    });
  };

  const fecharReagendar = () => {
    setModalReagendar((prev) => ({ ...prev, isOpen: false, item: undefined, erro: undefined }));
  };

  const handleSalvarReagendar = async (dados: {
    id: string;
    horario: string;
    dia_semana: string;
  }) => {
    const item = modalReagendar.item;
    if (!item) return;

    const hNormDestino = normalizarHorario(dados.horario);

    // Validação de conflito se item possui aluno atribuído
    if (item.aluno_id && itensExistentes.length > 0) {
      const conflito = itensExistentes.find(
        (outro) =>
          outro.id !== item.id &&
          outro.aluno_id === item.aluno_id &&
          (outro.dia_semana || '').toUpperCase() === dados.dia_semana.toUpperCase() &&
          normalizarHorario(outro.horario) === hNormDestino
      );

      if (conflito) {
        const alunoNome =
          alunos.find((a) => a.id === item.aluno_id)?.nome || 'o aluno selecionado';
        setModalReagendar((prev) => ({
          ...prev,
          erro: `Atenção: Já existe o paciente "${conflito.paciente}" agendado para ${alunoNome} na ${dados.dia_semana} às ${formatarHorarioExibicao(dados.horario)}.`
        }));
        return;
      }
    }

    await onSalvarItem({
      id: dados.id,
      horario: hNormDestino,
      dia_semana: dados.dia_semana
    });
    fecharReagendar();
  };

  // 3. Abrir Modal Trocar Aluno
  const abrirTrocarAluno = (item: AgendaCardItem) => {
    setModalTrocarAluno({
      isOpen: true,
      item,
      novoAlunoId: ''
    });
  };

  const fecharTrocarAluno = () => {
    setModalTrocarAluno((prev) => ({ ...prev, isOpen: false, item: undefined, novoAlunoId: '' }));
  };

  const handleSalvarTrocaAluno = async (dados: {
    id: string;
    novoAlunoId: string | null;
  }) => {
    await onSalvarItem({
      id: dados.id,
      aluno_id: dados.novoAlunoId
    });
    fecharTrocarAluno();
  };

  return {
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
  };
}
