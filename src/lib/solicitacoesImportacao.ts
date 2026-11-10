/**
 * Tipos e Funcoes Puras para Importacao em Lote de Solicitacoes de Agendamento
 */

import { TurmaItem, normalizarNomePaciente } from './solicitacoesTypes';

export const MAX_LINHAS_IMPORTACAO = 200;

export type StatusLinhaImportacao =
  | 'ok'
  | 'aviso'
  | 'parecida'
  | 'duplicada_banco'
  | 'duplicada_lote'
  | 'erro';

export interface LinhaImportacaoAnalisada {
  indice: number; // 1-indexed para exibicao ao usuario
  paciente: string;
  agendaOriginal: string | null;
  turma_id: string | null;
  turmaNome: string; // Nome da turma ou "Indefinida"
  observacao: string;
  status: StatusLinhaImportacao;
  nomeParecidoCom?: string;
  motivoStatus?: string;
  selecionada: boolean;
}

export interface PayloadImportacao {
  paciente: string;
  turma_id: string | null;
  observacao: string | null;
}

export interface ResumoImportacao {
  total: number;
  prontas: number;
  parecidas: number;
  duplicadas: number;
  erros: number;
}

/**
 * Calcula a distancia de edicao de Levenshtein entre duas strings.
 */
export function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const charA = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // delecao
        curr[j - 1] + 1,   // insercao
        prev[j - 1] + cost // substituicao
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[n];
}

/**
 * Funcao pura para detectar se dois nomes de pacientes sao parecidos.
 * Avalia sobre nomes normalizados (sem acento, minusculas, trim).
 *
 * Retorna verdadeiro quando:
 * (1) Um nome e prefixo do outro e o menor tem pelo menos 15 caracteres (o sistema de origem corta nomes em 33 caracteres);
 * (2) As duas listas de palavras sao iguais em ordem diferente;
 * (3) A distancia de edicao e no maximo 2 e ambos tem pelo menos 10 caracteres.
 */
export function nomesParecidos(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const normA = normalizarNomePaciente(a);
  const normB = normalizarNomePaciente(b);

  if (!normA || !normB) return false;
  // Se forem identicos, e duplicidade exata, nao apenas parecido
  if (normA === normB) return false;

  const minLen = Math.min(normA.length, normB.length);

  // (1) Prefixo onde o menor tem pelo menos 15 caracteres
  if (minLen >= 15 && (normA.startsWith(normB) || normB.startsWith(normA))) {
    return true;
  }

  // (2) Listas de palavras sao iguais em ordem diferente
  const wordsA = normA.split(' ').filter(Boolean).sort().join(' ');
  const wordsB = normB.split(' ').filter(Boolean).sort().join(' ');
  if (wordsA === wordsB) {
    return true;
  }

  // (3) Distancia de edicao no maximo 2 e ambos tem pelo menos 10 caracteres
  if (normA.length >= 10 && normB.length >= 10) {
    if (Math.abs(normA.length - normB.length) <= 2) {
      if (distanciaLevenshtein(normA, normB) <= 2) {
        return true;
      }
    }
  }

  return false;
}

const SINONIMOS_INDEFINIDA = new Set([
  '',
  'indefinida',
  'indefinido',
  'nenhuma',
  'a definir',
  'sem agenda',
  '-',
  'null',
  'none'
]);

/**
 * Normaliza o nome da agenda:
 * - Converte para minusculas
 * - Remove acentos (NFD)
 * - Colapsa espacos
 * - Remove o prefixo "turma " se presente
 */
export function normalizarNomeAgenda(agenda?: string | null): string {
  if (!agenda || typeof agenda !== 'string') return '';
  const semAcento = agenda
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  return semAcento.replace(/^turma\s+/, '').trim();
}

/**
 * Casa uma string de agenda com a lista de turmas cadastradas no banco de dados.
 */
export function casarAgendaComTurmas(
  agendaOriginal: string | null | undefined,
  turmas: TurmaItem[]
): { turma_id: string | null; turmaNome: string; aviso: string | null } {
  if (agendaOriginal === null || agendaOriginal === undefined) {
    return { turma_id: null, turmaNome: 'Indefinida', aviso: null };
  }

  const textoAparado = String(agendaOriginal).trim();
  const norm = normalizarNomeAgenda(textoAparado);

  if (SINONIMOS_INDEFINIDA.has(norm)) {
    return { turma_id: null, turmaNome: 'Indefinida', aviso: null };
  }

  // Busca correspondencias exatas pelo nome normalizado
  const correspondencias = turmas.filter((t) => {
    const normTurma = normalizarNomeAgenda(t.nome);
    return normTurma === norm;
  });

  if (correspondencias.length === 1) {
    const t = correspondencias[0];
    return { turma_id: t.id, turmaNome: t.nome, aviso: null };
  }

  if (correspondencias.length > 1) {
    return {
      turma_id: null,
      turmaNome: 'Indefinida',
      aviso: `Agenda '${textoAparado}' e ambigua (mais de uma turma encontrada); sera importada como indefinida`
    };
  }

  return {
    turma_id: null,
    turmaNome: 'Indefinida',
    aviso: `Agenda '${textoAparado}' nao reconhecida; sera importada como indefinida`
  };
}

/**
 * Realiza o parse inicial do texto JSON colado ou carregado.
 * Suporta cercas de markdown (```json ... ```), BOM e objetos com chave "solicitacoes".
 */
export function parsearJsonImportacao(texto: string): unknown[] {
  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    throw new Error('O texto informado esta vazio. Cole o JSON ou selecione um arquivo.');
  }

  let limpo = texto.replace(/^\uFEFF/, '').trim();

  // Remove cercas de markdown caso o usuario tenha copiado com blocos de codigo
  if (limpo.startsWith('```')) {
    limpo = limpo
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(limpo);
  } catch (err: any) {
    throw new Error('O texto informado nao e um JSON valido. Verifique a sintaxe (chaves, colchetes e aspas).');
  }

  let lista: unknown[];
  if (Array.isArray(parsed)) {
    lista = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    'solicitacoes' in parsed &&
    Array.isArray((parsed as any).solicitacoes)
  ) {
    lista = (parsed as any).solicitacoes;
  } else {
    throw new Error('O JSON deve ser uma lista de solicitacoes ou um objeto com a chave "solicitacoes" contendo uma lista.');
  }

  if (lista.length === 0) {
    throw new Error('A lista de solicitacoes esta vazia.');
  }

  if (lista.length > MAX_LINHAS_IMPORTACAO) {
    throw new Error(`O lote excede o limite maximo de ${MAX_LINHAS_IMPORTACAO} solicitacoes por importacao (recebidas: ${lista.length}).`);
  }

  return lista;
}

/**
 * Analisa cada item da lista crua, aplicando validacao, casamento de agenda
 * e deteccao de duplicidades no lote e no banco de dados.
 */
export function analisarLoteImportacao(
  itensCrus: unknown[],
  turmas: TurmaItem[],
  pacientesPendentesBanco: Array<{ paciente: string }>
): LinhaImportacaoAnalisada[] {
  // Mapa de nomes normalizados de pacientes ja pendentes no banco
  const bancoNomesSet = new Set(
    pacientesPendentesBanco.map((p) => normalizarNomePaciente(p.paciente))
  );

  // Conjunto para rastrear nomes que ja apareceram no proprio lote
  const nomesVistosNoLote = new Set<string>();

  const resultado: LinhaImportacaoAnalisada[] = [];

  for (let i = 0; i < itensCrus.length; i++) {
    const raw = itensCrus[i];
    const indice = i + 1;

    if (!raw || typeof raw !== 'object') {
      resultado.push({
        indice,
        paciente: '',
        agendaOriginal: null,
        turma_id: null,
        turmaNome: 'Indefinida',
        observacao: '',
        status: 'erro',
        motivoStatus: 'Item invalido (nao e um objeto)',
        selecionada: false
      });
      continue;
    }

    const obj = raw as Record<string, unknown>;

    // Extrai com suporte a apelidos
    const rawPaciente = obj.paciente ?? obj.nome;
    const rawAgenda = obj.agenda ?? obj.turma;
    const rawObs = obj.observacao ?? obj.observação ?? obj.obs;

    const pacienteStr = typeof rawPaciente === 'string' ? rawPaciente.trim() : '';
    const obsStr = typeof rawObs === 'string' ? rawObs.trim() : rawObs ? String(rawObs) : '';
    const agendaOriginalStr = rawAgenda !== null && rawAgenda !== undefined ? String(rawAgenda) : null;

    // 1. Validacao de erro estrutural
    if (!pacienteStr) {
      resultado.push({
        indice,
        paciente: '',
        agendaOriginal: agendaOriginalStr,
        turma_id: null,
        turmaNome: 'Indefinida',
        observacao: obsStr,
        status: 'erro',
        motivoStatus: 'Nome do paciente e obrigatorio',
        selecionada: false
      });
      continue;
    }

    if (pacienteStr.length > 200) {
      resultado.push({
        indice,
        paciente: pacienteStr,
        agendaOriginal: agendaOriginalStr,
        turma_id: null,
        turmaNome: 'Indefinida',
        observacao: obsStr,
        status: 'erro',
        motivoStatus: 'Nome do paciente nao pode exceder 200 caracteres',
        selecionada: false
      });
      continue;
    }

    if (obsStr.length > 1000) {
      resultado.push({
        indice,
        paciente: pacienteStr,
        agendaOriginal: agendaOriginalStr,
        turma_id: null,
        turmaNome: 'Indefinida',
        observacao: obsStr,
        status: 'erro',
        motivoStatus: 'Observacao nao pode exceder 1000 caracteres',
        selecionada: false
      });
      continue;
    }

    // 2. Casamento de agenda
    const { turma_id, turmaNome, aviso } = casarAgendaComTurmas(agendaOriginalStr, turmas);

    // 3. Verificacao de duplicidade
    const normNome = normalizarNomePaciente(pacienteStr);

    if (nomesVistosNoLote.has(normNome)) {
      resultado.push({
        indice,
        paciente: pacienteStr,
        agendaOriginal: agendaOriginalStr,
        turma_id,
        turmaNome,
        observacao: obsStr,
        status: 'duplicada_lote',
        motivoStatus: 'Nome repetido dentro do proprio lote de importacao',
        selecionada: false
      });
      continue;
    }

    nomesVistosNoLote.add(normNome);

    if (bancoNomesSet.has(normNome)) {
      resultado.push({
        indice,
        paciente: pacienteStr,
        agendaOriginal: agendaOriginalStr,
        turma_id,
        turmaNome,
        observacao: obsStr,
        status: 'duplicada_banco',
        motivoStatus: 'Ja existe solicitacao pendente para este paciente no sistema',
        selecionada: false
      });
      continue;
    }

    // 4. Verificacao de nome parecido (contra pendentes do banco e contra outras linhas do lote)
    const parecidoBanco = pacientesPendentesBanco.find((p) =>
      nomesParecidos(pacienteStr, p.paciente)
    );
    const parecidoLote = resultado.find(
      (r) => r.status !== 'erro' && nomesParecidos(pacienteStr, r.paciente)
    );

    const nomeParecidoRef = parecidoBanco ? parecidoBanco.paciente : parecidoLote ? parecidoLote.paciente : null;

    if (nomeParecidoRef) {
      resultado.push({
        indice,
        paciente: pacienteStr,
        agendaOriginal: agendaOriginalStr,
        turma_id,
        turmaNome,
        observacao: obsStr,
        status: 'parecida',
        nomeParecidoCom: nomeParecidoRef,
        motivoStatus: `Nome parecido com: ${nomeParecidoRef}`,
        selecionada: true
      });
      continue;
    }

    if (aviso) {
      resultado.push({
        indice,
        paciente: pacienteStr,
        agendaOriginal: agendaOriginalStr,
        turma_id,
        turmaNome,
        observacao: obsStr,
        status: 'aviso',
        motivoStatus: aviso,
        selecionada: true
      });
      continue;
    }

    resultado.push({
      indice,
      paciente: pacienteStr,
      agendaOriginal: agendaOriginalStr,
      turma_id,
      turmaNome,
      observacao: obsStr,
      status: 'ok',
      selecionada: true
    });
  }

  return resultado;
}

/**
 * Calcula o resumo quantitativo de status das linhas analisadas.
 */
export function calcularResumoImportacao(linhas: LinhaImportacaoAnalisada[]): ResumoImportacao {
  let prontas = 0;
  let parecidas = 0;
  let duplicadas = 0;
  let erros = 0;

  for (const l of linhas) {
    if (l.status === 'ok' || l.status === 'aviso' || l.status === 'parecida') {
      prontas++;
      if (l.status === 'parecida') {
        parecidas++;
      }
    } else if (l.status === 'duplicada_banco' || l.status === 'duplicada_lote') {
      duplicadas++;
    } else if (l.status === 'erro') {
      erros++;
    }
  }

  return {
    total: linhas.length,
    prontas,
    parecidas,
    duplicadas,
    erros
  };
}

/**
 * Monta os payloads finais para gravacao no banco a partir das linhas selecionadas.
 */
export function montarPayloadsGravacao(linhas: LinhaImportacaoAnalisada[]): PayloadImportacao[] {
  return linhas
    .filter((l) => l.selecionada && l.status !== 'erro')
    .map((l) => ({
      paciente: l.paciente.trim(),
      turma_id: l.turma_id,
      observacao: l.observacao ? l.observacao.trim() : null
    }));
}

/**
 * Gera o texto com as instrucoes e formato JSON para ser colado no Claude.
 * Recebe a lista dinamica de turmas existentes no banco no momento.
 */
export function gerarTextoModeloClaude(turmas: TurmaItem[]): string {
  const turmasTexto =
    turmas && turmas.length > 0
      ? turmas.map((t) => `  - "${t.nome}"`).join('\n')
      : '  - "ESP1"\n  - "ESP2"\n  - "SERVIÇO"';

  const turmaExemplo =
    turmas && turmas.length > 0
      ? (turmas.find((t) => t.nome === 'ESP1')?.nome || turmas[0].nome)
      : 'ESP1';

  return `Voce e um assistente responsavel por converter listas de espera de pacientes para o formato JSON do sistema OrtoUnifase.

REGRAS OBRIGATORIAS:
1. Responda APENAS com a lista JSON pura. Nao inclua introducao, explicacoes, cumprimentos nem conclusoes.
2. Cada item da lista deve conter exatamente os campos:
   - "paciente": nome do paciente em texto (obrigatorio). Uma linha por paciente. Se uma frase trouxer dois ou mais nomes, separar em itens diferentes. Nao inventar dados, nao completar nomes cortados, nao juntar pacientes diferentes.
   - "agenda": nome exato de uma das turmas abaixo, ou null quando a agenda nao for conhecida:
${turmasTexto}
   - "observacao": informacoes que nao sao nome (ex.: "exame pronto", "retorno", "urgente", disponibilidade de horario), vao em observacao, nunca no nome. Usar null caso nao haja. NUNCA inclua dados clinicos confidenciais ou sensiveis.
3. Se a agenda nao for conhecida, usar null.
4. Mantenha o maximo de 200 itens por lote.

EXEMPLO DE RESPOSTA ESPERADA:
[
  {
    "paciente": "Maria da Silva",
    "agenda": "${turmaExemplo}",
    "observacao": "exame pronto, retorno"
  },
  {
    "paciente": "Joao Souza",
    "agenda": null,
    "observacao": "urgente"
  }
]`;
}
