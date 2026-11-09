/**
 * Funcoes Puras e Helpers de Persistencia para Limite de Sessao de 24 Horas
 */

export const LIMITE_SESSAO_HORAS = 24;
export const LIMITE_SESSAO_MS = LIMITE_SESSAO_HORAS * 60 * 60 * 1000; // 86.400.000 ms
export const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000; // 5 minutos de tolerancia para desvios de relogio

export const CHAVE_STORAGE_SESSAO_INICIO = 'ortounifase.sessao.inicio';
export const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou (limite de 24 horas). Entre novamente.';

/**
 * Avalia se o inicio informado e valido:
 * - Deve ser um numero finito e positivo.
 * - Nao pode estar no futuro alem de 5 minutos (tolerancia para pequenos desvios de relogio local).
 */
export function inicioValido(
  inicioMs: number | null | undefined,
  agoraMs: number = Date.now()
): boolean {
  if (
    inicioMs === null ||
    inicioMs === undefined ||
    typeof inicioMs !== 'number' ||
    isNaN(inicioMs) ||
    !isFinite(inicioMs) ||
    inicioMs <= 0
  ) {
    return false;
  }

  if (inicioMs > agoraMs + TOLERANCIA_FUTURO_MS) {
    return false;
  }

  return true;
}

/**
 * Determina se a sessao expirou pelo tempo decorrido desde o login.
 *
 * Assinatura:
 * @param inicioMs Milissegundos de epoca em que a sessao foi iniciada.
 * @param agoraMs Milissegundos de epoca atuais (Date.now()).
 * @param limiteMs Limite maximo permitido em milissegundos (padrao: 24h = 86.400.000 ms).
 * @returns true se agoraMs - inicioMs >= limiteMs.
 *
 * Tratamento de anomalias:
 * - Se inicioMs for nulo, indefinido, NaN ou estiver no futuro alem de 5 minutos,
 *   a funcao retorna false (NAO derruba o usuario).
 *   O chamador deve redefinir o inicio para o instante atual chamando salvarInicioSessao().
 */
export function sessaoExpirada(
  inicioMs: number | null | undefined,
  agoraMs: number,
  limiteMs: number = LIMITE_SESSAO_MS
): boolean {
  if (!inicioValido(inicioMs, agoraMs)) {
    return false;
  }

  return agoraMs - (inicioMs as number) >= limiteMs;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Le o timestamp de inicio da sessao salvo no localStorage.
 * Sempre executado em try/catch para seguranca contra restricoes de navegadores.
 */
export function obterInicioSessao(): number | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const valor = storage.getItem(CHAVE_STORAGE_SESSAO_INICIO);
    if (!valor) return null;
    const parsed = parseInt(valor, 10);
    return isNaN(parsed) ? null : parsed;
  } catch (err) {
    console.warn('Nao foi possivel ler ortounifase.sessao.inicio do localStorage:', err);
    return null;
  }
}

/**
 * Salva o timestamp de inicio da sessao no localStorage.
 */
export function salvarInicioSessao(inicioMs: number = Date.now()): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(CHAVE_STORAGE_SESSAO_INICIO, inicioMs.toString());
  } catch (err) {
    console.warn('Nao foi possivel gravar ortounifase.sessao.inicio no localStorage:', err);
  }
}

/**
 * Grava o inicio da sessao SOMENTE se ainda nao houver inicio gravado.
 * Impede que eventos SIGNED_IN recorrentes reiniciem o relogio de 24h.
 */
export function salvarInicioSessaoSeNaoExistir(agoraMs: number = Date.now()): void {
  const existente = obterInicioSessao();
  if (existente === null || !inicioValido(existente, agoraMs)) {
    salvarInicioSessao(agoraMs);
  }
}

/**
 * Remove a chave de inicio da sessao do localStorage.
 */
export function limparInicioSessao(): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(CHAVE_STORAGE_SESSAO_INICIO);
  } catch (err) {
    console.warn('Nao foi possivel remover ortounifase.sessao.inicio do localStorage:', err);
  }
}
