/**
 * Testes automatizados das funcoes puras de promocao de paciente da mensal para a fixa.
 */

import { planejarPromocao, planejarPromocaoLote } from '../src/lib/agendaPromocao';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: PROMOCAO MENSAL -> FIXA');
console.log('================================================================\n');

// 1. Nome exato com caixa alta/baixa diferente e alteracao de horario -> ATUALIZAR
{
  const fixaItens = [
    {
      id: 'fixa-1',
      paciente: 'LUCAS SILVEIRA',
      aluno_id: 'a1',
      aluno: 'Dra. Ana',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-1',
    paciente: 'lucas silveira',
    aluno_id: 'a1',
    aluno: 'Dra. Ana',
    horario: '09:00:00',
    dia_semana: 'SEXTA',
    turma_id: 't1',
    observacao: 'Observacao que nao deve ir para fixa'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'ATUALIZAR', 'Nome com caixa diferente e horario alterado retorna ATUALIZAR');
  assert(plano.itemEscolhido?.id === 'fixa-1', 'Candidato escolhido e fixa-1');
  assert(plano.diferenca?.horarioMudou === true, 'Detecta que o horario mudou');
  assert(plano.diferenca?.diaMudou === false, 'Detecta que o dia nao mudou');
  assert(plano.diferenca?.alunoMudou === false, 'Detecta que o aluno nao mudou');
  assert(plano.depois.horario === '09:00:00', 'Horario de destino e 09:00:00');
}

// 2. 'Sabado' e 'SÁBADO' nao contam como diferenca de dia -> NADA
{
  const fixaItens = [
    {
      id: 'fixa-2',
      paciente: 'Mariana Souza',
      aluno_id: 'a2',
      aluno: 'Dr. Bruno',
      horario: '10:00:00',
      dia_semana: 'SÁBADO',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-2',
    paciente: 'Mariana Souza',
    aluno_id: 'a2',
    aluno: 'Dr. Bruno',
    horario: '10:00',
    dia_semana: 'Sabado',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'NADA', 'Sabado e SÁBADO com mesmo horario e aluno retorna NADA');
  assert(plano.candidatos.length === 1, 'Exatamente 1 candidato encontrado');
}

// 3. Mudanca de dia (Sexta para Sabado) -> ATUALIZAR com canonical SABADO
{
  const fixaItens = [
    {
      id: 'fixa-3',
      paciente: 'Carlos Santos',
      aluno_id: 'a3',
      aluno: 'Dra. Carla',
      horario: '08:30:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-3',
    paciente: 'Carlos Santos',
    aluno_id: 'a3',
    aluno: 'Dra. Carla',
    horario: '08:30:00',
    dia_semana: 'SABADO',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'ATUALIZAR', 'Mudanca de Sexta para Sabado retorna ATUALIZAR');
  assert(plano.diferenca?.diaMudou === true, 'Flag diaMudou e verdadeira');
  assert(plano.depois.dia_semana === 'SABADO', 'Destino canonicalizado para SABADO');
}

// 4. Mudanca apenas de aluno -> ATUALIZAR
{
  const fixaItens = [
    {
      id: 'fixa-4',
      paciente: 'Patricia Lima',
      aluno_id: 'a1',
      aluno: 'Dra. Ana',
      horario: '14:00:00',
      dia_semana: 'QUINTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-4',
    paciente: 'Patricia Lima',
    aluno_id: 'a2',
    aluno: 'Dr. Bruno',
    horario: '14:00:00',
    dia_semana: 'QUINTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'ATUALIZAR', 'Mudanca apenas de aluno retorna ATUALIZAR');
  assert(plano.diferenca?.alunoMudou === true, 'Flag alunoMudou e verdadeira');
  assert(plano.depois.aluno_id === 'a2', 'Novo aluno_id e a2');
}

// 5. Mudanca apenas de horario -> ATUALIZAR
{
  const fixaItens = [
    {
      id: 'fixa-5',
      paciente: 'Fernando Dias',
      aluno_id: 'a1',
      aluno: 'Dra. Ana',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-5',
    paciente: 'Fernando Dias',
    aluno_id: 'a1',
    aluno: 'Dra. Ana',
    horario: '09:30:00',
    dia_semana: 'SEXTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'ATUALIZAR', 'Mudanca apenas de horario retorna ATUALIZAR');
  assert(plano.diferenca?.horarioMudou === true, 'Flag horarioMudou e verdadeira');
}

// 6. Dados identicos -> NADA
{
  const fixaItens = [
    {
      id: 'fixa-6',
      paciente: 'Beatriz Ramos',
      aluno_id: 'a5',
      aluno: 'Dr. Eduardo',
      horario: '11:00:00',
      dia_semana: 'QUINTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-6',
    paciente: 'Beatriz Ramos',
    aluno_id: 'a5',
    aluno: 'Dr. Eduardo',
    horario: '11:00',
    dia_semana: 'QUINTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'NADA', 'Dados identicos retornam NADA');
}

// 7. Paciente nao existe na fixa -> CRIAR
{
  const fixaItens = [
    {
      id: 'fixa-7',
      paciente: 'Outro Paciente',
      aluno_id: 'a1',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-7',
    paciente: 'Novo Paciente Cadastrado',
    aluno_id: 'a2',
    aluno: 'Dr. Bruno',
    horario: '10:00:00',
    dia_semana: 'SEXTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'CRIAR', 'Paciente inexistente na fixa retorna CRIAR');
  assert(plano.candidatos.length === 0, 'Zero candidatos encontrados');
}

// 8. 2 linhas exatas na fixa -> ESCOLHER
{
  const fixaItens = [
    {
      id: 'fixa-8a',
      paciente: 'Juliana Costa',
      aluno_id: 'a1',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    },
    {
      id: 'fixa-8b',
      paciente: 'Juliana Costa',
      aluno_id: 'a2',
      horario: '14:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-8',
    paciente: 'Juliana Costa',
    aluno_id: 'a1',
    horario: '08:30:00',
    dia_semana: 'SEXTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'ESCOLHER', 'Duas linhas exatas na fixa retornam ESCOLHER');
  assert(plano.candidatos.length === 2, '2 candidatos reportados');
  assert(plano.candidatos[0].tipoMatch === 'exato', 'Candidatos sao do tipo exato');
}

// 9. Nome cortado em 33 caracteres -> ESCOLHER com tipoMatch: 'parecido'
{
  const fixaItens = [
    {
      id: 'fixa-9',
      paciente: 'Raiane Dos Santos Amorim De Oliveira',
      aluno_id: 'a1',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-9',
    paciente: 'Raiane Dos Santos Amorim De Olive',
    aluno_id: 'a1',
    horario: '08:30:00',
    dia_semana: 'SEXTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'ESCOLHER', 'Nome truncado retorna ESCOLHER');
  assert(plano.candidatos.length === 1, '1 candidato reportado');
  assert(plano.candidatos[0].tipoMatch === 'parecido', 'Candidato e do tipo parecido');
}

// 10. Nomes distintos ("Lucas Amaral..." vs "Kaique Amaral...") -> CRIAR
{
  const fixaItens = [
    {
      id: 'fixa-10',
      paciente: 'Kaique Amaral Do Carmo Garrido',
      aluno_id: 'a1',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-10',
    paciente: 'Lucas Amaral Do Carmo Garrido',
    aluno_id: 'a1',
    horario: '08:00:00',
    dia_semana: 'SEXTA',
    turma_id: 't1'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'CRIAR', 'Nomes distintos nao sao confundidos e retornam CRIAR');
  assert(plano.candidatos.length === 0, 'Zero candidatos encontrados');
}

// 11. Bloqueios sao ignorados e Atendimento Extra mantem aluno_id null
{
  const fixaItens = [
    {
      id: 'fixa-11',
      paciente: '[SEQUENCIA] Horario Reservado',
      tipo_registro: 'bloqueio',
      horario: '08:00:00',
      dia_semana: 'SEXTA',
      turma_id: 't1'
    }
  ];
  const itemMensal = {
    id: 'm-11',
    paciente: 'Paciente Avulso Extra',
    aluno_id: null,
    aluno: 'ATENDIMENTO EXTRA',
    horario: '08:00:00',
    dia_semana: 'SEXTA',
    turma_id: 't1',
    observacao: 'Obs do mes'
  };

  const plano = planejarPromocao({ itemMensal, fixaItens });
  assert(plano.acao === 'CRIAR', 'Bloqueio na fixa e ignorado na busca de candidatos');
  assert(plano.depois.aluno_id === null, 'Atendimento Extra mantem aluno_id null');
  assert(plano.depois.aluno === 'ATENDIMENTO EXTRA', 'Atendimento Extra define aluno como ATENDIMENTO EXTRA');

  // Promocao de bloqueio mensal retorna NADA
  const planoBloqueio = planejarPromocao({ itemMensal: fixaItens[0], fixaItens });
  assert(planoBloqueio.acao === 'NADA', 'Item de bloqueio mensal tem promocao com acao NADA');
}

// 12. Teste do planejamento em lote
{
  const fixaItens = [
    { id: 'f1', paciente: 'Paciente Um', horario: '08:00', dia_semana: 'SEXTA', aluno_id: 'a1' }
  ];
  const itensMensais = [
    { id: 'm1', paciente: 'Paciente Um', horario: '09:00', dia_semana: 'SEXTA', aluno_id: 'a1' }, // ATUALIZAR
    { id: 'm2', paciente: 'Paciente Dois', horario: '08:00', dia_semana: 'SEXTA', aluno_id: 'a2' } // CRIAR
  ];

  const lote = planejarPromocaoLote({ itensMensais, fixaItens });
  assert(lote.length === 2, 'Lote devolve 2 itens planejados');
  assert(lote[0].plano.acao === 'ATUALIZAR' && lote[0].selecionado === true, 'Item 1 atualiza e vem selecionado');
  assert(lote[1].plano.acao === 'CRIAR' && lote[1].selecionado === true, 'Item 2 cria e vem selecionado');
}

console.log('\n================================================================');
console.log(`RESULTADO: ${passedTests} passaram, ${failedTests} falharam (Total: ${totalTests})`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('Todos os testes de promocao passaram com sucesso!');
}
