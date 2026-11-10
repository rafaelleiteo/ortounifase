/**
 * Testes Automatizados: Deteccao e Aviso de Ocupacao de Horario na Agenda
 *
 * Casos obrigatorios:
 * 1) Mesmo horario com 2 pacientes diferentes
 * 2) Exclui o proprio item (excluirId)
 * 3) Dia 'Sabado' e 'SÁBADO' contam como o mesmo dia
 * 4) Horarios diferentes nao contam
 * 5) Dias diferentes nao contam
 * 6) Bloqueio ignorado
 * 7) Lista vazia
 * 8) Mensagem do aviso com 1, 2 e 3 nomes
 */

import {
  pacientesNoHorario,
  formatarAvisoOcupacao
} from '../src/lib/agendaOcupacao';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failCount++;
  }
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`  [PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${msg} -> esperado: ${expectedStr}, obtido: ${actualStr}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: OCUPACAO DE HORARIO NA AGENDA');
console.log('================================================================\n');

const itensBase = [
  { id: '1', paciente: 'Carlos Silva', dia_semana: 'QUINTA', horario: '08:00', tipo_registro: 'paciente' },
  { id: '2', paciente: 'Mariana Souza', dia_semana: 'Quinta', horario: '08:00:00', tipo_registro: 'paciente' },
  { id: '3', paciente: 'Joao Santos', dia_semana: 'QUINTA', horario: '09:00', tipo_registro: 'paciente' },
  { id: '4', paciente: 'Beatriz Lima', dia_semana: 'SEXTA', horario: '08:00', tipo_registro: 'paciente' },
  { id: '5', paciente: 'Bloqueio Manutencao', dia_semana: 'QUINTA', horario: '08:00', tipo_registro: 'bloqueio', tipo_bloqueio: 'OUTRO' },
  { id: '6', paciente: 'Fernanda Rocha', dia_semana: 'SÁBADO', horario: '10:00', tipo_registro: 'paciente' },
  { id: '7', paciente: 'Lucas Andrade', dia_semana: 'Sabado', horario: '10:00', tipo_registro: 'paciente' }
];

// 1. Mesmo horario com 2 pacientes diferentes
const resQuinta08 = pacientesNoHorario(itensBase, 'QUINTA', '08:00');
assertEqual(resQuinta08.length, 2, 'Mesmo horario 08:00 na Quinta retorna exatamente 2 pacientes');
assertEqual(
  resQuinta08.map((p) => p.paciente).sort(),
  ['Carlos Silva', 'Mariana Souza'].sort(),
  'Retorna os pacientes Carlos Silva e Mariana Souza'
);

// 2. Exclui o proprio item
const resExcluiProprio = pacientesNoHorario(itensBase, 'QUINTA', '08:00', { excluirId: '1' });
assertEqual(resExcluiProprio.length, 1, 'Exclui o proprio item com id="1", restando 1 paciente');
assertEqual(resExcluiProprio[0].id, '2', 'Item restante tem id="2"');

// 3. Dia "Sabado" e "SÁBADO" contam como o mesmo dia
const resSabado = pacientesNoHorario(itensBase, 'SABADO', '10:00');
assertEqual(resSabado.length, 2, 'Dia "Sabado" e "SÁBADO" sao reconhecidos como o mesmo dia');
assertEqual(
  resSabado.map((p) => p.paciente).sort(),
  ['Fernanda Rocha', 'Lucas Andrade'].sort(),
  'Retorna Fernanda Rocha e Lucas Andrade no Sabado as 10:00'
);

// 4. Horarios diferentes nao contam
const resHorarioDiferente = pacientesNoHorario(itensBase, 'QUINTA', '08:30');
assertEqual(resHorarioDiferente.length, 0, 'Horarios diferentes nao contam (08:30 nao casa com 08:00)');

// 5. Dias diferentes nao contam
const resDiaDiferente = pacientesNoHorario(itensBase, 'DOMINGO', '08:00');
assertEqual(resDiaDiferente.length, 0, 'Dias diferentes nao contam (Domingo vs Quinta)');

// 6. Bloqueio ignorado
const contemBloqueio = resQuinta08.some((p) => p.id === '5');
assert(!contemBloqueio, 'Bloqueio de horario (id="5") e devidamente ignorado na ocupacao');

// 7. Lista vazia
const resVazio = pacientesNoHorario([], 'QUINTA', '08:00');
assertEqual(resVazio.length, 0, 'Lista vazia de itens devolve array vazio');

const resNulo = pacientesNoHorario(null as any, 'QUINTA', '08:00');
assertEqual(resNulo.length, 0, 'Parametro de itens nulo devolve array vazio');

// 8. Mensagem do aviso com 1, 2 e 3 nomes
const aviso1 = formatarAvisoOcupacao(['Ana Clara']);
assertEqual(
  aviso1,
  'Ja existe(m) 1 paciente(s) neste horario: Ana Clara. Voce pode confirmar mesmo assim.',
  'Mensagem de aviso para 1 paciente formatada corretamente'
);

const aviso2 = formatarAvisoOcupacao(['Ana Clara', 'Bruno Costa']);
assertEqual(
  aviso2,
  'Ja existe(m) 2 paciente(s) neste horario: Ana Clara, Bruno Costa. Voce pode confirmar mesmo assim.',
  'Mensagem de aviso para 2 pacientes formatada corretamente'
);

const aviso3 = formatarAvisoOcupacao([
  { paciente: 'Ana Clara' },
  { paciente: 'Bruno Costa' },
  { paciente: 'Carla Dias' }
]);
assertEqual(
  aviso3,
  'Ja existe(m) 3 paciente(s) neste horario: Ana Clara, Bruno Costa, Carla Dias. Voce pode confirmar mesmo assim.',
  'Mensagem de aviso para 3 pacientes formatada corretamente'
);

const avisoVazio = formatarAvisoOcupacao([]);
assertEqual(avisoVazio, null, 'formatarAvisoOcupacao com array vazio retorna null');

console.log('\n================================================================');
console.log(`RESULTADO: ${passCount} passaram, ${failCount} falharam (Total: ${passCount + failCount})`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('Todos os testes de ocupacao de horario passaram com sucesso!');
}
