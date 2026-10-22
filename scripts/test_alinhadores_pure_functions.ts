import {
  ANTECEDENCIA_PEDIDO_DIAS,
  parseDataLocal,
  formatarDataISO,
  formatarDataBR,
  calcularPrazoLimite,
  calcularStatusPedido,
  gerarMensagemEmpresa,
  PedidoParaMensagem
} from '../src/lib/alinhadoresTypes';

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

// ------------------------------------------------------------------------------
// 1. TESTES DE PARSE E FORMATAÇÃO DE DATAS LOCAIS
// ------------------------------------------------------------------------------
it('parseDataLocal deve montar a data usando ano, mês e dia locais (não UTC)', () => {
  const d = parseDataLocal('2026-10-22');
  expectEqual(d.getFullYear(), 2026, 'Ano local');
  expectEqual(d.getMonth(), 9, 'Mês local (0-indexado, 9 = Outubro)');
  expectEqual(d.getDate(), 22, 'Dia local');
  expectEqual(d.getHours(), 0, 'Horas locais');
});

it('formatarDataBR deve formatar string e Date em dd/mm/aaaa', () => {
  expectEqual(formatarDataBR('2026-05-10'), '10/05/2026');
  expectEqual(formatarDataBR(new Date(2026, 4, 10)), '10/05/2026');
  expectEqual(formatarDataBR('2026-12-01'), '01/12/2026');
});

// ------------------------------------------------------------------------------
// 2. TESTES DE CALCULO DE PRAZO LIMITE (ANTECEDENCIA_PEDIDO_DIAS = 20)
// ------------------------------------------------------------------------------
it('calcularPrazoLimite cruzando virada de mês (maio -> abril)', () => {
  // Retorno em 10/05/2026: 10 dias de maio + 10 dias de abril (abril tem 30 dias) -> 20/04/2026
  const prazo = calcularPrazoLimite('2026-05-10');
  expectEqual(formatarDataISO(prazo), '2026-04-20');
  expectEqual(formatarDataBR(prazo), '20/04/2026');
});

it('calcularPrazoLimite cruzando virada de mês (março -> fevereiro não bissexto)', () => {
  // 2026 não é bissexto (fevereiro tem 28 dias). Retorno em 05/03/2026:
  // 5 dias de março + 15 dias de fevereiro -> 28 - 15 = 13/02/2026
  const prazo = calcularPrazoLimite('2026-03-05');
  expectEqual(formatarDataISO(prazo), '2026-02-13');
  expectEqual(formatarDataBR(prazo), '13/02/2026');
});

it('calcularPrazoLimite cruzando virada de ano (janeiro -> dezembro)', () => {
  // Retorno em 10/01/2026: 10 dias de janeiro + 10 dias de dezembro de 2025 -> 21/12/2025
  const prazo = calcularPrazoLimite('2026-01-10');
  expectEqual(formatarDataISO(prazo), '2025-12-21');
  expectEqual(formatarDataBR(prazo), '21/12/2025');
});

it('calcularPrazoLimite com retorno em 29/02 de ano bissexto (2028)', () => {
  // 2028 é ano bissexto (fevereiro tem 29 dias). Retorno em 29/02/2028:
  // 29 - 20 = 09/02/2028
  const prazo = calcularPrazoLimite('2028-02-29');
  expectEqual(formatarDataISO(prazo), '2028-02-09');
  expectEqual(formatarDataBR(prazo), '09/02/2028');
});

it('calcularPrazoLimite com retorno em 29/02 de ano bissexto (2024)', () => {
  const prazo = calcularPrazoLimite('2024-02-29');
  expectEqual(formatarDataISO(prazo), '2024-02-09');
  expectEqual(formatarDataBR(prazo), '09/02/2024');
});

// ------------------------------------------------------------------------------
// 3. TESTES DE STATUS DO PEDIDO
// ------------------------------------------------------------------------------
it('calcularStatusPedido: deve retornar "solicitado" se solicitado_em existe', () => {
  const status = calcularStatusPedido(
    {
      data_retorno: '2026-05-10',
      solicitado_em: '2026-04-15T10:00:00Z'
    },
    '2026-05-01'
  );
  expectEqual(status, 'solicitado');
});

it('calcularStatusPedido: hoje IGUAL ao prazo limite (diff = 0) -> "vencendo"', () => {
  // Retorno em 10/05/2026 -> Prazo limite = 20/04/2026
  // Hoje = 20/04/2026 (faltam 0 dias para o prazo)
  const status = calcularStatusPedido(
    { data_retorno: '2026-05-10', solicitado_em: null },
    '2026-04-20'
  );
  expectEqual(status, 'vencendo');
});

it('calcularStatusPedido: hoje UM DIA DEPOIS do prazo limite -> "atrasado"', () => {
  // Retorno em 10/05/2026 -> Prazo limite = 20/04/2026
  // Hoje = 21/04/2026 (prazo expirou ontem)
  const status = calcularStatusPedido(
    { data_retorno: '2026-05-10', solicitado_em: null },
    '2026-04-21'
  );
  expectEqual(status, 'atrasado');
});

it('calcularStatusPedido: hoje 10 dias depois do prazo limite -> "atrasado"', () => {
  const status = calcularStatusPedido(
    { data_retorno: '2026-05-10', solicitado_em: null },
    '2026-04-30'
  );
  expectEqual(status, 'atrasado');
});

it('calcularStatusPedido: faltam de 1 a 5 dias para o prazo -> "vencendo"', () => {
  // Retorno em 10/05/2026 -> Prazo limite = 20/04/2026
  // Hoje = 19/04/2026 (falta 1 dia)
  expectEqual(
    calcularStatusPedido({ data_retorno: '2026-05-10', solicitado_em: null }, '2026-04-19'),
    'vencendo'
  );
  // Hoje = 15/04/2026 (faltam 5 dias)
  expectEqual(
    calcularStatusPedido({ data_retorno: '2026-05-10', solicitado_em: null }, '2026-04-15'),
    'vencendo'
  );
});

it('calcularStatusPedido: faltam 6 dias ou mais para o prazo -> "pendente"', () => {
  // Retorno em 10/05/2026 -> Prazo limite = 20/04/2026
  // Hoje = 14/04/2026 (faltam 6 dias)
  expectEqual(
    calcularStatusPedido({ data_retorno: '2026-05-10', solicitado_em: null }, '2026-04-14'),
    'pendente'
  );
  // Hoje = 01/04/2026 (faltam 19 dias)
  expectEqual(
    calcularStatusPedido({ data_retorno: '2026-05-10', solicitado_em: null }, '2026-04-01'),
    'pendente'
  );
});

// ------------------------------------------------------------------------------
// 4. TESTES DE GERAÇÃO DE MENSAGEM PARA A EMPRESA
// ------------------------------------------------------------------------------
it('gerarMensagemEmpresa com 1 paciente com numeração (intervalo de 3 a 4)', () => {
  const pedidos: PedidoParaMensagem[] = [
    {
      paciente_nome: 'Carlos Eduardo Silva',
      data_retorno: '2026-11-15',
      alinhador_de: 3,
      alinhador_ate: 4
    }
  ];

  const msg = gerarMensagemEmpresa(pedidos);
  const esperado = [
    'Prezados, solicitamos alinhadores para os pacientes abaixo:\n',
    '- Carlos Eduardo Silva: alinhadores 3 a 4, retorno previsto em 15/11/2026',
    '\nAgradecemos a confirmação do recebimento do pedido.'
  ].join('\n');

  expectEqual(msg, esperado);
});

it('gerarMensagemEmpresa com 1 paciente com um só alinhador (de = 3, ate = 3 ou nulo)', () => {
  const p1: PedidoParaMensagem[] = [
    {
      paciente_nome: 'Mariana Souza',
      data_retorno: '2026-11-20',
      alinhador_de: 3,
      alinhador_ate: 3
    }
  ];
  const msg1 = gerarMensagemEmpresa(p1);
  const esperado1 = [
    'Prezados, solicitamos alinhadores para os pacientes abaixo:\n',
    '- Mariana Souza: alinhador 3, retorno previsto em 20/11/2026',
    '\nAgradecemos a confirmação do recebimento do pedido.'
  ].join('\n');
  expectEqual(msg1, esperado1);

  const p2: PedidoParaMensagem[] = [
    {
      paciente_nome: 'Mariana Souza',
      data_retorno: '2026-11-20',
      alinhador_de: 5,
      alinhador_ate: null
    }
  ];
  const msg2 = gerarMensagemEmpresa(p2);
  const esperado2 = [
    'Prezados, solicitamos alinhadores para os pacientes abaixo:\n',
    '- Mariana Souza: alinhador 5, retorno previsto em 20/11/2026',
    '\nAgradecemos a confirmação do recebimento do pedido.'
  ].join('\n');
  expectEqual(msg2, esperado2);
});

it('gerarMensagemEmpresa com 1 paciente SEM numeração de alinhadores', () => {
  const pedidos: PedidoParaMensagem[] = [
    {
      paciente_nome: 'Fernanda Lima',
      data_retorno: '2026-11-25',
      alinhador_de: null,
      alinhador_ate: null
    }
  ];

  const msg = gerarMensagemEmpresa(pedidos);
  const esperado = [
    'Prezados, solicitamos alinhadores para os pacientes abaixo:\n',
    '- Fernanda Lima: retorno previsto em 25/11/2026',
    '\nAgradecemos a confirmação do recebimento do pedido.'
  ].join('\n');

  expectEqual(msg, esperado);
});

it('gerarMensagemEmpresa com 3 pacientes: ordenação ascendente por data de retorno e sem travessão', () => {
  // Passa fora de ordem cronológica para testar ordenação
  const pedidos: PedidoParaMensagem[] = [
    {
      paciente_nome: 'Paciente Tres',
      data_retorno: '2026-12-05',
      alinhador_de: null,
      alinhador_ate: null
    },
    {
      paciente_nome: 'Paciente Um',
      data_retorno: '2026-11-10',
      alinhador_de: 1,
      alinhador_ate: 2
    },
    {
      paciente_nome: 'Paciente Dois',
      data_retorno: '2026-11-20',
      alinhador_de: 7,
      alinhador_ate: 7
    }
  ];

  const msg = gerarMensagemEmpresa(pedidos);

  const esperado = [
    'Prezados, solicitamos alinhadores para os pacientes abaixo:\n',
    '- Paciente Um: alinhadores 1 a 2, retorno previsto em 10/11/2026',
    '- Paciente Dois: alinhador 7, retorno previsto em 20/11/2026',
    '- Paciente Tres: retorno previsto em 05/12/2026',
    '\nAgradecemos a confirmação do recebimento do pedido.'
  ].join('\n');

  expectEqual(msg, esperado);

  // Confirmação explícita de ausência de travessão
  expectEqual(msg.includes('—'), false, 'Não deve conter travessão em-dash');
  expectEqual(msg.includes('–'), false, 'Não deve conter travessão en-dash');
});

// ------------------------------------------------------------------------------
// EXECUÇÃO DO RUNNER
// ------------------------------------------------------------------------------
console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: FUNÇÕES PURAS DE ALINHADORES');
console.log(`ANTECEDENCIA_PEDIDO_DIAS = ${ANTECEDENCIA_PEDIDO_DIAS} dias`);
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
