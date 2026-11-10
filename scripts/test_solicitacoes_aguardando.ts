import {
  derivarEstadoSolicitacao,
  rotuloAguardandoDe,
  diasAguardando,
  alertaAguardando,
  validarAguardando,
  montarPayloadAguardando,
  montarPayloadVoltarPendente,
  montarPayloadResolver,
  montarPayloadReabrir,
  ordenarSolicitacoes,
  SolicitacaoAgendamento,
  AguardandoDe
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

function mockItem(parciais: Partial<SolicitacaoAgendamento>): SolicitacaoAgendamento {
  return {
    id: parciais.id || 'id-mock',
    paciente: parciais.paciente || 'Paciente Mock',
    turma_id: parciais.turma_id || null,
    observacao: parciais.observacao || null,
    resolvido: parciais.resolvido ?? false,
    resolvido_em: parciais.resolvido_em || null,
    aguardando_em: parciais.aguardando_em || null,
    aguardando_de: parciais.aguardando_de || null,
    aguardando_obs: parciais.aguardando_obs || null,
    criado_por: parciais.criado_por || null,
    created_at: parciais.created_at || '2026-11-09T10:00:00.000Z',
    updated_at: parciais.updated_at || '2026-11-09T10:00:00.000Z',
    ...parciais
  };
}

// ------------------------------------------------------------------------------
// 1. TESTES DE derivarEstadoSolicitacao
// ------------------------------------------------------------------------------
it('derivarEstadoSolicitacao: identifica estado pendente quando nao resolvido e sem aguardando_em', () => {
  const item = mockItem({ resolvido: false, aguardando_em: null });
  expectEqual(derivarEstadoSolicitacao(item), 'pendente');
});

it('derivarEstadoSolicitacao: identifica estado aguardando quando nao resolvido e com aguardando_em preenchido', () => {
  const item = mockItem({
    resolvido: false,
    aguardando_em: '2026-11-10T12:00:00.000Z',
    aguardando_de: 'paciente'
  });
  expectEqual(derivarEstadoSolicitacao(item), 'aguardando');
});

it('derivarEstadoSolicitacao: identifica estado resolvido quando resolvido = true', () => {
  const item = mockItem({
    resolvido: true,
    resolvido_em: '2026-11-10T14:00:00.000Z',
    aguardando_em: null
  });
  expectEqual(derivarEstadoSolicitacao(item), 'resolvido');
});

it('derivarEstadoSolicitacao: prioridade de resolvido vence mesmo quando aguardando_em esta preenchido (historico)', () => {
  const item = mockItem({
    resolvido: true,
    resolvido_em: '2026-11-10T14:00:00.000Z',
    aguardando_em: '2026-11-08T10:00:00.000Z',
    aguardando_de: 'recepcao',
    aguardando_obs: 'historico de proposta'
  });
  expectEqual(derivarEstadoSolicitacao(item), 'resolvido');
});

// ------------------------------------------------------------------------------
// 2. TESTES DE validarAguardando
// ------------------------------------------------------------------------------
it('validarAguardando: rejeita entidade fora da lista permitida', () => {
  const res = validarAguardando('outro', 'Solucao');
  expectFalse(res.valido, 'Entidade invalida deve ser rejeitada');
  expectEqual(res.de, null);
  expectTrue(res.erro !== null && res.erro.length > 0);
});

it('validarAguardando: rejeita observacao com 501 caracteres', () => {
  const obs501 = 'a'.repeat(501);
  const res = validarAguardando('paciente', obs501);
  expectFalse(res.valido, 'Obs com 501 chars deve ser rejeitada');
  expectTrue(res.erro !== null && res.erro.includes('500'));
});

it('validarAguardando: converte observacao somente com espacos para null', () => {
  const res = validarAguardando('dentista', '     \t  ');
  expectTrue(res.valido, 'Obs em branco deve ser valida');
  expectEqual(res.obs, null);
  expectEqual(res.de, 'dentista');
});

it('validarAguardando: aceita observacao valida e apara espacos nas pontas', () => {
  const res = validarAguardando('recepcao', '   Horario oferecido na quinta   ');
  expectTrue(res.valido, 'Obs valida deve passar');
  expectEqual(res.obs, 'Horario oferecido na quinta');
  expectEqual(res.de, 'recepcao');
});

// ------------------------------------------------------------------------------
// 3. TESTES DE montarPayloadAguardando
// ------------------------------------------------------------------------------
it('montarPayloadAguardando: monta payload correto com timestamp e dados aparados', () => {
  const dataRef = new Date(2026, 10, 10, 14, 30, 0);
  const payload = montarPayloadAguardando('paciente', '  Proposta de encaixe  ', dataRef);
  expectEqual(payload.aguardando_em, dataRef.toISOString());
  expectEqual(payload.aguardando_de, 'paciente');
  expectEqual(payload.aguardando_obs, 'Proposta de encaixe');
});

it('montarPayloadAguardando: lanca excecao caso a validacao falhe', () => {
  let capturou = false;
  try {
    montarPayloadAguardando('invalido', 'teste');
  } catch {
    capturou = true;
  }
  expectTrue(capturou, 'Deve lancar erro se entidade for invalida');
});

// ------------------------------------------------------------------------------
// 4. TESTES DE montarPayloadVoltarPendente
// ------------------------------------------------------------------------------
it('montarPayloadVoltarPendente: zera os tres campos de aguardando', () => {
  const payload = montarPayloadVoltarPendente();
  expectEqual(payload.aguardando_em, null);
  expectEqual(payload.aguardando_de, null);
  expectEqual(payload.aguardando_obs, null);
});

// ------------------------------------------------------------------------------
// 5. TESTES DE montarPayloadReabrir
// ------------------------------------------------------------------------------
it('montarPayloadReabrir: limpa resolvido, resolvido_em e os tres campos aguardando', () => {
  const dataRef = new Date(2026, 10, 10, 16, 0, 0);
  const payload = montarPayloadReabrir(dataRef);
  expectEqual(payload.resolvido, false);
  expectEqual(payload.resolvido_em, null);
  expectEqual(payload.aguardando_em, null);
  expectEqual(payload.aguardando_de, null);
  expectEqual(payload.aguardando_obs, null);
  expectEqual(payload.updated_at, dataRef.toISOString());
});

// ------------------------------------------------------------------------------
// 6. TESTES DE diasAguardando e alertaAguardando
// ------------------------------------------------------------------------------
it('diasAguardando e alertaAguardando: 0 dias (hoje)', () => {
  const hoje = new Date(2026, 10, 10, 18, 0);
  const entradaHoje = new Date(2026, 10, 10, 9, 0).toISOString();
  const item = { aguardando_em: entradaHoje };

  expectEqual(diasAguardando(item, hoje), 0);
  expectFalse(alertaAguardando(item, hoje));
});

it('diasAguardando e alertaAguardando: 2 dias (abaixo do limite de alerta)', () => {
  const hoje = new Date(2026, 10, 10, 14, 0);
  const entrada2Dias = new Date(2026, 10, 8, 10, 0).toISOString();
  const item = { aguardando_em: entrada2Dias };

  expectEqual(diasAguardando(item, hoje), 2);
  expectFalse(alertaAguardando(item, hoje));
});

it('diasAguardando e alertaAguardando: 3 dias (limite de alerta atingido)', () => {
  const hoje = new Date(2026, 10, 10, 14, 0);
  const entrada3Dias = new Date(2026, 10, 7, 10, 0).toISOString();
  const item = { aguardando_em: entrada3Dias };

  expectEqual(diasAguardando(item, hoje), 3);
  expectTrue(alertaAguardando(item, hoje));
});

it('diasAguardando e alertaAguardando: 10 dias (com alerta)', () => {
  const hoje = new Date(2026, 10, 10, 14, 0);
  const entrada10Dias = new Date(2026, 9, 31, 10, 0).toISOString();
  const item = { aguardando_em: entrada10Dias };

  expectEqual(diasAguardando(item, hoje), 10);
  expectTrue(alertaAguardando(item, hoje));
});

it('diasAguardando e alertaAguardando: virada de mes (31 de outubro para 3 de novembro = 3 dias)', () => {
  const hoje = new Date(2026, 10, 3, 10, 0); // 03/11/2026
  const entradaOutubro = new Date(2026, 9, 31, 14, 0).toISOString(); // 31/10/2026
  const item = { aguardando_em: entradaOutubro };

  expectEqual(diasAguardando(item, hoje), 3);
  expectTrue(alertaAguardando(item, hoje));
});

// ------------------------------------------------------------------------------
// 7. TESTES DE rotuloAguardandoDe
// ------------------------------------------------------------------------------
it('rotuloAguardandoDe: formata acentos corretamente para cada entidade', () => {
  expectEqual(rotuloAguardandoDe('recepcao'), 'Recepção');
  expectEqual(rotuloAguardandoDe('paciente'), 'Paciente');
  expectEqual(rotuloAguardandoDe('dentista'), 'Dentista');
  expectEqual(rotuloAguardandoDe(null), '');
});

// ------------------------------------------------------------------------------
// 8. TESTES DE ordenacao em "Em aberto" e "Todos"
// ------------------------------------------------------------------------------
it('ordenarSolicitacoes: visao "aberto" ordena pendentes primeiro (mais antigas), depois aguardando (alerta primeiro, depois mais antigas)', () => {
  const agora = new Date(2026, 10, 10, 12, 0);

  // Pendentes
  const pAntigo = mockItem({
    id: 'p1',
    created_at: new Date(2026, 10, 1, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: null
  });
  const pRecente = mockItem({
    id: 'p2',
    created_at: new Date(2026, 10, 5, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: null
  });

  // Aguardando
  const aAlerta = mockItem({
    id: 'a_alerta',
    created_at: new Date(2026, 10, 2, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: new Date(2026, 10, 5, 10, 0).toISOString() // 5 dias atras -> tem alerta
  });
  const aSemAlertaAntigo = mockItem({
    id: 'a_antigo',
    created_at: new Date(2026, 10, 3, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: new Date(2026, 10, 8, 10, 0).toISOString() // 2 dias atras
  });
  const aSemAlertaRecente = mockItem({
    id: 'a_recente',
    created_at: new Date(2026, 10, 4, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: new Date(2026, 10, 9, 10, 0).toISOString() // 1 dia atras
  });

  const desordenado = [aSemAlertaRecente, pRecente, aAlerta, pAntigo, aSemAlertaAntigo];
  const ordenado = ordenarSolicitacoes(desordenado, 'aberto');

  // Ordem esperada:
  // 1. pendentes: p1 (01/11), p2 (05/11)
  // 2. aguardando: a_alerta (tem alerta), depois a_antigo (08/11), depois a_recente (09/11)
  expectEqual(ordenado.map(x => x.id).join(','), 'p1,p2,a_alerta,a_antigo,a_recente');
});

it('ordenarSolicitacoes: visao "todos" coloca pendentes primeiro, aguardando depois e resolvidos no final', () => {
  const p = mockItem({
    id: 'p',
    created_at: new Date(2026, 10, 2, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: null
  });
  const a = mockItem({
    id: 'a',
    created_at: new Date(2026, 10, 3, 10, 0).toISOString(),
    resolvido: false,
    aguardando_em: new Date(2026, 10, 8, 10, 0).toISOString()
  });
  const rAntigo = mockItem({
    id: 'r_antigo',
    resolvido: true,
    resolvido_em: new Date(2026, 10, 7, 10, 0).toISOString()
  });
  const rRecente = mockItem({
    id: 'r_recente',
    resolvido: true,
    resolvido_em: new Date(2026, 10, 10, 10, 0).toISOString()
  });

  const desordenado = [rAntigo, a, rRecente, p];
  const ordenado = ordenarSolicitacoes(desordenado, 'todos');

  // Ordem esperada: p (pendente), a (aguardando), r_recente (resolvido mais recente), r_antigo (resolvido mais antigo)
  expectEqual(ordenado.map(x => x.id).join(','), 'p,a,r_recente,r_antigo');
});

// ------------------------------------------------------------------------------
// EXECUCAO DO RUNNER
// ------------------------------------------------------------------------------
console.log('================================================================');
console.log('EXECUTANDO TESTES: SOLICITACOES AGUARDANDO CONFIRMACAO');
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
