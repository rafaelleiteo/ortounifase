/**
 * Funcoes Puras para Canonicalizacao e Manipulacao de Dias da Semana
 *
 * Garante compatibilidade total entre variacoes de acento (Sabado vs SÁBADO),
 * caixa (Sexta vs SEXTA), sufixos (-feira) e abreviacoes (sab, sáb, qui, sex).
 */

export const DIAS_SEMANA_CANONICOS = [
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
  'DOMINGO'
] as const;

export type DiaSemanaCanonica = typeof DIAS_SEMANA_CANONICOS[number];

/**
 * Remove acentos (NFD), converte para maiusculas, remove sufixo "-feira",
 * remove espacos extras e pontos finais, devolvendo a chave canonica.
 *
 * Retorna null para valores vazios, indefinidos ou nao reconhecidos.
 */
export function canonicalizarDia(valor?: string | null): DiaSemanaCanonica | null {
  if (!valor || typeof valor !== 'string') {
    return null;
  }

  // 1. Normaliza NFD e remove diacriticos (acentos)
  const semAcentos = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 2. Maiusculas e trim
  let limpo = semAcentos.toUpperCase().trim();
  if (!limpo) {
    return null;
  }

  // 3. Colapsa multiplos espacos em espaco unico
  limpo = limpo.replace(/\s+/g, ' ');

  // 4. Remove ponto final residual (ex: 'SAB.', 'SEX.')
  limpo = limpo.replace(/\.+$/g, '').trim();

  // 5. Remove sufixo '-FEIRA' ou ' FEIRA'
  limpo = limpo.replace(/[- ]FEIRA$/g, '').trim();

  // 6. Mapeamento de chaves e abreviacoes
  switch (limpo) {
    case 'SEGUNDA':
    case 'SEG':
      return 'SEGUNDA';

    case 'TERCA':
    case 'TER':
      return 'TERCA';

    case 'QUARTA':
    case 'QUA':
      return 'QUARTA';

    case 'QUINTA':
    case 'QUI':
      return 'QUINTA';

    case 'SEXTA':
    case 'SEX':
      return 'SEXTA';

    case 'SABADO':
    case 'SAB':
      return 'SABADO';

    case 'DOMINGO':
    case 'DOM':
      return 'DOMINGO';

    default:
      return null;
  }
}

export interface ResultadoNormalizacaoDia {
  dia: DiaSemanaCanonica | null;
  erro: string | null;
}

/**
 * Valida e normaliza o dia da semana para processos de importacao.
 * Rejeita valores vazios, indefinidos ou nao reconhecidos sem fallback silencioso.
 */
export function normalizarDiaImportacao(valor?: string | null): ResultadoNormalizacaoDia {
  const canonico = canonicalizarDia(valor);
  if (!canonico) {
    const valorExibicao = valor === undefined ? 'undefined' : valor === null ? 'null' : String(valor);
    return {
      dia: null,
      erro: `dia da semana nao reconhecido: "${valorExibicao}"`
    };
  }
  return {
    dia: canonico,
    erro: null
  };
}

/**
 * Retorna o texto formatado para exibicao na interface do usuario.
 * Exemplo: 'SABADO' -> 'Sábado', 'TERCA' -> 'Terça-feira'.
 */
export function rotuloDia(valor?: string | null): string | null {
  const canonico = canonicalizarDia(valor);
  if (!canonico) {
    return null;
  }

  switch (canonico) {
    case 'SEGUNDA':
      return 'Segunda-feira';
    case 'TERCA':
      return 'Terça-feira';
    case 'QUARTA':
      return 'Quarta-feira';
    case 'QUINTA':
      return 'Quinta-feira';
    case 'SEXTA':
      return 'Sexta-feira';
    case 'SABADO':
      return 'Sábado';
    case 'DOMINGO':
      return 'Domingo';
  }
}

/**
 * Retorna true se ambos os valores representam o mesmo dia da semana canonico.
 */
export function mesmoDia(a?: string | null, b?: string | null): boolean {
  const ca = canonicalizarDia(a);
  const cb = canonicalizarDia(b);
  return ca !== null && ca === cb;
}

/**
 * Compara dois dias da semana segundo a ordem canonica de Segunda a Domingo.
 * Valores nao reconhecidos sao ordenados ao final.
 */
export function compararDiasSemana(a?: string | null, b?: string | null): number {
  const ca = canonicalizarDia(a);
  const cb = canonicalizarDia(b);

  const idxA = ca ? DIAS_SEMANA_CANONICOS.indexOf(ca) : 999;
  const idxB = cb ? DIAS_SEMANA_CANONICOS.indexOf(cb) : 999;

  if (idxA !== idxB) {
    return idxA - idxB;
  }

  return (a || '').localeCompare(b || '');
}
