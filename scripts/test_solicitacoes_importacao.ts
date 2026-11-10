/**
 * Testes Automatizados para Importacao em Lote de Solicitacoes
 */

import {
  normalizarNomeAgenda,
  casarAgendaComTurmas,
  parsearJsonImportacao,
  analisarLoteImportacao,
  calcularResumoImportacao,
  montarPayloadsGravacao,
  gerarTextoModeloClaude,
  MAX_LINHAS_IMPORTACAO
} from '../src/lib/solicitacoesImportacao';
import { TurmaItem } from '../src/lib/solicitacoesTypes';

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

function expectThrows(fn: () => void, trechoMensagem?: string) {
  let lancou = false;
  try {
    fn();
  } catch (err: any) {
    lancou = true;
    if (trechoMensagem && !err.message.includes(trechoMensagem)) {
      throw new Error(
        `Mensagem esperava conter "${trechoMensagem}", mas recebeu: "${err.message}"`
      );
    }
  }
  if (!lancou) {
    throw new Error('Esperava lancar excecao, mas executou com sucesso.');
  }
}

// Turmas de mock para os testes
const TURMAS_MOCK: TurmaItem[] = [
  { id: 'uuid-t1', nome: 'ESP1' },
  { id: 'uuid-t2', nome: 'ESP2' },
  { id: 'uuid-t3', nome: 'Mestrado 2026' }
];

// ------------------------------------------------------------------------------
// 1. TESTES DE PARSE
// ------------------------------------------------------------------------------

it('parse: aceita lista JSON pura', () => {
  const json = '[{"paciente":"Carlos Eduardo","agenda":"ESP1"}]';
  const resultado = parsearJsonImportacao(json);
  expectEqual(resultado.length, 1);
  expectEqual((resultado[0] as any).paciente, 'Carlos Eduardo');
});

it('parse: aceita objeto com chave "solicitacoes"', () => {
  const json = '{"solicitacoes":[{"paciente":"Mariana Lima"}]}';
  const resultado = parsearJsonImportacao(json);
  expectEqual(resultado.length, 1);
  expectEqual((resultado[0] as any).paciente, 'Mariana Lima');
});

it('parse: tolera cercas de markdown com ou sem identificador json', () => {
  const jsonComCerca = '```json\n[{"paciente":"Lucas Silva"}]\n```';
  const resultado1 = parsearJsonImportacao(jsonComCerca);
  expectEqual(resultado1.length, 1);
  expectEqual((resultado1[0] as any).paciente, 'Lucas Silva');

  const jsonSemIdentificador = '```\n[{"paciente":"Lucas Silva"}]\n```';
  const resultado2 = parsearJsonImportacao(jsonSemIdentificador);
  expectEqual(resultado2.length, 1);
});

it('parse: tolera BOM no inicio da string', () => {
  const jsonComBom = '\uFEFF[{"paciente":"Julia Santos"}]';
  const resultado = parsearJsonImportacao(jsonComBom);
  expectEqual(resultado.length, 1);
  expectEqual((resultado[0] as any).paciente, 'Julia Santos');
});

it('parse: aceita apelidos de chaves (nome, turma, observação, obs)', () => {
  const json = '[{"nome":"Roberto","turma":"ESP2","obs":"urgente"},{"paciente":"Paula","observação":"tarde"}]';
  const itens = parsearJsonImportacao(json);
  expectEqual(itens.length, 2);

  const analisados = analisarLoteImportacao(itens, TURMAS_MOCK, []);
  expectEqual(analisados[0].paciente, 'Roberto');
  expectEqual(analisados[0].turma_id, 'uuid-t2');
  expectEqual(analisados[0].observacao, 'urgente');

  expectEqual(analisados[1].paciente, 'Paula');
  expectEqual(analisados[1].observacao, 'tarde');
});

it('parse: lanca erro amigavel para JSON sintaticamente invalido', () => {
  expectThrows(
    () => parsearJsonImportacao('{ invalid json ['),
    'JSON valido'
  );
});

it('parse: lanca erro para lista vazia', () => {
  expectThrows(() => parsearJsonImportacao('[]'), 'vazia');
  expectThrows(() => parsearJsonImportacao('{"solicitacoes":[]}'), 'vazia');
});

it('parse: lanca erro para lote com mais de 200 itens', () => {
  const itens = Array.from({ length: 201 }, (_, i) => ({ paciente: `Paciente ${i}` }));
  const json = JSON.stringify(itens);
  expectThrows(() => parsearJsonImportacao(json), 'excede o limite maximo de 200');
});

it('parse: lanca erro para raiz que nao e lista nem objeto com solicitacoes', () => {
  expectThrows(() => parsearJsonImportacao('"apenas uma string"'), 'lista de solicitacoes');
  expectThrows(() => parsearJsonImportacao('12345'), 'lista de solicitacoes');
  expectThrows(() => parsearJsonImportacao('{"outra_chave":[]}'), 'lista de solicitacoes');
});

// ------------------------------------------------------------------------------
// 2. TESTES DE CASAMENTO DE AGENDA
// ------------------------------------------------------------------------------

it('agenda: casa ignorando variacoes de caixa e acentos', () => {
  const c1 = casarAgendaComTurmas('esp1', TURMAS_MOCK);
  expectEqual(c1.turma_id, 'uuid-t1');
  expectEqual(c1.turmaNome, 'ESP1');
  expectEqual(c1.aviso, null);

  const c2 = casarAgendaComTurmas('MÉSTRADO 2026', TURMAS_MOCK);
  expectEqual(c2.turma_id, 'uuid-t3');
  expectEqual(c2.turmaNome, 'Mestrado 2026');
  expectEqual(c2.aviso, null);
});

it('agenda: remove prefixo "Turma " ao casar', () => {
  const c1 = casarAgendaComTurmas('Turma ESP1', TURMAS_MOCK);
  expectEqual(c1.turma_id, 'uuid-t1');
  expectEqual(c1.turmaNome, 'ESP1');
  expectEqual(c1.aviso, null);

  const c2 = casarAgendaComTurmas('turma esp2', TURMAS_MOCK);
  expectEqual(c2.turma_id, 'uuid-t2');
  expectEqual(c2.aviso, null);
});

it('agenda: sinonimos de indefinida viram null sem aviso', () => {
  const sinonimos = [null, undefined, '', '   ', 'indefinida', 'indefinido', 'nenhuma', 'a definir', 'sem agenda', '-'];
  for (const s of sinonimos) {
    const res = casarAgendaComTurmas(s, TURMAS_MOCK);
    expectEqual(res.turma_id, null, `Sinonimo ${s} deve ter turma_id null`);
    expectEqual(res.turmaNome, 'Indefinida');
    expectEqual(res.aviso, null, `Sinonimo ${s} nao deve gerar aviso`);
  }
});

it('agenda: desconhecida vira null COM aviso explicativo', () => {
  const res = casarAgendaComTurmas('Ortodontia Avancada 99', TURMAS_MOCK);
  expectEqual(res.turma_id, null);
  expectEqual(res.turmaNome, 'Indefinida');
  expectTrue(res.aviso !== null && res.aviso.includes('nao reconhecida'));
});

it('agenda: ambigua vira null com aviso de ambiguidade', () => {
  const turmasAmbiguas: TurmaItem[] = [
    { id: '1', nome: 'ESP1' },
    { id: '2', nome: 'Turma ESP1' }
  ];
  const res = casarAgendaComTurmas('ESP1', turmasAmbiguas);
  expectEqual(res.turma_id, null);
  expectTrue(res.aviso !== null && res.aviso.includes('ambigua'));
});

// ------------------------------------------------------------------------------
// 3. TESTES DE STATUS E SELECAO PADRAO
// ------------------------------------------------------------------------------

it('status: erro se paciente for vazio, maior que 200 ou obs maior que 1000', () => {
  const lote = [
    { paciente: '' },
    { paciente: 'a'.repeat(201) },
    { paciente: 'Ok', observacao: 'b'.repeat(1001) }
  ];
  const analisados = analisarLoteImportacao(lote, TURMAS_MOCK, []);

  expectEqual(analisados[0].status, 'erro');
  expectFalse(analisados[0].selecionada);

  expectEqual(analisados[1].status, 'erro');
  expectFalse(analisados[1].selecionada);

  expectEqual(analisados[2].status, 'erro');
  expectFalse(analisados[2].selecionada);
});

it('status: duplicada_banco se ja existir paciente pendente no banco', () => {
  const bancoPendentes = [{ paciente: 'Carlos Eduardo' }];
  const lote = [{ paciente: '  carlos   eduardo  ' }];
  const analisados = analisarLoteImportacao(lote, TURMAS_MOCK, bancoPendentes);

  expectEqual(analisados[0].status, 'duplicada_banco');
  expectFalse(analisados[0].selecionada, 'Duplicadas devem comecar desmarcadas');
});

it('status: duplicada_lote se nome se repetir no proprio lote', () => {
  const lote = [
    { paciente: 'Ana Paula' },
    { paciente: 'ana paula' }
  ];
  const analisados = analisarLoteImportacao(lote, TURMAS_MOCK, []);

  expectEqual(analisados[0].status, 'ok');
  expectTrue(analisados[0].selecionada);

  expectEqual(analisados[1].status, 'duplicada_lote');
  expectFalse(analisados[1].selecionada, 'Segunda ocorrencia deve comecar desmarcada');
});

it('status: aviso de agenda desconhecida comeca MARCADA', () => {
  const lote = [{ paciente: 'Marcos Vinicius', agenda: 'Turma Fantasma' }];
  const analisados = analisarLoteImportacao(lote, TURMAS_MOCK, []);

  expectEqual(analisados[0].status, 'aviso');
  expectTrue(analisados[0].selecionada, 'Avisos devem comecar marcados');
  expectEqual(analisados[0].turma_id, null);
});

it('status: ok comeca MARCADA', () => {
  const lote = [{ paciente: 'Beatriz Ramos', agenda: 'ESP1', observacao: 'Manha' }];
  const analisados = analisarLoteImportacao(lote, TURMAS_MOCK, []);

  expectEqual(analisados[0].status, 'ok');
  expectTrue(analisados[0].selecionada);
});

it('resumo: contabiliza corretamente prontas, duplicadas e erros', () => {
  const lote = [
    { paciente: 'P1', agenda: 'ESP1' }, // ok
    { paciente: 'P2', agenda: 'Desconhecida' }, // aviso (pronta)
    { paciente: 'P1' }, // duplicada_lote
    { paciente: '' } // erro
  ];
  const analisados = analisarLoteImportacao(lote, TURMAS_MOCK, []);
  const resumo = calcularResumoImportacao(analisados);

  expectEqual(resumo.total, 4);
  expectEqual(resumo.prontas, 2); // 1 ok + 1 aviso
  expectEqual(resumo.duplicadas, 1);
  expectEqual(resumo.erros, 1);
});

// ------------------------------------------------------------------------------
// 4. TESTES DE MONTAGEM DE PAYLOAD
// ------------------------------------------------------------------------------

it('payload: apara espacos de paciente e converte observacao vazia para null', () => {
  const analisados = analisarLoteImportacao(
    [
      { paciente: '  Julio Cesar  ', agenda: 'ESP1', observacao: '  ' },
      { paciente: 'Fernanda', agenda: null, observacao: '  Observacao valida  ' },
      { paciente: '', observacao: 'sem nome' } // status: erro, selecionada: false
    ],
    TURMAS_MOCK,
    []
  );

  const payloads = montarPayloadsGravacao(analisados);
  expectEqual(payloads.length, 2);

  expectEqual(payloads[0].paciente, 'Julio Cesar');
  expectEqual(payloads[0].turma_id, 'uuid-t1');
  expectEqual(payloads[0].observacao, null);

  expectEqual(payloads[1].paciente, 'Fernanda');
  expectEqual(payloads[1].turma_id, null);
  expectEqual(payloads[1].observacao, 'Observacao valida');
});

// ------------------------------------------------------------------------------
// 5. TESTES DO MODELO CLAUDE
// ------------------------------------------------------------------------------

it('modelo: contem todas as turmas recebidas e instrucoes obrigatorias', () => {
  const texto = gerarTextoModeloClaude(TURMAS_MOCK);

  expectTrue(texto.includes('"ESP1"'));
  expectTrue(texto.includes('"ESP2"'));
  expectTrue(texto.includes('"Mestrado 2026"'));
  expectTrue(texto.includes('APENAS com a lista JSON'));
  expectTrue(texto.includes('Nao invente dados'));
  expectTrue(texto.includes('NUNCA inclua dados clinicos'));
  expectTrue(texto.includes('null'));
});

// Runner
console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: IMPORTACAO EM LOTE DE SOLICITACOES');
console.log(`Fuso do ambiente: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
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
} else {
  console.log('Todos os testes de importacao passaram com sucesso!');
}
