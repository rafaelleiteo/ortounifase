/**
 * Testes Automatizados: Canonicalizacao e Manipulacao de Dias da Semana
 *
 * Valida:
 * 1) SÁBADO, Sábado, SABADO, "sábado ", sabado, sáb, sáb., sab
 * 2) Sexta-feira, SEXTA, Sexta
 * 3) Segunda-feira
 * 4) Valores invalidos e vazios
 * 5) Ordenacao dos dias segundo ordem canonica
 * 6) "Sexta" e "SEXTA" no mesmo grupo
 * 7) Comparacao Fixa x Mensal entre "Sabado" e "SÁBADO" da ESP2
 * 8) Agrupamento de 22 registros "SEXTA" e 17 "SÁBADO" em 2 dias com 22 e 17
 */

import {
  canonicalizarDia,
  rotuloDia,
  mesmoDia,
  compararDiasSemana,
  DIAS_SEMANA_CANONICOS
} from '../src/lib/agendaDias';

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
console.log('EXECUTANDO TESTES AUTOMATIZADOS: CANONICALIZACAO DE DIAS DA SEMANA');
console.log('================================================================\n');

// 1. Variacoes de Sabado
assertEqual(canonicalizarDia('SÁBADO'), 'SABADO', 'canonicalizarDia("SÁBADO")');
assertEqual(canonicalizarDia('Sábado'), 'SABADO', 'canonicalizarDia("Sábado")');
assertEqual(canonicalizarDia('SABADO'), 'SABADO', 'canonicalizarDia("SABADO")');
assertEqual(canonicalizarDia('sábado '), 'SABADO', 'canonicalizarDia("sábado ") com espaco');
assertEqual(canonicalizarDia('sabado'), 'SABADO', 'canonicalizarDia("sabado")');
assertEqual(canonicalizarDia('sáb'), 'SABADO', 'canonicalizarDia("sáb")');
assertEqual(canonicalizarDia('sáb.'), 'SABADO', 'canonicalizarDia("sáb.") com ponto');
assertEqual(canonicalizarDia('sab'), 'SABADO', 'canonicalizarDia("sab")');
assertEqual(canonicalizarDia('sab.'), 'SABADO', 'canonicalizarDia("sab.") com ponto');
assertEqual(rotuloDia('SABADO'), 'Sábado', 'rotuloDia("SABADO") retorna "Sábado"');
assertEqual(rotuloDia('sáb.'), 'Sábado', 'rotuloDia("sáb.") retorna "Sábado"');

// 2. Variacoes de Sexta e Segunda
assertEqual(canonicalizarDia('Sexta-feira'), 'SEXTA', 'canonicalizarDia("Sexta-feira")');
assertEqual(canonicalizarDia('SEXTA'), 'SEXTA', 'canonicalizarDia("SEXTA")');
assertEqual(canonicalizarDia('Sexta'), 'SEXTA', 'canonicalizarDia("Sexta")');
assertEqual(canonicalizarDia('sex'), 'SEXTA', 'canonicalizarDia("sex")');
assertEqual(canonicalizarDia('sex.'), 'SEXTA', 'canonicalizarDia("sex.")');
assertEqual(canonicalizarDia('Segunda-feira'), 'SEGUNDA', 'canonicalizarDia("Segunda-feira")');
assertEqual(canonicalizarDia('seg'), 'SEGUNDA', 'canonicalizarDia("seg")');
assertEqual(rotuloDia('SEXTA'), 'Sexta-feira', 'rotuloDia("SEXTA") retorna "Sexta-feira"');

// 3. Valores invalidos e vazios
assertEqual(canonicalizarDia(''), null, 'canonicalizarDia("") retorna null');
assertEqual(canonicalizarDia('   '), null, 'canonicalizarDia("   ") retorna null');
assertEqual(canonicalizarDia(null), null, 'canonicalizarDia(null) retorna null');
assertEqual(canonicalizarDia(undefined), null, 'canonicalizarDia(undefined) retorna null');
assertEqual(canonicalizarDia('invalido'), null, 'canonicalizarDia("invalido") retorna null');
assertEqual(canonicalizarDia('123'), null, 'canonicalizarDia("123") retorna null');
assertEqual(rotuloDia('invalido'), null, 'rotuloDia("invalido") retorna null');

// 4. Ordenacao canonica dos dias
const diasDesordenados = ['SABADO', 'SEGUNDA', 'SEXTA', 'QUINTA', 'TERCA', 'DOMINGO', 'QUARTA'];
const ordenados = [...diasDesordenados].sort(compararDiasSemana);
assertEqual(
  ordenados,
  ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO'],
  'compararDiasSemana ordena corretamente de Segunda a Domingo'
);

// 5. "Sexta" e "SEXTA" no mesmo grupo
assert(mesmoDia('Sexta', 'SEXTA'), '"Sexta" e "SEXTA" sao reconhecidos como mesmoDia');
assert(mesmoDia('SEXTA-FEIRA', 'sex.'), '"SEXTA-FEIRA" e "sex." sao mesmoDia');

// 6. Comparacao Fixa x Mensal entre "Sabado" e "SÁBADO" da ESP2
assert(
  mesmoDia('Sabado', 'SÁBADO'),
  'ESP2: "Sabado" (Fixa) e "SÁBADO" (Mensal) sao reconhecidos como mesmoDia'
);

// 7. Agrupamento de 22 registros "SEXTA" e 17 "SÁBADO" em 2 dias com 22 e 17
interface RegistroMock {
  id: number;
  dia_semana: string;
}

const mockRegistrosESP2: RegistroMock[] = [];
// 22 registros "SEXTA"
for (let i = 1; i <= 22; i++) {
  mockRegistrosESP2.push({ id: i, dia_semana: 'SEXTA' });
}
// 17 registros "SÁBADO"
for (let i = 23; i <= 39; i++) {
  mockRegistrosESP2.push({ id: i, dia_semana: 'SÁBADO' });
}

// Agrupamento usando canonicalizarDia
const grupos = new Map<string, RegistroMock[]>();
for (const reg of mockRegistrosESP2) {
  const chave = canonicalizarDia(reg.dia_semana) || 'OUTROS';
  const lista = grupos.get(chave) || [];
  lista.push(reg);
  grupos.set(chave, lista);
}

assertEqual(grupos.size, 2, 'Agrupamento gerou exatamente 2 grupos');
assertEqual(grupos.get('SEXTA')?.length, 22, 'Grupo SEXTA contem 22 registros');
assertEqual(grupos.get('SABADO')?.length, 17, 'Grupo SABADO contem 17 registros');

// Filtro simulando a selecao do dia SÁBADO na Agenda Mensal
const registrosSabadoSelecionado = mockRegistrosESP2.filter((r) => mesmoDia(r.dia_semana, 'SABADO'));
assertEqual(
  registrosSabadoSelecionado.length,
  17,
  'Filtro por diaSelecionado="SABADO" retorna todos os 17 registros com "SÁBADO"'
);

console.log('\n================================================================');
console.log(`RESULTADO: ${passCount} passaram, ${failCount} falharam (Total: ${passCount + failCount})`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('Todos os testes de dias da semana passaram com sucesso!');
}
