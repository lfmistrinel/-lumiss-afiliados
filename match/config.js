/* LUMISS · /match do evento da Shopee (04/11/2026) — a configuração do site, CONGELADA.
   Sem Apps Script (Luis, 04/11: "pelo app fica tudo bugado"): os 20 pares são os MESMOS do Match de Verão (28/09/2026), lidos
   UMA vez da planilha em 04/11/2026 01:28 e copiados para cá; as fotos estão em match/produtos/.
   O cadastro vai para o LUMISS OS (a porta das afiliadas) pelo comum/cadastro.js — guardado no tablet antes de enviar.

   AS MARCAS da brincadeira "qual dos 5 é a sua cara", tiradas do nome do produto:
     ocasiao: 'praia' ou 'balada'   altura: 'salto' ou 'chao' (pé no chão)   tom: 'dourado' ou 'nude'
   As marcadas com "chute:" o nome não dizia — é a mais provável; o Luis confere. */
window.LUMISS_MATCH = {
  // O cadastro vai para o LUMISS OS — não mexer. (O servidor local de teste troca este endereço pelo da API local.)
  cadastroUrl: 'https://app.lumiss.com.br/api/afiliadas/cadastro',
  canal: 'shopee',
  origem: 'match-tablet-0411',

  numeros: ['34', '35', '36', '37', '38', '39', '40'],
  quantos: 5,

  tempos: {
    inatividade: 90000, // sem toque no meio do cadastro: "Ainda está aí?"
    aviso: 15000,       // depois da pergunta, recomeça
    final: 25000        // a tela do resultado recomeça sozinha
  },

  produtos: [
    { codigo: 'SG7',    nome: 'Salto bloco dourado',          foto: 'SG7.png',    ocasiao: 'balada', altura: 'salto', tom: 'dourado' },
    { codigo: 'MEL3',   nome: 'Rasteira de dedo',             foto: 'MEL3.png',   ocasiao: 'praia',  altura: 'chao',  tom: 'nude' },    // chute: tom
    { codigo: 'LARA2',  nome: 'Anabela piton cobra',          foto: 'LARA2.png',  ocasiao: 'balada', altura: 'salto', tom: 'dourado' }, // chute: ocasião
    { codigo: 'TATI1',  nome: 'Salto taça alto',              foto: 'TATI1.png',  ocasiao: 'balada', altura: 'salto', tom: 'nude' },    // chute: tom
    { codigo: 'TATI2',  nome: 'Salto taça piton',             foto: 'TATI2.jpg',  ocasiao: 'balada', altura: 'salto', tom: 'nude' },
    { codigo: 'LILA1',  nome: 'Flatform brilho strass',       foto: 'LILA1.png',  ocasiao: 'balada', altura: 'chao',  tom: 'dourado' }, // chute: tom (strass)
    { codigo: 'DUDA1',  nome: 'Sapatilha Mary Jane',          foto: 'DUDA1.png',  ocasiao: 'praia',  altura: 'chao',  tom: 'dourado' }, // chute: ocasião
    { codigo: 'CH3',    nome: 'Scarpin slingback tela',       foto: 'CH3.png',    ocasiao: 'balada', altura: 'salto', tom: 'nude' },    // chute: tom
    { codigo: 'JELLY1', nome: 'Jelly tira transparente',      foto: 'JELLY1.png', ocasiao: 'praia',  altura: 'chao',  tom: 'nude' },
    { codigo: 'JELLY3', nome: 'Anabela jelly transparente',   foto: 'JELLY3.jpg', ocasiao: 'praia',  altura: 'salto', tom: 'nude' },    // chute: tom
    { codigo: 'ROSA1',  nome: 'Salto alto fivela',            foto: 'ROSA1.png',  ocasiao: 'balada', altura: 'salto', tom: 'dourado' },
    { codigo: 'ROSA2',  nome: 'Salto alto dedo',              foto: 'ROSA2.png',  ocasiao: 'balada', altura: 'salto', tom: 'dourado' },
    { codigo: 'DORA1',  nome: 'Flatform pedras douradas',     foto: 'DORA1.png',  ocasiao: 'praia',  altura: 'chao',  tom: 'dourado' }, // chute: ocasião
    { codigo: 'DORA2',  nome: 'Flatform corrente dourada',    foto: 'DORA2.png',  ocasiao: 'balada', altura: 'chao',  tom: 'dourado' }, // chute: ocasião
    { codigo: 'IRIS1',  nome: 'Salto baixo pedras',           foto: 'IRIS1.png',  ocasiao: 'praia',  altura: 'salto', tom: 'dourado' }, // chute: ocasião
    { codigo: 'GIN5',   nome: 'Rasteira de juta',             foto: 'GIN5.jpg',   ocasiao: 'praia',  altura: 'chao',  tom: 'nude' },
    { codigo: 'GIN7',   nome: 'Rasteira enfeite metalizado',  foto: 'GIN7.jpg',   ocasiao: 'praia',  altura: 'chao',  tom: 'dourado' },
    { codigo: 'TAM3',   nome: 'Tamanco flatform juta',        foto: 'TAM3.jpg',   ocasiao: 'praia',  altura: 'chao',  tom: 'nude' },
    { codigo: 'SG3',    nome: 'Salto baixo metalizado',       foto: 'SG3.png',    ocasiao: 'balada', altura: 'salto', tom: 'dourado' },
    { codigo: 'MEL2',   nome: 'Rasteira estilo fisherman',    foto: 'MEL2.png',   ocasiao: 'praia',  altura: 'chao',  tom: 'nude' }
  ],

  // O nome do estilo e a frase do resultado, pelas 3 marcas do par revelado.
  estilos: {
    'praia|chao|nude':      { nome: 'Natural Chic',       frase: 'Leveza de quem vive com o pé na areia e ainda arrasa no look.' },
    'praia|chao|dourado':   { nome: 'Sol Dourado',        frase: 'Brilho na medida certa pra roubar a cena até no pôr do sol.' },
    'praia|salto|nude':     { nome: 'Verão Elegante',     frase: 'Do almoço na orla ao fim de tarde, sempre impecável.' },
    'praia|salto|dourado':  { nome: 'Riviera',            frase: 'Férias de novela: um toque de dourado e muita atitude.' },
    'balada|chao|nude':     { nome: 'Conforto Fashion',   frase: 'Dança a noite inteira sem abrir mão do estilo.' },
    'balada|chao|dourado':  { nome: 'Brilho Sem Esforço', frase: 'Chega brilhando e ainda sai dançando no fim da festa.' },
    'balada|salto|nude':    { nome: 'Clássica Moderna',   frase: 'Elegância que não sai de moda — e todo mundo repara.' },
    'balada|salto|dourado': { nome: 'Diva da Noite',      frase: 'Quando você chega, a pista acende. Nasceu pra brilhar.' }
  }
};
