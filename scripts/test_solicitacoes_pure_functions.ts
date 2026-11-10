import {
  normalizarNomePaciente,
  calcularDiasDecorridos,
  formatarDiasDecorridos,
  detectarDuplicidade,
  extrairPartesDataLocal,
  ordenarSolicitacoes,
  formatarEsperaResolvida,
  escaparTermoLike,
  SolicitacaoAgendamento
} from '../src/lib/solicitacoesTypes';

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

// ------------------------------------------------------------------------------
// 1. TESTES DE normalizarNomePaciente
// ------------------------------------------------------------------------------
it('normalizarNomePaciente: converte para minusculas e remove acentos', () => {
  expectEqual(normalizarNomePaciente('José Lúcio da Silva'), 'jose lucio da silva');
  expectEqual(normalizarNomePaciente('JOÃO VÍTOR ÇALLES'), 'joao vitor calles');
  expectEqual(normalizarNomePaciente('Ângela Mércia Priscíla'), 'angela mercia priscila');
});

it('normalizarNomePaciente: colapsa espacos multiplos e faz trim', () => {
  expectEqual(normalizarNomePaciente('   Carlos    Eduardo   '), 'carlos eduardo');
  expectEqual(normalizarNomePaciente('\tMariana \n Souza  '), 'mariana souza');
});

it('normalizarNomePaciente: trata nulo, indefinido e vazio', () => {
  expectEqual(normalizarNomePaciente(null), '');
  expectEqual(normalizarNomePaciente(undefined), '');
  expectEqual(normalizarNomePaciente(''), '');
  expectEqual(normalizarNomePaciente('    '), '');
});

// ------------------------------------------------------------------------------
// 2. TESTES DE detectarDuplicidade
// ------------------------------------------------------------------------------
it('detectarDuplicidade: detecta nome duplicado com variacao de acento e caixa', () => {
  const pendentes = [
    { paciente: 'Carlos Eduardo Silva' },
    { paciente: 'Ana Paula Costa' }
  ];

  expectTrue(detectarDuplicidade('carlos eduardo silva', pendentes));
  expectTrue(detectarDuplicidade('CARLOS EDUARDO SILVA', pendentes));
  expectTrue(detectarDuplicidade('  cárlos   eduárdo silva  ', pendentes));
});

it('detectarDuplicidade: nao acusa falso positivo para nomes distintos ou lista vazia', () => {
  const pendentes = [
    { paciente: 'Carlos Eduardo Silva' },
    { paciente: 'Ana Paula Costa' }
  ];

  expectFalse(detectarDuplicidade('Carlos Eduardo', pendentes));
  expectFalse(detectarDuplicidade('Paula Costa', pendentes));
  expectFalse(detectarDuplicidade('Outro Paciente', pendentes));
  expectFalse(detectarDuplicidade('Qualquer', []));
  expectFalse(detectarDuplicidade('', pendentes));
});

// ------------------------------------------------------------------------------
// 3. TESTES DE calcularDiasDecorridos e formatarDiasDecorridos
// ------------------------------------------------------------------------------
it('calcularDiasDecorridos: hoje (mesmo dia do calendario local)', () => {
  const entrada = new Date(2026, 10, 9, 8, 30); // 09/11/2026 08:30 local
  const agora = new Date(2026, 10, 9, 18, 45);   // 09/11/2026 18:45 local

  const dias = calcularDiasDecorridos(entrada, agora);
  expectEqual(dias, 0, 'Diferenca de dias de calendario hoje');
  expectEqual(formatarDiasDecorridos(dias), 'Hoje');
});

it('calcularDiasDecorridos: ontem (1 dia do calendario local)', () => {
  const entrada = new Date(2026, 10, 8, 23, 50); // 08/11/2026 23:50 local
  const agora = new Date(2026, 10, 9, 6, 10);    // 09/11/2026 06:10 local

  const dias = calcularDiasDecorridos(entrada, agora);
  expectEqual(dias, 1, 'Diferenca de 1 dia de calendario');
  expectEqual(formatarDiasDecorridos(dias), 'Ontem');
});

it('calcularDiasDecorridos: 30 dias atras', () => {
  const entrada = new Date(2026, 9, 10, 10, 0); // 10/10/2026
  const agora = new Date(2026, 10, 9, 10, 0);   // 09/11/2026 (outubro tem 31 dias: 21 dias out + 9 dias nov = 30)

  const dias = calcularDiasDecorridos(entrada, agora);
  expectEqual(dias, 30, 'Diferenca de 30 dias de calendario');
  expectEqual(formatarDiasDecorridos(dias), 'Há 30 dias');
});

it('calcularDiasDecorridos: virada de mes (28 de fev para 01 de mar em ano nao bissexto)', () => {
  const entrada = new Date(2025, 1, 28, 22, 0); // 28/02/2025
  const agora = new Date(2025, 2, 1, 8, 0);      // 01/03/2025

  const dias = calcularDiasDecorridos(entrada, agora);
  expectEqual(dias, 1, 'Virada de mes 28/02 -> 01/03');
  expectEqual(formatarDiasDecorridos(dias), 'Ontem');
});

it('calcularDiasDecorridos: virada de ano (31 de dez para 01 de jan)', () => {
  const entrada = new Date(2025, 11, 31, 23, 30); // 31/12/2025
  const agora = new Date(2026, 0, 1, 10, 0);       // 01/01/2026

  const dias = calcularDiasDecorridos(entrada, agora);
  expectEqual(dias, 1, 'Virada de ano 31/12 -> 01/01');
  expectEqual(formatarDiasDecorridos(dias), 'Ontem');
});

it('calcularDiasDecorridos: aceita string timestamptz ISO', () => {
  // Simula string timestamptz vinda do banco
  const entradaIso = '2026-11-09T03:00:00.000Z';
  const agoraRef = new Date(entradaIso);
  expectEqual(calcularDiasDecorridos(entradaIso, agoraRef), 0);
});

// ------------------------------------------------------------------------------
// 4. TESTES DE formatarEsperaResolvida
// ------------------------------------------------------------------------------
it('formatarEsperaResolvida: mesmo dia vira "Resolvido no mesmo dia"', () => {
  const criacao = '2026-11-09T08:00:00.000Z';
  const resolucao = '2026-11-09T17:30:00.000Z';
  expectEqual(formatarEsperaResolvida(criacao, resolucao), 'Resolvido no mesmo dia');
});

it('formatarEsperaResolvida: 1 dia vira "Esperou 1 dia"', () => {
  const criacao = '2026-11-08T10:00:00.000Z';
  const resolucao = '2026-11-09T14:00:00.000Z';
  expectEqual(formatarEsperaResolvida(criacao, resolucao), 'Esperou 1 dia');
});

it('formatarEsperaResolvida: multiplos dias vira "Esperou X dias"', () => {
  const criacao = '2026-10-10T10:00:00.000Z';
  const resolucao = '2026-11-09T10:00:00.000Z';
  expectEqual(formatarEsperaResolvida(criacao, resolucao), 'Esperou 30 dias');
});

it('formatarEsperaResolvida: quando resolvido_em e nulo ou indefinido, usa data atual como referencia', () => {
  const hojeIso = new Date().toISOString();
  expectEqual(formatarEsperaResolvida(hojeIso, null), 'Resolvido no mesmo dia');
  expectEqual(formatarEsperaResolvida(hojeIso, undefined), 'Resolvido no mesmo dia');
});

// ------------------------------------------------------------------------------
// 5. TESTES DE escaparTermoLike
// ------------------------------------------------------------------------------
it('escaparTermoLike: mantem texto alfanumerico comum inalterado', () => {
  expectEqual(escaparTermoLike('Carlos Eduardo'), 'Carlos Eduardo');
  expectEqual(escaparTermoLike('12345'), '12345');
});

it('escaparTermoLike: escapa porcentagem, sublinhado e barra invertida', () => {
  expectEqual(escaparTermoLike('100%'), '100\\%');
  expectEqual(escaparTermoLike('paciente_teste'), 'paciente\\_teste');
  expectEqual(escaparTermoLike('caminho\\pasta'), 'caminho\\\\pasta');
  expectEqual(escaparTermoLike('50%_teste\\exemplo'), '50\\%\\_teste\\\\exemplo');
});

it('escaparTermoLike: lida com nulo, indefinido e vazio', () => {
  expectEqual(escaparTermoLike(''), '');
  expectEqual(escaparTermoLike(null), '');
  expectEqual(escaparTermoLike(undefined), '');
});

// ------------------------------------------------------------------------------
// 6. TESTES DE ordenarSolicitacoes
// ------------------------------------------------------------------------------
function mockItem(parciais: Partial<SolicitacaoAgendamento>): SolicitacaoAgendamento {
  return {
    id: parciais.id || 'id-mock',
    paciente: parciais.paciente || 'Paciente Mock',
    turma_id: parciais.turma_id || null,
    observacao: parciais.observacao || null,
    resolvido: parciais.resolvido ?? false,
    resolvido_em: parciais.resolvido_em || null,
    criado_por: parciais.criado_por || null,
    created_at: parciais.created_at || '2026-11-09T10:00:00.000Z',
    updated_at: parciais.updated_at || '2026-11-09T10:00:00.000Z',
    ...parciais
  };
}

it('ordenarSolicitacoes: situacao "pendentes" ordena por created_at crescente (mais antigas no topo)', () => {
  const p1 = mockItem({ id: '1', paciente: 'Mais Antigo', created_at: '2026-11-01T10:00:00.000Z', resolvido: false });
  const p2 = mockItem({ id: '2', paciente: 'Mais Recente', created_at: '2026-11-08T10:00:00.000Z', resolvido: false });
  const p3 = mockItem({ id: '3', paciente: 'Intermediario', created_at: '2026-11-05T10:00:00.000Z', resolvido: false });

  const ordenado = ordenarSolicitacoes([p2, p1, p3], 'pendentes');
  expectEqual(ordenado.map(x => x.id).join(','), '1,3,2');
});

it('ordenarSolicitacoes: situacao "resolvidos" ordena por resolvido_em decrescente (mais recentes no topo)', () => {
  const r1 = mockItem({ id: '1', paciente: 'Resolvido Antigo', resolvido: true, resolvido_em: '2026-11-02T10:00:00.000Z' });
  const r2 = mockItem({ id: '2', paciente: 'Resolvido Hoje', resolvido: true, resolvido_em: '2026-11-09T10:00:00.000Z' });
  const r3 = mockItem({ id: '3', paciente: 'Resolvido Ontem', resolvido: true, resolvido_em: '2026-11-08T10:00:00.000Z' });

  const ordenado = ordenarSolicitacoes([r1, r2, r3], 'resolvidos');
  expectEqual(ordenado.map(x => x.id).join(','), '2,3,1');
});

it('ordenarSolicitacoes: situacao "resolvidos" usa updated_at se resolvido_em for nulo', () => {
  const r1 = mockItem({ id: '1', resolvido: true, resolvido_em: null, updated_at: '2026-11-01T10:00:00.000Z' });
  const r2 = mockItem({ id: '2', resolvido: true, resolvido_em: null, updated_at: '2026-11-09T10:00:00.000Z' });

  const ordenado = ordenarSolicitacoes([r1, r2], 'resolvidos');
  expectEqual(ordenado.map(x => x.id).join(','), '2,1');
});

it('ordenarSolicitacoes: situacao "todos" coloca pendentes primeiro e resolvidos depois', () => {
  const p1 = mockItem({ id: 'p1', resolvido: false, created_at: '2026-11-02T10:00:00.000Z' });
  const p2 = mockItem({ id: 'p2', resolvido: false, created_at: '2026-11-06T10:00:00.000Z' });
  const r1 = mockItem({ id: 'r1', resolvido: true, resolvido_em: '2026-11-08T10:00:00.000Z' });
  const r2 = mockItem({ id: 'r2', resolvido: true, resolvido_em: '2026-11-09T10:00:00.000Z' });

  const ordenado = ordenarSolicitacoes([r1, p2, r2, p1], 'todos');
  expectEqual(ordenado.map(x => x.id).join(','), 'p1,p2,r2,r1');
});

it('ordenarSolicitacoes: nao muta o array original recebido', () => {
  const p1 = mockItem({ id: '1', created_at: '2026-11-05T10:00:00.000Z', resolvido: false });
  const p2 = mockItem({ id: '2', created_at: '2026-11-01T10:00:00.000Z', resolvido: false });
  const listaOriginal = [p1, p2];

  ordenarSolicitacoes(listaOriginal, 'pendentes');
  expectEqual(listaOriginal[0].id, '1');
  expectEqual(listaOriginal[1].id, '2');
});

// ------------------------------------------------------------------------------
// EXECUCAO DO RUNNER
// ------------------------------------------------------------------------------
console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: SOLICITACOES DE AGENDAMENTO');
console.log(`Fuso do ambiente atual: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log('================================================================\n');

for (const t of testes) {
  try {
    t.fn();
    console.log(`  [PASS] ${t.nome}`);
    passCount++;
  } catch (err: any) {
    console.error(`  [FAIL] ${t.nome}: ${err.message}`);
    failCount++;
  }
}

console.log('\n================================================================');
console.log(`RESULTADO: ${passCount} passaram, ${failCount} falharam (Total: ${testes.length})`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
