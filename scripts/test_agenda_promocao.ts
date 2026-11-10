/**
 * Testes automatizados das funcoes puras de promocao de paciente da mensal para a fixa.
 */

import {
  planejarPromocao,
  planejarPromocaoLote,
  montarPayloadAtualizacaoFixa,
  montarPayloadCriacaoFixa,
  deveMarcarLinhaLote
} from '../src/lib/agendaPromocao';

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

// 13. Testes dos payloads puros de atualizacao e criacao (F1 e F5)
{
  const dadosDepois = {
    paciente: '  Carlos Eduardo Silveira  ',
    dia_semana: 'SABADO',
    horario: '08:30:00',
    aluno_id: 'aluno-uuid-1',
    aluno: 'Dr. Roberto'
  };

  // 13.1 Payload de Atualizacao: NAO contem paciente nem observacao
  const payloadUpdate = montarPayloadAtualizacaoFixa(dadosDepois);
  assert(!('paciente' in payloadUpdate), 'Payload de atualizacao NAO contem o campo paciente');
  assert(!('observacao' in payloadUpdate), 'Payload de atualizacao NAO contem o campo observacao');
  assert(payloadUpdate.dia_semana === 'SABADO', 'Payload de atualizacao contem dia_semana canonico');
  assert(payloadUpdate.horario === '08:30:00', 'Payload de atualizacao contem horario correto');
  assert(payloadUpdate.aluno_id === 'aluno-uuid-1', 'Payload de atualizacao contem aluno_id');
  assert(payloadUpdate.aluno === 'Dr. Roberto', 'Payload de atualizacao contem nome textual do aluno');
  assert('updated_at' in payloadUpdate, 'Payload de atualizacao contem updated_at');

  // 13.2 Payload de Criacao: contem paciente aparado, tipo_registro 'paciente' e observacao nula
  const payloadCreate = montarPayloadCriacaoFixa('turma-uuid-99', dadosDepois);
  assert(payloadCreate.turma_id === 'turma-uuid-99', 'Payload de criacao contem turma_id');
  assert(payloadCreate.paciente === 'Carlos Eduardo Silveira', 'Payload de criacao contem paciente devidamente aparado (trim)');
  assert(payloadCreate.tipo_registro === 'paciente', 'Payload de criacao contem tipo_registro paciente');
  assert(payloadCreate.observacao === null, 'Payload de criacao contem observacao nula');
  assert(payloadCreate.dia_semana === 'SABADO', 'Payload de criacao contem dia_semana');
  assert(payloadCreate.horario === '08:30:00', 'Payload de criacao contem horario');
  assert(payloadCreate.aluno_id === 'aluno-uuid-1', 'Payload de criacao contem aluno_id');
  assert(payloadCreate.aluno === 'Dr. Roberto', 'Payload de criacao contem aluno');
}

// 14. Regras puras de selecao padrao no lote (F3 e F5)
{
  const fixaMock = [
    { id: 'f-exato', paciente: 'Paciente Exato', dia_semana: 'SEXTA', horario: '08:00:00', aluno_id: 'a1' },
    { id: 'f-similar-longo', paciente: 'Mariana Aparecida De Souza Ferreira', dia_semana: 'SEXTA', horario: '08:00:00', aluno_id: 'a1' }
  ];

  // 14.1 ATUALIZAR de nome exato com aluno valido -> MARCADO
  const itemAtualizar = { id: 'm1', paciente: 'Paciente Exato', dia_semana: 'SEXTA', horario: '09:00:00', aluno_id: 'a1' };
  const planoAtualizar = planejarPromocao({ itemMensal: itemAtualizar, fixaItens: fixaMock });
  assert(deveMarcarLinhaLote(planoAtualizar, itemAtualizar) === true, 'ATUALIZAR de nome exato vem marcado por padrao');

  // 14.2 CRIAR de nome exato (sem candidatos na fixa) com aluno valido -> MARCADO
  const itemCriar = { id: 'm2', paciente: 'Novo Paciente Sem Conflito', dia_semana: 'SEXTA', horario: '10:00:00', aluno_id: 'a2' };
  const planoCriar = planejarPromocao({ itemMensal: itemCriar, fixaItens: fixaMock });
  assert(deveMarcarLinhaLote(planoCriar, itemCriar) === true, 'CRIAR de nome exato vem marcado por padrao');

  // 14.3 Atendimento Extra no lote (aluno_id nulo) -> DESMARCADO
  const itemExtra = { id: 'm3', paciente: 'Paciente Extra Novo', dia_semana: 'SEXTA', horario: '11:00:00', aluno_id: null, aluno: 'ATENDIMENTO EXTRA' };
  const planoExtra = planejarPromocao({ itemMensal: itemExtra, fixaItens: fixaMock });
  assert(deveMarcarLinhaLote(planoExtra, itemExtra) === false, 'Atendimento Extra no lote vem desmarcado por padrao');

  // 14.4 ESCOLHER (nome parecido ou multiplos candidatos) -> DESMARCADO
  const itemSimilar = { id: 'm4', paciente: 'Mariana Aparecida De Souza Ferreir', dia_semana: 'SEXTA', horario: '08:30:00', aluno_id: 'a1' };
  const planoSimilar = planejarPromocao({ itemMensal: itemSimilar, fixaItens: fixaMock });
  assert(planoSimilar.acao === 'ESCOLHER', 'Nome parecido gera acao ESCOLHER');
  assert(deveMarcarLinhaLote(planoSimilar, itemSimilar) === false, 'ESCOLHER vem desmarcado por padrao');

  // 14.5 NADA (dados identicos) -> DESMARCADO
  const itemIdentico = { id: 'm5', paciente: 'Paciente Exato', dia_semana: 'SEXTA', horario: '08:00:00', aluno_id: 'a1' };
  const planoIdentico = planejarPromocao({ itemMensal: itemIdentico, fixaItens: fixaMock });
  assert(planoIdentico.acao === 'NADA', 'Dados identicos geram acao NADA');
  assert(deveMarcarLinhaLote(planoIdentico, itemIdentico) === false, 'NADA vem desmarcado por padrao');
}

console.log('\n================================================================');
console.log(`RESULTADO: ${passedTests} passaram, ${failedTests} falharam (Total: ${totalTests})`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('Todos os testes de promocao passaram com sucesso!');
}
