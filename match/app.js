/* LUMISS · /match do evento da Shopee (04/11/2026) — o cadastro no tablet do estande. Sem bibliotecas, sem Apps Script.
   Os passos: 1. a numeração · 2. os 5 favoritos (dos 20) · 3. o cadastro (nome, @ da Shopee, formato, aceite) · a tela final:
   o "recebido" e a brincadeira "qual dos 5 é a sua cara" (3 perguntas de toque; a resposta NÃO é enviada nem guardada).
   O cadastro vai para o LUMISS OS pelo comum/cadastro.js: guardado no tablet ANTES de enviar e reenviado sozinho.
   Sem WhatsApp, sem celular, sem faixa de seguidores (a Shopee não quer que se peça o celular). */
(function () {
  'use strict';

  var C = window.LUMISS_MATCH;
  var OS = window.CadastroOS;
  var QUANTOS = C.quantos;
  var TEMPOS = C.tempos;
  var PERFIL_RE = /^[a-z0-9._-]{2,40}$/;
  var MSG_EMAIL = 'Este campo é o @ do seu perfil (ex.: @maria.calcados), não o e-mail.';
  var PERGUNTAS = [
    { chave: 'ocasiao', texto: 'Seu fim de semana: praia ou balada?', opcoes: [['praia', 'Praia'], ['balada', 'Balada']] },
    { chave: 'altura', texto: 'Salto ou pé no chão?', opcoes: [['salto', 'Salto'], ['chao', 'Pé no chão']] },
    { chave: 'tom', texto: 'Dourado ou nude?', opcoes: [['dourado', 'Dourado'], ['nude', 'Nude']] }
  ];

  /* ------------------------------------------------------------ utilidades */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function focar(el) { if (!el) return; try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  var avisoTimer = null;
  function aviso(msg) {
    var el = $('#aviso');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }
  /* O e-mail no campo do @ (a mesma regra do OS e do comum/cadastro.js). */
  function pareceEmail(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/^@+/, '');
    return s.indexOf('/') < 0 && /^[^@]+@/.test(s);
  }
  function produto(codigo) {
    for (var i = 0; i < C.produtos.length; i++) if (C.produtos[i].codigo === codigo) return C.produtos[i];
    return null;
  }
  function foto(p) { return 'produtos/' + p.foto; }

  /* ------------------------------------------------------------ estado */
  var F = document.getElementById('formulario');
  var E = { tela: 'tela-inicio', passo: 0, numero: '', favoritos: [], enviando: false, sessao: 0, jogo: { i: 0, respostas: {} } };

  /* ------------------------------------------------------------ telas */
  var TELAS = ['tela-inicio', 'passo-1', 'passo-2', 'passo-3', 'tela-final'];
  function mostrar(id) {
    TELAS.forEach(function (t) { document.getElementById(t).hidden = t !== id; });
    E.tela = id;
    $('#aviso').hidden = true;
    window.scrollTo(0, 0);
    $$('.passo-corpo').forEach(function (c) { c.scrollTop = 0; });
    reiniciarInatividade();
  }
  function irPasso(n) {
    E.passo = n;
    mostrar('passo-' + n);
    if (n === 3) focar($('#f-nome'));
    else focar($('#passo-' + n + ' .passo-titulo'));
  }

  /* ------------------------------------------------------------ passo 1 e 2 */
  function renderizarNumeros() {
    $('#lista-numeros').innerHTML = C.numeros.map(function (n) {
      return '<label class="chip"><input type="radio" name="numero" value="' + esc(n) + '"' + (E.numero === n ? ' checked' : '') + '><span>' + esc(n) + '</span></label>';
    }).join('');
  }
  /* Os 20 modelos: desenhados UMA vez (as fotos não piscam a cada toque); depois, só a marcação muda. */
  function renderizarProdutos() {
    if (!$('#lista-produtos').children.length) {
      $('#lista-produtos').innerHTML = C.produtos.map(function (p) {
        return '<label class="produto">' +
          '<input type="checkbox" name="favoritos" value="' + esc(p.codigo) + '" aria-label="' + esc(p.nome) + '">' +
          '<span class="produto-caixa"><span class="produto-foto"><img src="' + esc(foto(p)) + '" alt="" decoding="async"><span class="marca-fav" aria-hidden="true">♥</span></span>' +
          '<span class="produto-nome">' + esc(p.nome) + '</span></span></label>';
      }).join('');
    }
    var cheio = E.favoritos.length >= QUANTOS;
    $$('#lista-produtos .produto').forEach(function (l) {
      var i = l.querySelector('input');
      var marcado = E.favoritos.indexOf(i.value) !== -1;
      i.checked = marcado;
      l.classList.toggle('produto-cheio', cheio && !marcado);
    });
    var c = $('#contador-favoritos');
    c.textContent = E.favoritos.length + ' de ' + QUANTOS;
    c.classList.toggle('completo', cheio);
  }

  /* ------------------------------------------------------------ validação */
  function limparErros(escopo) {
    $$('.erro', escopo).forEach(function (e) { e.hidden = true; e.textContent = ''; });
    $$('.com-erro', escopo).forEach(function (c) { c.classList.remove('com-erro'); });
  }
  function mostrarErro(campo, msg) {
    var p = $('[data-erro="' + campo + '"]');
    if (p) { p.textContent = msg; p.hidden = false; }
    var c = $('[data-campo="' + campo + '"]');
    if (c) c.classList.add('com-erro');
  }
  function radio(nome) { var r = F.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : ''; }

  function validar(n) {
    var erros = [];
    if (n === 1) {
      if (!E.numero) erros.push(['numero', 'Toque na sua numeração.']);
    } else if (n === 2) {
      if (E.favoritos.length !== QUANTOS) erros.push(['favoritos', 'Marque ' + QUANTOS + ' modelos (faltam ' + (QUANTOS - E.favoritos.length) + ').']);
    } else if (n === 3) {
      var nome = OS.normalizarNome($('#f-nome').value);
      if (nome.length < 2) erros.push(['nome', 'Escreva o seu nome.']);
      else if (nome.length > 120) erros.push(['nome', 'O nome vai até 120 letras.']);
      var bruto = $('#f-perfil').value;
      if (pareceEmail(bruto)) erros.push(['perfil', MSG_EMAIL]);
      else if (!PERFIL_RE.test(OS.normalizarPerfil(bruto))) erros.push(['perfil', 'O @ só pode ter letras sem acento, números, ponto e sublinhado.']);
      if (!radio('formato')) erros.push(['formato', 'Toque em live, vídeo ou os dois.']);
      if (!$('#f-aceite').checked) erros.push(['aceite', 'Para enviar, marque o aceite.']);
    }
    var tela = document.getElementById('passo-' + n);
    limparErros(tela);
    erros.forEach(function (e) { mostrarErro(e[0], e[1]); });
    if (erros.length) {
      var alvo = $('[data-campo="' + erros[0][0] + '"]');
      if (alvo) { try { alvo.scrollIntoView({ block: 'center' }); } catch (e) { /* sem rolagem */ } focar(alvo.querySelector('input[type=text]')); }
    }
    return !erros.length;
  }

  /* ------------------------------------------------------------ eventos */
  $('#botao-comecar').addEventListener('click', function () { irPasso(1); });
  $$('[data-avancar]').forEach(function (b) {
    b.addEventListener('click', function () { if (validar(E.passo)) irPasso(E.passo + 1); });
  });
  $$('[data-voltar]').forEach(function (b) {
    b.addEventListener('click', function () { if (E.passo <= 1) recomecar(); else irPasso(E.passo - 1); });
  });

  F.addEventListener('change', function (ev) {
    var t = ev.target;
    var c = t.closest('[data-campo]');
    if (c) { c.classList.remove('com-erro'); var p = c.querySelector('.erro'); if (p) p.hidden = true; }
    if (t.name === 'numero') {
      E.numero = t.value;
    } else if (t.name === 'favoritos') {
      if (t.checked) {
        if (E.favoritos.length >= QUANTOS) { t.checked = false; aviso('São ' + QUANTOS + '. Desmarque um para trocar.'); return; }
        E.favoritos.push(t.value);
      } else {
        E.favoritos = E.favoritos.filter(function (x) { return x !== t.value; });
      }
      renderizarProdutos();
    }
  });
  F.addEventListener('input', function (ev) {
    var c = ev.target.closest('[data-campo]');
    if (c && c.classList.contains('com-erro')) { c.classList.remove('com-erro'); var p = c.querySelector('.erro'); if (p) p.hidden = true; }
  });
  $('#f-perfil').addEventListener('blur', function () { if (!pareceEmail(this.value)) this.value = OS.normalizarPerfil(this.value); });

  /* O Enter do teclado do tablet: avança. No nome, vai para o @; no resto do cadastro, envia (ou mostra o que falta). */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    if (!$('#regulamento').hidden || !$('#aviso-inatividade').hidden) return;
    var alvo = ev.target;
    if (alvo && alvo.tagName === 'BUTTON') return; // o botão em foco faz o clique dele
    if (E.tela === 'tela-inicio') { ev.preventDefault(); irPasso(1); return; }
    if (E.tela === 'passo-1' || E.tela === 'passo-2') { ev.preventDefault(); if (validar(E.passo)) irPasso(E.passo + 1); return; }
    if (E.tela === 'passo-3') {
      ev.preventDefault();
      if (alvo && alvo.id === 'f-nome') { focar($('#f-perfil')); return; }
      if (F.requestSubmit) F.requestSubmit(); else $('#botao-enviar').click();
    }
  });

  $('#abrir-regulamento').addEventListener('click', function (ev) { ev.preventDefault(); $('#regulamento').hidden = false; focar($('#fechar-regulamento')); });
  $('#fechar-regulamento').addEventListener('click', function () { $('#regulamento').hidden = true; });

  /* ------------------------------------------------------------ o envio */
  F.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (E.passo !== 3 || E.enviando) return;
    if (!validar(3)) return;
    E.enviando = true;
    $('#botao-enviar').disabled = true;
    var dados = {
      canal: C.canal,
      nome: OS.normalizarNome($('#f-nome').value),
      perfil: OS.normalizarPerfil($('#f-perfil').value),
      aceite: true,
      origem: C.origem,
      match: { pares: E.favoritos.slice(), numeracao: Number(E.numero), formato: radio('formato') }
    };
    var isca = F.elements.empresa.value;
    if (isca) dados.empresa = isca;
    var minha = E.sessao;
    var pares = dados.match.pares.slice();
    mostrarFinal(pares);
    statusDoEnvio(null);
    OS.enviar(C.cadastroUrl, dados, function (depois) { if (E.sessao === minha) statusDoEnvio(depois); })
      .then(function (r) { if (E.sessao === minha) statusDoEnvio(r); });
  });

  function statusDoEnvio(r) {
    var el = $('#final-envio');
    el.classList.remove('pendente', 'recusado');
    if (!r) { el.textContent = 'Enviando…'; return; }
    if (r.estado === 'confirmado') {
      $('#final-titulo').textContent = 'Cadastro recebido!';
      el.textContent = 'Tudo certo: o seu cadastro chegou à LUMISS.';
    } else if (r.estado === 'guardado') {
      $('#final-titulo').textContent = 'Cadastro recebido!';
      el.textContent = 'A internet está lenta: o cadastro ficou guardado neste tablet e vai sozinho.';
      el.classList.add('pendente');
    } else {
      $('#final-titulo').textContent = 'Quase lá';
      el.textContent = 'O cadastro não passou (' + (r.mensagem || 'confira os dados') + '). Chame a equipe LUMISS e faça de novo.';
      el.classList.add('recusado');
    }
  }

  /* ------------------------------------------------------------ a tela final e a brincadeira */
  function mostrarFinal(pares) {
    E.jogo = { i: 0, respostas: {}, pares: pares };
    $('#final-titulo').textContent = 'Cadastro recebido!';
    $('#resultado').hidden = true;
    $('#jogo').hidden = false;
    pararContagemFinal();
    mostrar('tela-final');
    renderizarPergunta();
    focar($('#final-titulo'));
  }
  function renderizarPergunta() {
    var q = PERGUNTAS[E.jogo.i];
    $('#jogo-contador').textContent = 'Pergunta ' + (E.jogo.i + 1) + ' de ' + PERGUNTAS.length;
    $('#jogo-pergunta').textContent = q.texto;
    $('#jogo-opcoes').innerHTML = q.opcoes.map(function (o) {
      return '<button type="button" class="botao botao-secundario" data-resposta="' + esc(o[0]) + '">' + esc(o[1]) + '</button>';
    }).join('');
  }
  $('#jogo-opcoes').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-resposta]');
    if (!b) return;
    E.jogo.respostas[PERGUNTAS[E.jogo.i].chave] = b.getAttribute('data-resposta');
    E.jogo.i += 1;
    if (E.jogo.i < PERGUNTAS.length) renderizarPergunta(); else revelar();
  });

  /* Vence o par com mais marcas iguais às respostas; no empate, o primeiro dos 5 (a ordem em que ela marcou). */
  function parDaCara(pares, respostas) {
    var melhor = null;
    var pontos = -1;
    pares.forEach(function (codigo) {
      var p = produto(codigo);
      if (!p) return;
      var n = PERGUNTAS.reduce(function (s, q) { return s + (p[q.chave] === respostas[q.chave] ? 1 : 0); }, 0);
      if (n > pontos) { pontos = n; melhor = p; }
    });
    return melhor;
  }

  function revelar() {
    var p = parDaCara(E.jogo.pares, E.jogo.respostas);
    $('#jogo').hidden = true;
    $('#jogo-opcoes').innerHTML = '';
    if (!p) { iniciarContagemFinal(); return; }
    var estilo = C.estilos[p.ocasiao + '|' + p.altura + '|' + p.tom] || { nome: 'Do seu jeito', frase: 'Um par que é a sua cara.' };
    $('#resultado-foto').innerHTML = '<img src="' + esc(foto(p)) + '" alt="' + esc(p.nome) + '">';
    $('#resultado-estilo').textContent = estilo.nome;
    $('#resultado-frase').textContent = estilo.frase;
    $('#resultado-modelo').textContent = 'Dos seus 5 favoritos, o que é a sua cara: ' + p.nome + '.';
    $('#resultado').hidden = false;
    iniciarContagemFinal();
  }

  /* ------------------------------------------------------------ recomeçar (nada da anterior fica na tela) */
  var relogioInatividade = null;
  var contagemAviso = null;
  var contagemFinal = null;

  function recomecar() {
    E.sessao += 1; // uma resposta atrasada do envio anterior não escreve na tela da próxima
    clearInterval(contagemAviso);
    $('#aviso-inatividade').hidden = true;
    $('#regulamento').hidden = true;
    pararContagemFinal();
    F.reset();
    E.passo = 0;
    E.numero = '';
    E.favoritos = [];
    E.enviando = false;
    E.jogo = { i: 0, respostas: {} };
    $('#botao-enviar').disabled = false;
    limparErros(document);
    ['#final-envio', '#jogo-contador', '#jogo-pergunta', '#resultado-estilo', '#resultado-frase', '#resultado-modelo']
      .forEach(function (s) { $(s).textContent = ''; });
    $('#jogo-opcoes').innerHTML = '';
    $('#resultado-foto').innerHTML = '';
    $('#final-envio').classList.remove('pendente', 'recusado');
    renderizarNumeros();
    renderizarProdutos();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (E.recarregarDepois) { location.reload(); return; }
    mostrar('tela-inicio');
    if (swRegistro) swRegistro.update().catch(function () {});
  }
  $('#botao-proxima').addEventListener('click', recomecar);

  function iniciarContagemFinal() {
    pararContagemFinal();
    var restam = Math.round(TEMPOS.final / 1000);
    var el = $('#final-contagem');
    el.textContent = 'A tela recomeça em ' + restam + ' s.';
    contagemFinal = setInterval(function () {
      restam -= 1;
      el.textContent = 'A tela recomeça em ' + Math.max(0, restam) + ' s.';
      if (restam <= 0) recomecar();
    }, 1000);
  }
  function pararContagemFinal() { clearInterval(contagemFinal); contagemFinal = null; $('#final-contagem').textContent = ''; }

  /* Sem toque no meio do cadastro (ou da brincadeira): "Ainda está aí?" e, sem resposta, recomeça. */
  function reiniciarInatividade() {
    clearTimeout(relogioInatividade);
    if (E.tela === 'tela-inicio' || contagemFinal) return;
    relogioInatividade = setTimeout(mostrarInatividade, TEMPOS.inatividade);
  }
  function mostrarInatividade() {
    var restam = Math.round(TEMPOS.aviso / 1000);
    $('#inatividade-segundos').textContent = restam;
    $('#aviso-inatividade').hidden = false;
    focar($('#botao-continuar'));
    clearInterval(contagemAviso);
    contagemAviso = setInterval(function () {
      restam -= 1;
      $('#inatividade-segundos').textContent = Math.max(0, restam);
      if (restam <= 0) recomecar();
    }, 1000);
  }
  $('#botao-continuar').addEventListener('click', function () { clearInterval(contagemAviso); $('#aviso-inatividade').hidden = true; reiniciarInatividade(); });
  $('#botao-recomecar').addEventListener('click', recomecar);
  ['pointerdown', 'keydown', 'input', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function () { if ($('#aviso-inatividade').hidden) reiniciarInatividade(); }, { passive: true, capture: true });
  });

  /* Tela cheia: esconde a barra do navegador do tablet. */
  var botaoTelaCheia = $('#botao-telacheia');
  function emTelaCheia() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  botaoTelaCheia.addEventListener('click', function () {
    try {
      if (emTelaCheia()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { var el = document.documentElement; var r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(function () {}); }
    } catch (e) { /* sem tela cheia */ }
  });

  /* ------------------------------------------------------------ funcionar sem internet */
  var swRegistro = null;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    var tinhaControle = !!navigator.serviceWorker.controller;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (r) { swRegistro = r; }).catch(function () {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!tinhaControle) { tinhaControle = true; return; }
      if (E.tela === 'tela-inicio') location.reload(); else E.recarregarDepois = true;
    });
  }

  /* ------------------------------------------------------------ partida */
  renderizarNumeros();
  renderizarProdutos();
  mostrar('tela-inicio');
  window.__lumiss = { estado: E, recomecar: recomecar, parDaCara: parDaCara, pendentes: OS.pendentes };
})();
