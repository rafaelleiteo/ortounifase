import {
  LIMITE_CARACTERES_OBSERVACAO,
  normalizarObservacao,
  vincularObservacoesFixas,
  planejarReaplicacaoObservacoes,
  ObservacaoFixaPendente,
  ItemNaoReaplicado
} from '../src/lib/agendaObservacoes';
import { AgendaFixaItem, AgendaMensalItem } from '../src/lib/agendaTypes';

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

function expectDeepEqual<T>(actual: T, expected: T, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message ? message + ': ' : ''}Esperado ${expectedStr}, obtido ${actualStr}`
    );
  }
}

// ------------------------------------------------------------------------------
// 1. TESTES DE NORMALIZACAO DE OBSERVACAO
// ------------------------------------------------------------------------------
it('normalizarObservacao: string vazia ou undefined/null retorna null', () => {
  expectEqual(normalizarObservacao(''), null);
  expectEqual(normalizarObservacao(undefined), null);
  expectEqual(normalizarObservacao(null), null);
});

it('normalizarObservacao: string com apenas espacos retorna null', () => {
  expectEqual(normalizarObservacao('   '), null);
  expectEqual(normalizarObservacao('\t \n '), null);
});

it('normalizarObservacao: faz trim de espacos nas pontas', () => {
  expectEqual(normalizarObservacao('  Paciente prefere cadeira 1  '), 'Paciente prefere cadeira 1');
});

it('normalizarObservacao: trunca no limite maximo de 120 caracteres', () => {
  const longa = 'A'.repeat(150);
  const normalizada = normalizarObservacao(longa);
  expectEqual(normalizada?.length, LIMITE_CARACTERES_OBSERVACAO);
  expectEqual(normalizada, 'A'.repeat(120));
});

// ------------------------------------------------------------------------------
// 2. TESTES DE VINCULO DE OBSERVACOES FIXAS NA AGENDA MENSAL
// ------------------------------------------------------------------------------
it('vincularObservacoesFixas: vincula observacao fixa ao cartao mensal com mesmo nome e dia', () => {
  const fixa: AgendaFixaItem[] = [
    {
      id: 'fixa-1',
      turma_id: 't1',
      aluno_id: 'a1',
      paciente: 'Carlos Eduardo',
      horario: '08:00',
      dia_semana: 'QUINTA',
      observacao: 'Trazer tomografia'
    }
  ];

  const mensal: AgendaMensalItem[] = [
    {
      id: 'mensal-1',
      turma_id: 't1',
      mes_referencia: '2026-11-01',
      aluno_id: 'a1',
      paciente: 'Carlos Eduardo',
      horario: '08:00',
      dia_semana: 'QUINTA',
      tipo_registro: 'paciente'
    }
  ];

  const resultado = vincularObservacoesFixas({
    agendaFixa: fixa,
    agendaMensal: mensal,
    diaSelecionado: 'QUINTA'
  });

  expectEqual(resultado.mapaObservacoesPorMensalId.get('mensal-1'), 'Trazer tomografia');
  expectEqual(resultado.observacoesFixasSemCartao.length, 0);
});

it('vincularObservacoesFixas: tolera variacoes de maiusculas e acentos no nome', () => {
  const fixa: AgendaFixaItem[] = [
    {
      id: 'fixa-1',
      turma_id: 't1',
      aluno_id: 'a1',
      paciente: 'José Lúcio da Silva',
      horario: '08:00',
      dia_semana: 'QUINTA',
      observacao: 'Alérgico a látex'
    }
  ];

  const mensal: AgendaMensalItem[] = [
    {
      id: 'mensal-1',
      turma_id: 't1',
      mes_referencia: '2026-11-01',
      aluno_id: 'a1',
      paciente: 'jose lucio da silva',
      horario: '09:00',
      dia_semana: 'QUINTA',
      tipo_registro: 'paciente'
    }
  ];

  const resultado = vincularObservacoesFixas({
    agendaFixa: fixa,
    agendaMensal: mensal,
    diaSelecionado: 'QUINTA'
  });

  expectEqual(resultado.mapaObservacoesPorMensalId.get('mensal-1'), 'Alérgico a látex');
  expectEqual(resultado.observacoesFixasSemCartao.length, 0);
});

it('vincularObservacoesFixas: concatena com separador quando ha multiplas linhas fixas do mesmo paciente', () => {
  const fixa: AgendaFixaItem[] = [
    {
      id: 'fixa-1',
      turma_id: 't1',
      aluno_id: 'a1',
      paciente: 'Mariana Souza',
      horario: '08:00',
      dia_semana: 'QUINTA',
      observacao: 'Nota A'
    },
    {
      id: 'fixa-2',
      turma_id: 't1',
      aluno_id: 'a2',
      paciente: 'Mariana Souza',
      horario: '10:00',
      dia_semana: 'QUINTA',
      observacao: 'Nota B'
    }
  ];

  const mensal: AgendaMensalItem[] = [
    {
      id: 'mensal-1',
      turma_id: 't1',
      mes_referencia: '2026-11-01',
      aluno_id: 'a1',
      paciente: 'Mariana Souza',
      horario: '08:00',
      dia_semana: 'QUINTA',
      tipo_registro: 'paciente'
    }
  ];

  const resultado = vincularObservacoesFixas({
    agendaFixa: fixa,
    agendaMensal: mensal,
    diaSelecionado: 'QUINTA'
  });

  expectEqual(resultado.mapaObservacoesPorMensalId.get('mensal-1'), 'Nota A | Nota B');
  expectEqual(resultado.observacoesFixasSemCartao.length, 0);
});

it('vincularObservacoesFixas: paciente com observacao fixa sem cartao no mes cai na lista de pendentes', () => {
  const fixa: AgendaFixaItem[] = [
    {
      id: 'fixa-1',
      turma_id: 't1',
      aluno_id: 'a1',
      paciente: 'Pedro Alcantara',
      horario: '14:00',
      dia_semana: 'QUINTA',
      observacao: 'Paciente em viagem no inicio do mes'
    }
  ];

  const mensal: AgendaMensalItem[] = [
    {
      id: 'mensal-1',
      turma_id: 't1',
      mes_referencia: '2026-11-01',
      aluno_id: 'a1',
      paciente: 'Outro Paciente',
      horario: '14:00',
      dia_semana: 'QUINTA',
      tipo_registro: 'paciente'
    }
  ];

  const resultado = vincularObservacoesFixas({
    agendaFixa: fixa,
    agendaMensal: mensal,
    diaSelecionado: 'QUINTA'
  });

  expectEqual(resultado.mapaObservacoesPorMensalId.size, 0);
  expectEqual(resultado.observacoesFixasSemCartao.length, 1);
  expectEqual(resultado.observacoesFixasSemCartao[0].paciente, 'Pedro Alcantara');
  expectEqual(resultado.observacoesFixasSemCartao[0].observacao, 'Paciente em viagem no inicio do mes');
});

// ------------------------------------------------------------------------------
// 3. TESTES DE REAPLICACAO DE OBSERVACOES NA REIMPORTACAO
// ------------------------------------------------------------------------------
it('planejarReaplicacaoObservacoes: mesmo paciente e dia preserva a observacao', () => {
  const anteriores = [
    {
      paciente: 'Ana Paula Costa',
      dia_semana: 'QUINTA',
      horario: '08:00',
      observacao: 'Aguardando peca'
    }
  ];

  const novos = [
    {
      id: 'novo-1',
      paciente: 'Ana Paula Costa',
      dia_semana: 'QUINTA',
      horario: '08:00'
    }
  ];

  const plano = planejarReaplicacaoObservacoes(anteriores, novos);

  expectEqual(plano.reaplicar.length, 1);
  expectEqual(plano.reaplicar[0].id, 'novo-1');
  expectEqual(plano.reaplicar[0].observacao, 'Aguardando peca');
  expectEqual(plano.naoReaplicadas.length, 0);
});

it('planejarReaplicacaoObservacoes: horario alterado na reimportacao ainda preserva a observacao', () => {
  const anteriores = [
    {
      paciente: 'Beatriz Ramos',
      dia_semana: 'SEXTA',
      horario: '08:00',
      observacao: 'Trocar elastico'
    }
  ];

  const novos = [
    {
      id: 'novo-2',
      paciente: 'Beatriz Ramos',
      dia_semana: 'SEXTA',
      horario: '10:00' // Horario mudou de 08:00 para 10:00
    }
  ];

  const plano = planejarReaplicacaoObservacoes(anteriores, novos);

  expectEqual(plano.reaplicar.length, 1);
  expectEqual(plano.reaplicar[0].id, 'novo-2');
  expectEqual(plano.reaplicar[0].observacao, 'Trocar elastico');
  expectEqual(plano.naoReaplicadas.length, 0);
});

it('planejarReaplicacaoObservacoes: paciente que nao veio na reimportacao cai em naoReaplicadas', () => {
  const anteriores = [
    {
      paciente: 'Marcos Vinicius',
      dia_semana: 'QUINTA',
      horario: '14:00',
      observacao: 'Paciente faltou na sessao passada'
    }
  ];

  const novos = [
    {
      id: 'novo-3',
      paciente: 'Lucas Gabriel',
      dia_semana: 'QUINTA',
      horario: '14:00'
    }
  ];

  const plano = planejarReaplicacaoObservacoes(anteriores, novos);

  expectEqual(plano.reaplicar.length, 0);
  expectEqual(plano.naoReaplicadas.length, 1);
  expectEqual(plano.naoReaplicadas[0].paciente, 'Marcos Vinicius');
  expectEqual(plano.naoReaplicadas[0].observacao, 'Paciente faltou na sessao passada');
});

it('planejarReaplicacaoObservacoes: desempate por horario quando ha multiplos agendamentos do mesmo paciente no mesmo dia', () => {
  const anteriores = [
    {
      paciente: 'Julia Santos',
      dia_semana: 'QUINTA',
      horario: '08:00',
      observacao: 'Manha: tirar molde'
    },
    {
      paciente: 'Julia Santos',
      dia_semana: 'QUINTA',
      horario: '14:00',
      observacao: 'Tarde: instalar aparelho'
    }
  ];

  const novos = [
    {
      id: 'novo-tarde',
      paciente: 'Julia Santos',
      dia_semana: 'QUINTA',
      horario: '14:00'
    },
    {
      id: 'novo-manha',
      paciente: 'Julia Santos',
      dia_semana: 'QUINTA',
      horario: '08:00'
    }
  ];

  const plano = planejarReaplicacaoObservacoes(anteriores, novos);

  expectEqual(plano.reaplicar.length, 2);
  const mapaObs = new Map(plano.reaplicar.map((u) => [u.id, u.observacao]));
  expectEqual(mapaObs.get('novo-manha'), 'Manha: tirar molde');
  expectEqual(mapaObs.get('novo-tarde'), 'Tarde: instalar aparelho');
  expectEqual(plano.naoReaplicadas.length, 0);
});

it('planejarReaplicacaoObservacoes: lista vazia de observacoes nao gera atualizacoes nem pendencias', () => {
  const plano = planejarReaplicacaoObservacoes(
    [],
    [{ id: 'novo-1', paciente: 'Paciente', dia_semana: 'QUINTA', horario: '08:00' }]
  );

  expectEqual(plano.reaplicar.length, 0);
  expectEqual(plano.naoReaplicadas.length, 0);
});

// ------------------------------------------------------------------------------
// EXECUCAO DO RUNNER
// ------------------------------------------------------------------------------
console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: OBSERVACOES DA AGENDA');
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
