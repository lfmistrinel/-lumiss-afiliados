/* LUMISS · Match de Verão — configuração do site.
   O que muda no dia a dia (proposta, comissão, compromissos, grupo de WhatsApp, numeração)
   fica na aba Config da planilha. Aqui ficam só o endereço do backend e os valores de reserva,
   usados se o aparelho abrir sem internet. */
window.LUMISS_CONFIG = {
  // Cole entre as aspas a URL do App da Web do Apps Script (termina em /exec).
  apiUrl: 'https://script.google.com/macros/s/AKfycbxBWo3vIml9UHTDxVLFdoPgEXgu0Vpnk53E4l7DH4s0P6Qzrne9YWukv6h1h4Q9tsuX/exec',

  // Tempos do modo tablet, em milissegundos.
  tempos: {
    inatividade: 90000,   // sem toque no meio do cadastro: pergunta "Ainda está aí?"
    aviso: 15000,         // depois da pergunta, recomeça
    final: 30000,         // tela final some sozinha
    equipe: 180000,       // área da equipe fecha sozinha no tablet
    atualizar: 60000,     // atualiza estoque e textos na tela inicial
    atualizarEquipe: 20000
  },

  padrao: {
    corte_tarde: '13:30',
    comissao_aberta: '',
    comissao_manha: '',
    comissao_tarde: '',
    oferta_manha: ['Amostra na hora, no seu número', 'Vídeos prontos e roteiro pra você postar', 'Atendimento direto com a equipe LUMISS'],
    oferta_tarde: ['Amostra na hora, no seu número', 'Vídeos prontos e roteiro pra você postar', 'Atendimento direto com a equipe LUMISS'],
    compromissos: ['1 vídeo em até 7 dias', '3 vídeos em até 15 dias', '1 live com a LUMISS em até 15 dias'],
    whatsapp_grupo: '',
    numeros: ['33', '34', '35', '36', '37', '38', '39', '40'],
    max_favoritos: 5
  },

  perfis: {
    'Rainha da Live': 'Você vende ao vivo. A gente monta com você uma live LUMISS com os modelos de verão.',
    'Criadora de Vídeo': 'Seu forte é vídeo. A gente te manda vídeos prontos e roteiros pra postar.',
    'Multiformato': 'Você faz de tudo: vídeo pra atrair e live pra fechar a venda.'
  }
};
