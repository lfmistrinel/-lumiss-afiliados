/* LUMISS · Match de Verão — configuração do site.
   O que muda no dia a dia (numeração, quantos favoritos, grupo de WhatsApp) fica na aba Config
   da planilha. Aqui ficam só o endereço do backend e os valores de reserva, usados se o
   aparelho abrir sem internet. */
window.LUMISS_CONFIG = {
  // Cole entre as aspas a URL do App da Web do Apps Script (termina em /exec).
  apiUrl: 'https://script.google.com/macros/s/AKfycbxBWo3vIml9UHTDxVLFdoPgEXgu0Vpnk53E4l7DH4s0P6Qzrne9YWukv6h1h4Q9tsuX/exec',

  // Tempos do modo tablet, em milissegundos.
  tempos: {
    inatividade: 90000,   // sem toque no meio do cadastro: pergunta "Ainda está aí?"
    aviso: 15000,         // depois da pergunta, recomeça
    final: 30000,         // tela final some sozinha
    equipe: 180000,       // área da equipe fecha sozinha no tablet
    atualizar: 60000,     // atualiza os modelos e textos na tela inicial
    atualizarEquipe: 20000
  },

  padrao: {
    corte_tarde: '13:30',
    whatsapp_grupo: '',
    numeros: ['34', '35', '36', '37', '38', '39', '40'],
    max_favoritos: 5
  }
};
