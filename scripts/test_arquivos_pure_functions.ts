import {
  podeAbrirNoNavegador,
  sanitizarNomeArquivo,
  gerarCaminhoStorage,
  inferirContentType,
  extrairExtensao
} from '../src/lib/arquivosTypes';

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
// 1. TESTES DE podeAbrirNoNavegador
// ------------------------------------------------------------------------------
it('podeAbrirNoNavegador: pdf e PDF devem retornar true', () => {
  expectTrue(podeAbrirNoNavegador('documento.pdf'), 'pdf minusculo');
  expectTrue(podeAbrirNoNavegador('DOCUMENTO.PDF'), 'PDF maiusculo');
  expectTrue(podeAbrirNoNavegador('relatorio.final.Pdf'), 'Pdf misto');
});

it('podeAbrirNoNavegador: imagens permitidas (png, jpg, jpeg, gif, webp, bmp)', () => {
  expectTrue(podeAbrirNoNavegador('foto.png'));
  expectTrue(podeAbrirNoNavegador('foto.jpg'));
  expectTrue(podeAbrirNoNavegador('foto.jpeg'));
  expectTrue(podeAbrirNoNavegador('animacao.gif'));
  expectTrue(podeAbrirNoNavegador('imagem.webp'));
  expectTrue(podeAbrirNoNavegador('grafico.bmp'));
});

it('podeAbrirNoNavegador: audios e videos permitidos (mp3, mp4, webm)', () => {
  expectTrue(podeAbrirNoNavegador('audio.mp3'));
  expectTrue(podeAbrirNoNavegador('video.mp4'));
  expectTrue(podeAbrirNoNavegador('midia.webm'));
});

it('podeAbrirNoNavegador: formatos que NAO devem abrir no navegador', () => {
  expectFalse(podeAbrirNoNavegador('documento.docx'), 'docx');
  expectFalse(podeAbrirNoNavegador('texto.txt'), 'txt');
  expectFalse(podeAbrirNoNavegador('dados.csv'), 'csv');
  expectFalse(podeAbrirNoNavegador('pagina.html'), 'html');
  expectFalse(podeAbrirNoNavegador('pagina.htm'), 'htm');
  expectFalse(podeAbrirNoNavegador('vetor.svg'), 'svg');
  expectFalse(podeAbrirNoNavegador('dados.xml'), 'xml');
  expectFalse(podeAbrirNoNavegador('script.js'), 'js');
  expectFalse(podeAbrirNoNavegador('planilha.xlsx'), 'xlsx');
  expectFalse(podeAbrirNoNavegador('arquivo_sem_extensao'), 'sem extensao');
  expectFalse(podeAbrirNoNavegador(''), 'string vazia');
});

// ------------------------------------------------------------------------------
// 2. TESTES DE sanitizarNomeArquivo
// ------------------------------------------------------------------------------
it('sanitizarNomeArquivo: normaliza NFD e remove acentos', () => {
  expectEqual(sanitizarNomeArquivo('relatório_médico.pdf'), 'relatorio_medico.pdf');
  expectEqual(sanitizarNomeArquivo('AÇÃO_JUDICIAL.PDF'), 'ACAO_JUDICIAL.pdf');
  expectEqual(sanitizarNomeArquivo('coração_maçã_irmão.png'), 'coracao_maca_irmao.png');
});

it('sanitizarNomeArquivo: substitui espacos por underscore', () => {
  expectEqual(sanitizarNomeArquivo('meu arquivo teste.docx'), 'meu_arquivo_teste.docx');
});

it('sanitizarNomeArquivo: substitui simbolos e pontuacao fora do permitido por underscore', () => {
  expectEqual(sanitizarNomeArquivo('doc #1 (versão final)!.png'), 'doc_1_versao_final.png');
});

it('sanitizarNomeArquivo: arquivo com apenas simbolos deve se chamar arquivo', () => {
  expectEqual(sanitizarNomeArquivo('!@#$%^&*()'), 'arquivo');
  expectEqual(sanitizarNomeArquivo('   '), 'arquivo');
  expectEqual(sanitizarNomeArquivo(''), 'arquivo');
  expectEqual(sanitizarNomeArquivo('...'), 'arquivo');
  expectEqual(sanitizarNomeArquivo('___'), 'arquivo');
});

it('sanitizarNomeArquivo: trunca base em no maximo 80 caracteres', () => {
  const baseLonga = 'a'.repeat(120);
  const sanitizado = sanitizarNomeArquivo(`${baseLonga}.pdf`);
  expectEqual(sanitizado, `${'a'.repeat(80)}.pdf`);
});

it('sanitizarNomeArquivo: previne directory traversal (../../etc/passwd)', () => {
  const perigoso = '../../etc/passwd';
  const seguro = sanitizarNomeArquivo(perigoso);
  expectFalse(seguro.includes('/'), 'Nao deve conter barra normal');
  expectFalse(seguro.includes('\\'), 'Nao deve conter barra invertida');
  expectFalse(seguro.includes('..'), 'Nao deve conter ponto duplo');
  expectEqual(seguro, 'etc_passwd');
});

it('sanitizarNomeArquivo: colapsa pontos duplos ou multiplos no nome', () => {
  expectEqual(sanitizarNomeArquivo('teste..ponto...txt'), 'teste.ponto.txt');
});

it('sanitizarNomeArquivo: extensao estranha ou longa e limitada a 10 caracteres alfanumericos', () => {
  const sanitizado = sanitizarNomeArquivo('arquivo.extensao_muito_longa_12345');
  expectEqual(sanitizado, 'arquivo.extensaomu');

  const sanitizadoSimbolos = sanitizarNomeArquivo('arquivo.---');
  expectEqual(sanitizadoSimbolos, 'arquivo');
});

it('sanitizarNomeArquivo: arquivo sem extensao', () => {
  expectEqual(sanitizarNomeArquivo('arquivo_sem_extensao'), 'arquivo_sem_extensao');
});

it('sanitizarNomeArquivo: sanitiza caracteres de controle invisiveis', () => {
  const comControle = '\x00\x1f\x7f\t\n\rarquivo\x08.pdf';
  expectEqual(sanitizarNomeArquivo(comControle), 'arquivo.pdf');
});

// ------------------------------------------------------------------------------
// 3. TESTES DE gerarCaminhoStorage
// ------------------------------------------------------------------------------
it('gerarCaminhoStorage: formato final uuid/nome.ext sem barras extras nem ponto duplo', () => {
  const caminho = gerarCaminhoStorage('Meu Relatório de Teste (v1).PDF');
  const partes = caminho.split('/');
  expectEqual(partes.length, 2, 'Deve ter exatamente uma pasta (uuid) e o nome do arquivo');

  const uuid = partes[0];
  const nomeSeguro = partes[1];

  expectTrue(/^[0-9a-f-]{36}$/.test(uuid), 'Primeira parte deve ser um UUID valido');
  expectEqual(nomeSeguro, 'Meu_Relatorio_de_Teste_v1.pdf');
  expectFalse(caminho.includes('//'), 'Nao deve ter barras duplas');
  expectFalse(caminho.includes('..'), 'Nao deve ter ponto duplo');
});

it('gerarCaminhoStorage: entrada com tentativa de traversal gera caminho seguro', () => {
  const caminho = gerarCaminhoStorage('../../etc/passwd');
  expectFalse(caminho.includes('..'), 'Nao deve permitir ponto duplo');
  const partes = caminho.split('/');
  expectEqual(partes.length, 2, 'Deve manter formato pasta/arquivo');
  expectEqual(partes[1], 'etc_passwd');
});

// ------------------------------------------------------------------------------
// 4. TESTES DE inferirContentType
// ------------------------------------------------------------------------------
it('inferirContentType: infere corretamente MIME para extensoes abriveis', () => {
  expectEqual(inferirContentType('pdf'), 'application/pdf');
  expectEqual(inferirContentType('PNG'), 'image/png');
  expectEqual(inferirContentType('jpg'), 'image/jpeg');
  expectEqual(inferirContentType('jpeg'), 'image/jpeg');
  expectEqual(inferirContentType('mp4'), 'video/mp4');
  expectEqual(inferirContentType('docx'), undefined);
});

// ------------------------------------------------------------------------------
// EXECUCAO DO RUNNER
// ------------------------------------------------------------------------------
console.log('================================================================');
console.log('EXECUTANDO TESTES AUTOMATIZADOS: MODULO ARQUIVOS (FUNCOES PURAS)');
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
