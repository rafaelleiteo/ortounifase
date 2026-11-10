import { mesmoDia, normalizarHorario, isItemBloqueio } from './agendaTypes';

export interface ItemOcupacaoGrade {
  id?: string;
  paciente?: string;
  horario?: string;
  dia_semana?: string;
  tipo_registro?: string;
  tipo_bloqueio?: any;
  [key: string]: any;
}

export interface PacientesNoHorarioOptions {
  excluirId?: string | null;
}

/**
 * Retorna a lista de itens que ocupam aquele dia e horario (todos os alunos),
 * ignorando bloqueios de horario e permitindo excluir o proprio item em edicao.
 */
export function pacientesNoHorario<T extends ItemOcupacaoGrade>(
  itens: T[],
  dia?: string | null,
  horario?: string | null,
  opcoes?: PacientesNoHorarioOptions
): T[] {
  if (!itens || !Array.isArray(itens) || !dia || !horario) {
    return [];
  }

  const hNorm = normalizarHorario(horario);
  const excluirId = opcoes?.excluirId;

  return itens.filter((item) => {
    if (!item) return false;
    if (excluirId && item.id === excluirId) return false;
    if (isItemBloqueio(item)) return false;
    if (!mesmoDia(item.dia_semana, dia)) return false;
    if (normalizarHorario(item.horario || '') !== hNorm) return false;
    return true;
  });
}

/**
 * Gera o texto do aviso nao bloqueante de ocupacao de horario.
 * Formato: "Ja existe(m) N paciente(s) neste horario: Nome1, Nome2. Voce pode confirmar mesmo assim."
 */
export function formatarAvisoOcupacao(
  itensOuNomes?: Array<ItemOcupacaoGrade | string> | null
): string | null {
  if (!itensOuNomes || !Array.isArray(itensOuNomes) || itensOuNomes.length === 0) {
    return null;
  }

  const nomes = itensOuNomes
    .map((item) => (typeof item === 'string' ? item : item.paciente || 'Paciente'))
    .map((n) => n.trim())
    .filter(Boolean);

  if (nomes.length === 0) {
    return null;
  }

  const n = nomes.length;
  return `Ja existe(m) ${n} paciente(s) neste horario: ${nomes.join(', ')}. Voce pode confirmar mesmo assim.`;
}
