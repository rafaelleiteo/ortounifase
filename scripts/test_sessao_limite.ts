import {
  LIMITE_SESSAO_MS,
  LIMITE_SESSAO_HORAS,
  TOLERANCIA_FUTURO_MS,
  CHAVE_STORAGE_SESSAO_INICIO,
  inicioValido,
  sessaoExpirada,
  obterInicioSessao,
  salvarInicioSessao,
  salvarInicioSessaoSeNaoExistir,
  limparInicioSessao,
  obterSupabaseStorageKey,
  limparChavesSessaoSupabase,
} from '../src/lib/sessaoLimite';

interface TestCase {
  nome: string;
  fn: () => void;
}

const testes: TestCase[] = [];
let passCount = 0;
let failCount = 0;

function it(nome: string, fn: () => void) {
  testes.push({ nome, fn });
}

function expectEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ': ' : ''}Esperado "${expected}", obtido "${actual}"`
    );
  }
}

function expectTrue(actual: boolean, message?: string) {
  if (actual !== true) {
    throw new Error(`${message ? message + ': ' : ''}Esperado true, obtido false`);
  }
}

function expectFalse(actual: boolean, message?: string) {
  if (actual !== false) {
    throw new Error(`${message ? message + ': ' : ''}Esperado false, obtido true`);
  }
}

// Memory Storage Mock for Testing Persistence
class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// Setup mock storage on globalThis
const mockStorage = new MemoryStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;

// Base timestamp for stable testing: 2026-11-09T14:00:00.000Z
const AGORA = 1794232800000;
const UMA_HORA_MS = 60 * 60 * 1000;
const UM_MINUTO_MS = 60 * 1000;

// ------------------------------------------------------------------------------
// TESTES DE sessaoExpirada e inicioValido (derivados de LIMITE_SESSAO_HORAS)
// ------------------------------------------------------------------------------

it(`1) Sessao com limite menos 1 minuto (${LIMITE_SESSAO_HORAS}h - 1min) nao expira`, () => {
  const inicio = AGORA - (LIMITE_SESSAO_MS - UM_MINUTO_MS);
  expectFalse(sessaoExpirada(inicio, AGORA));
});

it(`2) Sessao com exatamente o limite (${LIMITE_SESSAO_HORAS}h) expira`, () => {
  const inicio = AGORA - LIMITE_SESSAO_MS;
  expectTrue(sessaoExpirada(inicio, AGORA));
});

it(`3) Sessao com limite mais 1 hora (${LIMITE_SESSAO_HORAS + 1}h) expira`, () => {
  const inicio = AGORA - (LIMITE_SESSAO_MS + UMA_HORA_MS);
  expectTrue(sessaoExpirada(inicio, AGORA));
});

it('4) inicioMs nulo, indefinido, NaN ou <= 0 nao expira', () => {
  expectFalse(sessaoExpirada(null, AGORA));
  expectFalse(sessaoExpirada(undefined, AGORA));
  expectFalse(sessaoExpirada(NaN, AGORA));
  expectFalse(sessaoExpirada(0, AGORA));
  expectFalse(sessaoExpirada(-1000, AGORA));
  expectFalse(inicioValido(null, AGORA));
  expectFalse(inicioValido(undefined, AGORA));
  expectFalse(inicioValido(NaN, AGORA));
  expectFalse(inicioValido(0, AGORA));
  expectFalse(inicioValido(-500, AGORA));
});

it('5) inicioMs no futuro dentro da tolerancia de 5 min nao expira', () => {
  const futuroPermitido = AGORA + 3 * UM_MINUTO_MS;
  expectTrue(inicioValido(futuroPermitido, AGORA));
  expectFalse(sessaoExpirada(futuroPermitido, AGORA));
});

it('6) inicioMs no futuro alem da tolerancia de 5 min e tratado como anomalia e nao expira', () => {
  const futuroExcessivo = AGORA + 10 * UM_MINUTO_MS;
  expectFalse(inicioValido(futuroExcessivo, AGORA));
  expectFalse(sessaoExpirada(futuroExcessivo, AGORA));
});

it('7) Limite customizado (ex: 1 hora) respeita o parametro limiteMs', () => {
  const inicio30min = AGORA - 30 * UM_MINUTO_MS;
  const inicio75min = AGORA - 75 * UM_MINUTO_MS;
  expectFalse(sessaoExpirada(inicio30min, AGORA, UMA_HORA_MS));
  expectTrue(sessaoExpirada(inicio75min, AGORA, UMA_HORA_MS));
});

// ------------------------------------------------------------------------------
// TESTES DE PERSISTENCIA (salvarInicioSessaoSeNaoExistir, obter, limpar)
// ------------------------------------------------------------------------------

it('8) salvarInicioSessaoSeNaoExistir nao sobrescreve valor existente valido', () => {
  mockStorage.clear();
  const inicioOriginal = AGORA - 2 * UMA_HORA_MS;
  salvarInicioSessao(inicioOriginal);

  expectEqual(obterInicioSessao(), inicioOriginal);

  // Tenta salvar com momento posterior
  salvarInicioSessaoSeNaoExistir(AGORA);

  // Deve manter o original inalterado
  expectEqual(obterInicioSessao(), inicioOriginal);
});

it('9) salvarInicioSessaoSeNaoExistir grava se o valor existente for nulo ou invalido', () => {
  // Caso 1: Nulo
  mockStorage.clear();
  expectEqual(obterInicioSessao(), null);
  salvarInicioSessaoSeNaoExistir(AGORA);
  expectEqual(obterInicioSessao(), AGORA);

  // Caso 2: Invalido (NaN ou lixo textual)
  mockStorage.setItem(CHAVE_STORAGE_SESSAO_INICIO, 'invalido_nao_numerico');
  expectEqual(obterInicioSessao(), null);
  salvarInicioSessaoSeNaoExistir(AGORA + 1000);
  expectEqual(obterInicioSessao(), AGORA + 1000);

  // Caso 3: Invalido (futuro excessivo alem de 5 min)
  mockStorage.setItem(CHAVE_STORAGE_SESSAO_INICIO, String(AGORA + 60 * UM_MINUTO_MS));
  salvarInicioSessaoSeNaoExistir(AGORA);
  expectEqual(obterInicioSessao(), AGORA);

  // Caso 4: limparInicioSessao remove a chave
  limparInicioSessao();
  expectEqual(obterInicioSessao(), null);
});

// ------------------------------------------------------------------------------
// TESTES DE CHAVES DE SESSAO DO SUPABASE
// ------------------------------------------------------------------------------

it('10) obterSupabaseStorageKey extrai o ref e monta sb-<ref>-auth-token', () => {
  expectEqual(obterSupabaseStorageKey('https://abcdefghijklm.supabase.co'), 'sb-abcdefghijklm-auth-token');
  expectEqual(obterSupabaseStorageKey('https://xyz987.supabase.co/rest/v1'), 'sb-xyz987-auth-token');
  expectEqual(obterSupabaseStorageKey(''), null);
  expectEqual(obterSupabaseStorageKey(null), null);
  expectEqual(obterSupabaseStorageKey(undefined), null);
});

it('11) limparChavesSessaoSupabase remove somente storageKey e storageKey-code-verifier preservando as demais', () => {
  mockStorage.clear();
  const storageKey = 'sb-testref-auth-token';
  const verifierKey = `${storageKey}-code-verifier`;

  mockStorage.setItem(storageKey, '{"access_token":"token_teste"}');
  mockStorage.setItem(verifierKey, 'code_verifier_teste');
  mockStorage.setItem(CHAVE_STORAGE_SESSAO_INICIO, String(AGORA));
  mockStorage.setItem('app.tema', 'dark');

  limparChavesSessaoSupabase(mockStorage, storageKey);

  expectEqual(mockStorage.getItem(storageKey), null);
  expectEqual(mockStorage.getItem(verifierKey), null);
  expectEqual(mockStorage.getItem(CHAVE_STORAGE_SESSAO_INICIO), String(AGORA));
  expectEqual(mockStorage.getItem('app.tema'), 'dark');
});

// Execucao
console.log('=== EXECUTANDO TESTES DE LIMITE DE SESSAO ===\n');

for (const t of testes) {
  try {
    t.fn();
    console.log(`[PASS] ${t.nome}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${t.nome}: ${err.message}`);
    failCount++;
  }
}

console.log(`\nTotal: ${testes.length} | Passou: ${passCount} | Falhou: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('Todos os testes de limite de sessao passaram com sucesso!');
}
