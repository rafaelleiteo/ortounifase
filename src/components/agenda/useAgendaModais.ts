import { useState } from 'react';
import { AgendaCardItem } from './AgendaCardAtendimento';
import {
  ModalEditarState,
  ModalReagendarState,
  ModalTrocarAlunoState
} from './AgendaModaisAtendimento';
import {
  normalizarHorario,
  formatarHorarioExibicao,
  isItemBloqueio,
  getTipoBloqueio,
  getDescricaoBloqueio,
  TipoBloqueio
} from '@/lib/agendaTypes';

interface UseAgendaModaisOptions {
  onSalvarItem: (dados: {
    id: string;
    paciente?: string;
    aluno_id?: string | null;
    horario?: string;
    dia_semana?: string;
    tipo_registro?: 'paciente' | 'bloqueio';
    tipo_bloqueio?: TipoBloqueio;
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
    const isBloqueio = item.tipo_registro === 'bloqueio' || isItemBloqueio(item);
    setModalEditar({
      isOpen: true,
      item,
      paciente: isBloqueio ? getDescricaoBloqueio(item.paciente) : item.paciente,
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
    const itemOriginal = modalEditar.item;
    const isBloqueio = itemOriginal?.tipo_registro === 'bloqueio' || isItemBloqueio(itemOriginal);
    const tipo = itemOriginal?.tipo_bloqueio || (itemOriginal ? getTipoBloqueio(itemOriginal) : undefined);

    const pacienteSalvar = isBloqueio && tipo
      ? `[${tipo}] ${dados.paciente.trim().replace(/^\[(SEQUENCIA|LIVRE|OUTRO)\]\s*/i, '')}`
      : dados.paciente.trim();

    await onSalvarItem({
      id: dados.id,
      paciente: pacienteSalvar,
      aluno_id: dados.aluno_id,
      horario: normalizarHorario(dados.horario),
      dia_semana: dados.dia_semana,
      tipo_registro: isBloqueio ? 'bloqueio' : 'paciente',
      tipo_bloqueio: isBloqueio ? tipo : undefined
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

    const isBloqueio = item.tipo_registro === 'bloqueio' || isItemBloqueio(item);
    const tipo = item.tipo_bloqueio || (isBloqueio ? getTipoBloqueio(item) : undefined);

    await onSalvarItem({
      id: dados.id,
      horario: hNormDestino,
      dia_semana: dados.dia_semana,
      tipo_registro: isBloqueio ? 'bloqueio' : undefined,
      tipo_bloqueio: isBloqueio ? tipo : undefined
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
    const item = modalTrocarAluno.item;
    const isBloqueio = item?.tipo_registro === 'bloqueio' || isItemBloqueio(item);
    const tipo = item?.tipo_bloqueio || (isBloqueio ? getTipoBloqueio(item!) : undefined);

    await onSalvarItem({
      id: dados.id,
      aluno_id: dados.novoAlunoId,
      tipo_registro: isBloqueio ? 'bloqueio' : undefined,
      tipo_bloqueio: isBloqueio ? tipo : undefined
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
