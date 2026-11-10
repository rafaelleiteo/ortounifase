/**
 * Testes automatizados para o modulo Controle de Agenda
 *
 * Cobre:
 * 1. Lista com Mensal + So na Fixa
 * 2. Dia Sabado com acento
 * 3. Ordenacao por horario
 * 4. Dois pacientes no mesmo horario
 * 5. Clicar no mesmo estado desmarca
 * 6. Observacao com 501 caracteres rejeitada
 * 7. Avulso removivel e Mensal nao
 * 8. Contadores
 * 9. Payload
 */

import {
  montarListaImportacao,
  ordenarControleItens,
  alternarStatus,
  validarStatus,
  validarObservacao,
  podeRemoverItem,
  calcularContadoresControle,
  montarPayloadSalvar,
  pacienteExisteNaMensal,
  normalizarMesReferencia,
  ControleItem
} from '../src/lib/controleAgenda';
import { canonicalizarDia } from '../src/lib/agendaDias';

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
console.log('EXECUTANDO TESTES AUTOMATIZADOS: CONTROLE DE AGENDA');
console.log('================================================================\n');

// 1. LISTA COM MENSAL + SO NA FIXA
console.log('--- CENARIO 1: Lista com Mensal + So na Fixa ---');
{
  const itensMensal = [
    {
      id: 'm-1',
      paciente: 'Carlos Eduardo Silva',
      horario: '08:00',
      dia_semana: 'QUINTA',
      aluno: 'Dr. Lucas'
    },
    {
      id: 'm-2',
      paciente: 'Mariana Costa',
      horario: '08:45',
      dia_semana: 'QUINTA',
      aluno: 'Dra. Beatriz'
    }
  ];

  const itensFixa = [
    {
      id: 'f-1',
      paciente: 'Carlos Eduardo Silva',
      horario: '08:00',
      dia_semana: 'QUINTA',
      aluno: 'Dr. Lucas'
    },
    {
      id: 'f-2',
      paciente: 'Joao Pedro Souza',
      horario: '09:30',
      dia_semana: 'QUINTA',
      aluno: 'Dr. Marcos'
    }
  ];

  const lista = montarListaImportacao(itensMensal, itensFixa);

  assert(lista.length === 3, 'Gera exatamente 3 pacientes no total (2 da Mensal + 1 So na Fixa)');
  assert(lista[0].paciente === 'Carlos Eduardo Silva' && lista[0].origem === 'mensal', 'Carlos Eduardo e de origem mensal');
  assert(lista[1].paciente === 'Mariana Costa' && lista[1].origem === 'mensal', 'Mariana Costa e de origem mensal');
  assert(lista[2].paciente === 'Joao Pedro Souza' && lista[2].origem === 'fixa', 'Joao Pedro Souza e de origem fixa (So na Fixa)');
  assert(!lista.some((i) => i.paciente === 'Carlos Eduardo Silva' && i.origem === 'fixa'), 'Carlos Eduardo nao e duplicado como fixa');
}

// 2. DIA SABADO COM ACENTO
console.log('\n--- CENARIO 2: Dia Sabado com acento ---');
{
  assert(canonicalizarDia('Sábado') === 'SABADO', 'Canonicaliza "Sábado" para SABADO');
  assert(canonicalizarDia('SÁBADO') === 'SABADO', 'Canonicaliza "SÁBADO" para SABADO');
  assert(canonicalizarDia('sáb') === 'SABADO', 'Canonicaliza "sáb" para SABADO');
  assert(canonicalizarDia('sabado-feira') === 'SABADO', 'Canonicaliza "sabado-feira" para SABADO');

  const itensMensal = [
    {
      id: 'm-sab',
      paciente: 'Renata Ferreira',
      horario: '08:00',
      dia_semana: 'Sábado'
    }
  ];

  const itensFixa = [
    {
      id: 'f-sab-1',
      paciente: 'Renata Ferreira',
      horario: '08:00',
      dia_semana: 'SABADO'
    },
    {
      id: 'f-sab-2',
      paciente: 'Lucas Alencar',
      horario: '09:00',
      dia_semana: 'sábado'
    }
  ];

  const listaSabado = montarListaImportacao(itensMensal, itensFixa);
  assert(listaSabado.length === 2, 'Reconhece matching de sabado com e sem acento');
  assert(listaSabado.find((i) => i.paciente === 'Renata Ferreira')?.origem === 'mensal', 'Renata Ferreira identificada na mensal');
  assert(listaSabado.find((i) => i.paciente === 'Lucas Alencar')?.origem === 'fixa', 'Lucas Alencar incluido como fixa');
  assert(listaSabado.every((i) => i.dia_semana === 'SABADO'), 'Todos os itens possuem dia_semana canonico SABADO');
}

// 3. ORDENACAO POR HORARIO
console.log('\n--- CENARIO 3: Ordenacao por horario ---');
{
  const itensDesordenados: ControleItem[] = [
    {
      id: '1',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '10:00',
      paciente: 'Paciente 10h'
    },
    {
      id: '2',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '08:00',
      paciente: 'Paciente 08h'
    },
    {
      id: '3',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '09:30',
      paciente: 'Paciente 09h30'
    },
    {
      id: '4',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '08:45',
      paciente: 'Paciente 08h45'
    }
  ];

  const ordenados = ordenarControleItens(itensDesordenados);
  const horarios = ordenados.map((i) => i.horario);
  assert(
    horarios[0] === '08:00' &&
    horarios[1] === '08:45' &&
    horarios[2] === '09:30' &&
    horarios[3] === '10:00',
    'Itens ordenados cronologicamente: 08:00, 08:45, 09:30, 10:00'
  );
}

// 4. DOIS PACIENTES NO MESMO HORARIO
console.log('\n--- CENARIO 4: Dois pacientes no mesmo horario ---');
{
  const itensMesmoHorario: ControleItem[] = [
    {
      id: '1',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '08:00',
      paciente: 'Paciente Alpha'
    },
    {
      id: '2',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '08:00',
      paciente: 'Paciente Beta'
    }
  ];

  const ordenados = ordenarControleItens(itensMesmoHorario);
  assert(ordenados.length === 2, 'Dois pacientes no mesmo horario sao permitidos sem bloqueio');
  assert(ordenados[0].paciente === 'Paciente Alpha', 'Preserva primeiro paciente do empate');
  assert(ordenados[1].paciente === 'Paciente Beta', 'Preserva segundo paciente do empate');

  const payload = montarPayloadSalvar('turma-t1', '2026-11-01', ordenados);
  assert(payload.p_itens.length === 2, 'Payload contem ambos os pacientes');
  assert(payload.p_itens[0].ordem === 1 && payload.p_itens[1].ordem === 2, 'Ordens atribuidas sequencialmente no mesmo horario');
}

// 5. CLICAR NO MESMO ESTADO DESMARCA
console.log('\n--- CENARIO 5: Clicar no mesmo estado desmarca ---');
{
  let status = alternarStatus(null, 'atendido');
  assert(status === 'atendido', 'Transita de pendente (null) para atendido');

  status = alternarStatus(status, 'atendido');
  assert(status === null, 'Clicar novamente em atendido desmarca para null (pendente)');

  status = alternarStatus(null, 'faltou');
  assert(status === 'faltou', 'Transita de pendente (null) para faltou');

  status = alternarStatus(status, 'faltou');
  assert(status === null, 'Clicar novamente em faltou desmarca para null');

  status = alternarStatus('desmarcou', 'nao_marcou');
  assert(status === 'nao_marcou', 'Alterna de desmarcou para nao_marcou diretamente');

  status = alternarStatus(status, 'nao_marcou');
  assert(status === null, 'Clicar novamente em nao_marcou desmarca para null');
}

// 6. OBSERVACAO COM 501 CARACTERES REJEITADA
console.log('\n--- CENARIO 6: Observacao com 501 caracteres rejeitada ---');
{
  const obs500 = 'A'.repeat(500);
  const res500 = validarObservacao(obs500);
  assert(res500.valida === true && res500.valor?.length === 500, 'Observacao com 500 caracteres e valida');

  const obs501 = 'A'.repeat(501);
  const res501 = validarObservacao(obs501);
  assert(res501.valida === false, 'Observacao com 501 caracteres e rejeitada');
  assert(Boolean(res501.erro?.includes('500')), 'Retorna mensagem de erro citando limite de 500');

  let erroPayloadCapturado = false;
  try {
    const itensComObsInvalida: ControleItem[] = [
      {
        id: '1',
        origem: 'mensal',
        dia_semana: 'QUINTA',
        horario: '08:00',
        paciente: 'Paciente Teste',
        observacao: obs501
      }
    ];
    montarPayloadSalvar('turma-t1', '2026-11-01', itensComObsInvalida);
  } catch (err) {
    erroPayloadCapturado = true;
  }
  assert(erroPayloadCapturado, 'montarPayloadSalvar lanca erro ao receber item com observacao > 500 caracteres');
}

// 7. AVULSO REMOVIVEL E MENSAL/FIXA NAO
console.log('\n--- CENARIO 7: Avulso removivel e Mensal/Fixa nao ---');
{
  const itemAvulso: ControleItem = {
    id: 'a1',
    origem: 'avulso',
    dia_semana: 'QUINTA',
    horario: '08:00',
    paciente: 'Paciente Avulso'
  };

  const itemMensal: ControleItem = {
    id: 'm1',
    origem: 'mensal',
    dia_semana: 'QUINTA',
    horario: '08:00',
    paciente: 'Paciente Mensal'
  };

  const itemFixa: ControleItem = {
    id: 'f1',
    origem: 'fixa',
    dia_semana: 'QUINTA',
    horario: '08:00',
    paciente: 'Paciente Fixa'
  };

  assert(podeRemoverItem(itemAvulso) === true, 'Paciente de origem avulso PODE ser removido');
  assert(podeRemoverItem(itemMensal) === false, 'Paciente de origem mensal NAO pode ser removido');
  assert(podeRemoverItem(itemFixa) === false, 'Paciente de origem fixa NAO pode ser removido');
}

// 8. CONTADORES
console.log('\n--- CENARIO 8: Calculo dos contadores mensais ---');
{
  const listaContagem: ControleItem[] = [
    { id: '1', origem: 'mensal', dia_semana: 'QUINTA', horario: '08:00', paciente: 'P1', status: 'atendido' },
    { id: '2', origem: 'mensal', dia_semana: 'QUINTA', horario: '08:45', paciente: 'P2', status: 'faltou' },
    { id: '3', origem: 'mensal', dia_semana: 'QUINTA', horario: '09:30', paciente: 'P3', status: 'faltou' },
    { id: '4', origem: 'fixa', dia_semana: 'SEXTA', horario: '08:00', paciente: 'P4', status: 'desmarcou' },
    { id: '5', origem: 'avulso', dia_semana: 'SEXTA', horario: '08:45', paciente: 'P5', status: 'nao_marcou' },
    { id: '6', origem: 'mensal', dia_semana: 'SABADO', horario: '08:00', paciente: 'P6', status: null },
    { id: '7', origem: 'mensal', dia_semana: 'SABADO', horario: '08:45', paciente: 'P7', status: undefined },
    { id: '8', origem: 'avulso', dia_semana: 'SABADO', horario: '09:30', paciente: 'P8' }
  ];

  const contadores = calcularContadoresControle(listaContagem);
  assert(contadores.atendidos === 1, 'Contador de atendidos e 1');
  assert(contadores.faltaram === 2, 'Contador de faltaram e 2');
  assert(contadores.desmarcaram === 1, 'Contador de desmarcaram e 1');
  assert(contadores.naoMarcaram === 1, 'Contador de nao marcaram e 1');
  assert(contadores.pendentes === 3, 'Contador de pendentes e 3 (inclui null, undefined e ausente)');
  assert(contadores.total === 8, 'Total de pacientes e 8');
}

// 9. PAYLOAD PARA SALVAR
console.log('\n--- CENARIO 9: Montagem do payload de salvamento ---');
{
  const itensPayload: ControleItem[] = [
    {
      id: 'item-1',
      origem: 'mensal',
      dia_semana: 'QUINTA',
      horario: '08:00',
      paciente: ' Ana Clara ',
      aluno_nome: 'Gabriel',
      status: 'atendido',
      observacao: 'Compareceu pontualmente'
    },
    {
      id: 'item-2',
      origem: 'avulso',
      dia_semana: 'QUINTA',
      horario: '08:45',
      paciente: 'Carlos Santos',
      aluno_nome: null,
      status: null,
      observacao: null
    }
  ];

  const payload = montarPayloadSalvar(
    '00000000-0000-0000-0000-000000000001',
    '2026-11',
    itensPayload,
    '2026-11-01T10:00:00.000Z'
  );

  assert(payload.p_turma_id === '00000000-0000-0000-0000-000000000001', 'p_turma_id correto');
  assert(payload.p_mes === '2026-11-01', 'p_mes normalizado para 2026-11-01');
  assert(payload.p_importado_em === '2026-11-01T10:00:00.000Z', 'p_importado_em preservado');
  assert(payload.p_itens.length === 2, 'Contem 2 itens no payload');
  assert(payload.p_itens[0].paciente === 'Ana Clara', 'Trim no nome do paciente');
  assert(payload.p_itens[0].ordem === 1, 'Ordem 1 atribuida');
  assert(payload.p_itens[1].ordem === 2, 'Ordem 2 atribuida');
  assert(payload.p_itens[0].status === 'atendido', 'Status atendido preservado');
  assert(payload.p_itens[1].status === null, 'Status null preservado');
}

console.log('\n================================================================');
console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram (${failedTests} falhas)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
