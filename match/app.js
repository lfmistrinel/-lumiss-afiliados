/* LUMISS · Match de Verão — cadastro de afiliadas. Sem bibliotecas externas. */
(function () {
  'use strict';

  var CFG = window.LUMISS_CONFIG || {};
  var TEMPOS = Object.assign({ inatividade: 90000, aviso: 15000, final: 30000, equipe: 180000, atualizar: 60000, atualizarEquipe: 20000 }, CFG.tempos || {});
  var PADRAO = Object.assign({ numeros: ['33', '34', '35', '36', '37', '38', '39', '40'], compromissos: [], oferta_manha: [], oferta_tarde: [], max_favoritos: 3, corte_tarde: '13:30' }, CFG.padrao || {});
  var CHAVE_FILA = 'lumiss_fila_v1';
  var CHAVE_RECUSADOS = 'lumiss_recusados_v1';
  var CHAVE_CACHE = 'lumiss_config_v1';
  var CHAVE_MODO = 'lumiss_modo';
  var CHAVE_APARELHO = 'lumiss_aparelho';
  var CHAVE_PIN = 'lumiss_pin';
  var ERROS_DEFINITIVOS = ['sem_aceite', 'validacao', 'json_invalido'];

  /* ------------------------------------------------------------ utilidades */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ler(chave, padrao) {
    try { var v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch (e) { return padrao; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }
  function apagar(chave) { try { localStorage.removeItem(chave); } catch (e) { /* sem armazenamento */ } }
  function lerSessao(chave) { try { return sessionStorage.getItem(chave) || ''; } catch (e) { return ''; } }
  function gravarSessao(chave, valor) {
    try { if (valor) sessionStorage.setItem(chave, valor); else sessionStorage.removeItem(chave); } catch (e) { /* sem armazenamento */ }
  }
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function focar(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  var avisoTimer = null;
  function aviso(msg, ms) {
    var el = $('#aviso');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { el.hidden = true; }, ms || 2800);
  }
  function horaSP() {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
        .format(new Date()).replace(/^24/, '00');
    } catch (e) {
      var d = new Date();
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
  }
  function normalizarArroba(v) {
    var s = String(v || '').trim().toLowerCase();
    var m = s.match(/tiktok\.com\/@([^\/?#\s]+)/);
    if (m) s = m[1];
    return s.replace(/^@+/, '').replace(/\s+/g, '');
  }
  function arrobaValida(s) { return /^[a-z0-9._]{2,24}$/.test(s); }
  function digitosWhats(v) {
    var d = String(v || '').replace(/\D/g, '').replace(/^0+/, '');
    if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) d = d.slice(2);
    return d;
  }
  function mascaraWhats(d) {
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7, 11);
  }
  function whatsValido(v) {
    var d = digitosWhats(v);
    return (d.length === 10 || d.length === 11) && d.charAt(0) !== '0';
  }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function perfilDe(formato) {
    if (formato === 'live') return 'Rainha da Live';
    if (formato === 'video') return 'Criadora de Vídeo';
    if (formato === 'ambos') return 'Multiformato';
    return '';
  }

  /* ------------------------------------------------------------ modo e estado */
  var params = new URLSearchParams(location.search);
  if (params.get('modo') === 'tablet') gravar(CHAVE_MODO, 'tablet');
  if (params.get('modo') === 'celular') apagar(CHAVE_MODO);
  var MODO = ler(CHAVE_MODO, '') === 'tablet' ? 'tablet' : 'celular';
  var ORIGEM = MODO === 'tablet' ? 'tablet' : (params.get('origem') === 'qr' ? 'qr' : 'celular');
  var APARELHO = ler(CHAVE_APARELHO, '');
  if (!APARELHO) {
    APARELHO = MODO + '-' + uuid().slice(0, 4).toUpperCase();
    gravar(CHAVE_APARELHO, APARELHO);
  }
  document.body.classList.remove('modo-celular', 'modo-tablet');
  document.body.classList.add('modo-' + MODO);

  var F = document.getElementById('formulario');
  var E = {
    conf: Object.assign({}, PADRAO),
    produtos: [],
    disponivel: {},
    remotoEm: 0,
    tela: 'tela-inicio',
    passo: 0,
    inicioEm: 0,
    enviando: false,
    sel: { numero: '', favoritos: [], amostra: '', compromissos: [] },
    ultimo: null,
    recarregarDepois: false,
    equipe: { pin: '', dados: null, filtro: 'todas', busca: '', aba: 'cadastros', trocando: '', confirmando: '', rascunhos: {} }
  };

  /* ------------------------------------------------------------ backend */
  function api(metodo, dados) {
    if (!CFG.apiUrl) return Promise.reject(new Error('sem_api'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, metodo === 'GET' ? 12000 : 30000);
    var url = CFG.apiUrl;
    var opcoes;
    if (metodo === 'GET') {
      var q = Object.keys(dados || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(dados[k]); });
      q.push('_=' + Date.now());
      url += (url.indexOf('?') === -1 ? '?' : '&') + q.join('&');
      opcoes = { method: 'GET', cache: 'no-store', redirect: 'follow' };
    } else {
      opcoes = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(dados), redirect: 'follow' };
    }
    if (ctrl) opcoes.signal = ctrl.signal;
    return fetch(url, opcoes).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function aplicarRemoto(r) {
    if (!r || !r.ok) return;
    E.conf = Object.assign({}, PADRAO, r.config || {});
    if (!E.conf.numeros || !E.conf.numeros.length) E.conf.numeros = PADRAO.numeros;
    E.produtos = r.produtos || [];
    E.disponivel = r.disponivel || {};
    E.remotoEm = Date.now();
    renderizarDinamicos();
  }

  function atualizarConfig() {
    return api('GET', { acao: 'config' }).then(function (r) {
      if (r && r.ok) {
        gravar(CHAVE_CACHE, r);
        aplicarRemoto(r);
        if (MODO === 'tablet') aquecerFotos();
      }
      return r;
    }).catch(function () { return null; });
  }

  function aquecerFotos() {
    E.produtos.forEach(function (p) {
      var u = fotoUrl(p);
      if (u) { var i = new Image(); i.src = u; }
    });
  }

  /* ------------------------------------------------------------ fila (funciona sem internet) */
  function fila() { return ler(CHAVE_FILA, []); }
  function enfileirar(corpo) {
    var f = fila();
    f.push({ corpo: corpo, em: Date.now() });
    if (!gravar(CHAVE_FILA, f)) E.semArmazenamento = true;
  }
  var enviandoFila = null;
  var reenvioTimer = null;
  function agendarReenvio() {
    clearTimeout(reenvioTimer);
    if (fila().length) reenvioTimer = setTimeout(enviarFila, 15000);
  }
  function enviarFila() {
    if (enviandoFila) return enviandoFila;
    var resultados = {};
    function proximo() {
      var f = fila();
      if (!f.length) return Promise.resolve(resultados);
      var item = f[0];
      return api('POST', item.corpo).then(function (r) {
        if (r && r.ok) {
          resultados[item.corpo.id] = r;
        } else if (r && ERROS_DEFINITIVOS.indexOf(r.erro) !== -1) {
          var rec = ler(CHAVE_RECUSADOS, []);
          rec.push({ corpo: item.corpo, resposta: r, em: Date.now() });
          gravar(CHAVE_RECUSADOS, rec);
          resultados[item.corpo.id] = r;
        } else {
          throw new Error((r && r.erro) || 'resposta_invalida');
        }
        gravar(CHAVE_FILA, fila().filter(function (x) { return x.corpo.id !== item.corpo.id; }));
        return proximo();
      });
    }
    enviandoFila = proximo().then(function (res) {
      enviandoFila = null;
      atualizarIndicadorFila();
      return res;
    }, function (err) {
      enviandoFila = null;
      atualizarIndicadorFila();
      agendarReenvio();
      throw err;
    });
    return enviandoFila;
  }
  window.addEventListener('online', function () { enviarFila().catch(function () {}); });
  setInterval(function () { if (fila().length) enviarFila().catch(function () {}); }, 30000);

  /* ------------------------------------------------------------ telas */
  var TELAS = ['tela-inicio', 'passo-1', 'passo-2', 'passo-3', 'passo-4', 'tela-final', 'tela-equipe'];
  function mostrar(id) {
    TELAS.forEach(function (t) {
      var el = document.getElementById(t);
      if (el) el.hidden = t !== id;
    });
    E.tela = id;
    $('#aviso').hidden = true;
    window.scrollTo(0, 0);
    reiniciarRelogioInatividade();
  }

  function irPasso(n, semHistorico) {
    E.passo = n;
    mostrar('passo-' + n);
    if (n === 3) {
      renderizarPasso3();
      if (Date.now() - E.remotoEm > 20000) {
        $('#aviso-atualizando').hidden = !CFG.apiUrl;
        atualizarConfig().then(function () { $('#aviso-atualizando').hidden = true; });
      }
    }
    if (n === 4) renderizarOferta();
    if (!semHistorico) {
      try { history.pushState({ passo: n }, ''); } catch (e) { /* sem histórico */ }
    }
    focar($('#passo-' + n + ' .passo-titulo'));
  }

  function mostrarInicio() {
    E.passo = 0;
    mostrar('tela-inicio');
  }

  window.addEventListener('popstate', function (ev) {
    if (E.tela === 'tela-equipe') return;
    if (E.tela === 'tela-final') { recomecar(); return; }
    var p = ev.state && ev.state.passo;
    if (p) irPasso(p, true); else mostrarInicio();
  });

  /* ------------------------------------------------------------ renderização */
  function numeros() { return E.conf.numeros && E.conf.numeros.length ? E.conf.numeros : PADRAO.numeros; }
  function disp(codigo, numero) {
    var d = E.disponivel[codigo];
    return d && d[numero] ? d[numero] : 0;
  }
  function temEstoque() { return E.remotoEm > 0; }
  /** Quando a Config traz amostra_modelo, todas levam o mesmo par e ela não escolhe nada. */
  function amostraFixa() {
    var c = E.conf.amostra_modelo;
    return c && produto(c) ? c : '';
  }
  function produto(codigo) {
    for (var i = 0; i < E.produtos.length; i++) if (E.produtos[i].codigo === codigo) return E.produtos[i];
    return null;
  }
  function nomeProduto(codigo) { var p = produto(codigo); return p ? p.nome : (codigo || ''); }
  function fotoUrl(p) {
    var f = (p && p.foto) || '';
    if (!f) return '';
    return /^https?:\/\//.test(f) ? f : 'produtos/' + f;
  }
  function imagem(p, classe) {
    var u = fotoUrl(p);
    return (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async"' + (classe ? ' class="' + classe + '"' : '') + '>' : '') +
      '<span class="sem-foto"' + (u ? ' hidden' : '') + '>' + esc(p ? p.nome : '') + '</span>';
  }
  function cuidarFotos(caixa) {
    $$('img', caixa).forEach(function (img) {
      function falhou() {
        var alt = img.parentNode && img.parentNode.querySelector('.sem-foto');
        img.remove();
        if (alt) alt.hidden = false;
      }
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) falhou();
      else img.addEventListener('error', falhou);
    });
  }

  function renderizarVitrine() {
    var box = $('#vitrine');
    // só mostra a vitrine quando existe foto: quadro branco vazio no preto fica feio
    var comFoto = E.produtos.filter(function (p) { return !!fotoUrl(p); }).slice(0, 4);
    box.hidden = !comFoto.length;
    box.innerHTML = comFoto.map(function (p) {
      return '<div class="vitrine-item"><img src="' + esc(fotoUrl(p)) + '" alt=""></div>';
    }).join('');
    $$('img', box).forEach(function (img) {
      img.addEventListener('error', function () {
        var item = img.parentNode;
        img.remove();
        if (item) item.remove();
        if (!$$('.vitrine-item', box).length) box.hidden = true;
      });
    });
  }

  function renderizarNumeros() {
    var box = $('#lista-numeros');
    var fixa = amostraFixa();
    box.innerHTML = numeros().map(function (n) {
      var total = 0;
      if (fixa) total = disp(fixa, n);
      else E.produtos.forEach(function (p) { total += disp(p.codigo, n); });
      var esgotado = temEstoque() && E.produtos.length && total === 0;
      return '<label class="chip"><input type="radio" name="numero" value="' + esc(n) + '"' + (E.sel.numero === n ? ' checked' : '') + '>' +
        '<span>' + esc(n) + (esgotado ? '<small>esgotado</small>' : '') + '</span></label>';
    }).join('');
  }

  function renderizarProdutos() {
    var box = $('#lista-produtos');
    if (!E.produtos.length) {
      box.innerHTML = '<p class="vazio">' + (CFG.apiUrl ? 'Carregando os modelos…' : 'Os modelos aparecem quando o site estiver ligado à planilha.') + '</p>';
      return;
    }
    box.innerHTML = E.produtos.map(function (p) {
      var marcado = E.sel.favoritos.indexOf(p.codigo) !== -1;
      var selo = '';
      if (E.sel.numero && temEstoque() && !amostraFixa()) {
        selo = disp(p.codigo, E.sel.numero) > 0
          ? '<em class="selo selo-tem">Tem nº ' + esc(E.sel.numero) + '</em>'
          : '<em class="selo selo-acabou">Sem nº ' + esc(E.sel.numero) + '</em>';
      }
      return '<label class="produto"><input type="checkbox" name="favoritos" value="' + esc(p.codigo) + '"' + (marcado ? ' checked' : '') + ' aria-label="' + esc(p.nome) + '">' +
        '<span class="produto-caixa"><span class="produto-foto">' + imagem(p) + '<span class="coracao" aria-hidden="true">♥</span></span>' +
        '<span class="produto-info"><strong>' + esc(p.nome) + '</strong>' + (p.descricao ? '<small>' + esc(p.descricao) + '</small>' : '') + selo + '</span></span></label>';
    }).join('');
    cuidarFotos(box);
  }

  function opcoesAmostra() {
    var n = E.sel.numero;
    if (amostraFixa()) return { lista: [], motivo: 'fixa' };
    if (!n || !E.sel.favoritos.length) return { lista: [], motivo: 'incompleto' };
    if (!temEstoque()) return { lista: E.sel.favoritos.slice(), motivo: 'sem_info' };
    var favs = E.sel.favoritos.filter(function (c) { return disp(c, n) > 0; });
    if (favs.length) return { lista: favs, motivo: 'favoritos' };
    var outros = E.produtos.filter(function (p) { return disp(p.codigo, n) > 0; }).map(function (p) { return p.codigo; });
    if (outros.length) return { lista: outros, motivo: 'outros' };
    return { lista: [], motivo: 'nada' };
  }

  function renderizarAmostras() {
    var bloco = $('#bloco-amostra');
    var box = $('#lista-amostras');
    var ajuda = $('#ajuda-amostra');
    var o = opcoesAmostra();
    if (o.motivo === 'fixa') {
      var p = produto(amostraFixa());
      E.sel.amostra = '';
      if (!E.sel.numero) { bloco.hidden = true; return; }
      bloco.hidden = false;
      var legenda = $('[data-legenda-amostra]');
      if (legenda) legenda.textContent = 'Sua amostra';
      ajuda.hidden = false;
      ajuda.textContent = 'Todas as participantes levam o mesmo modelo. A gente separa no seu número.';
      var resta = disp(p.codigo, E.sel.numero);
      var aviso = temEstoque() && resta <= 0
        ? 'Seu número acabou no stand: a equipe resolve com você no balcão.'
        : 'Nº ' + esc(E.sel.numero) + (temEstoque() && resta <= 2 ? ' · últimos pares' : '');
      box.innerHTML = '<div class="amostra"><span class="amostra-caixa"><span class="miniatura">' + imagem(p) + '</span>' +
        '<span><strong>' + esc(p.nome) + '</strong><small>' + aviso + '</small></span></span></div>';
      cuidarFotos(box);
      return;
    }
    if (o.motivo === 'incompleto') { bloco.hidden = true; E.sel.amostra = ''; return; }
    bloco.hidden = false;
    var leg = $('[data-legenda-amostra]');
    if (leg) leg.textContent = 'Qual você leva hoje?';
    if (o.lista.indexOf(E.sel.amostra) === -1) E.sel.amostra = o.lista.length === 1 ? o.lista[0] : '';
    if (o.motivo === 'nada') {
      ajuda.hidden = true;
      box.innerHTML = '<p class="nada-no-numero">O seu número acabou no stand. Pode finalizar: a equipe resolve com você no balcão.</p>';
      return;
    }
    ajuda.hidden = o.motivo === 'favoritos';
    ajuda.textContent = o.motivo === 'outros' ? 'Seus favoritos acabaram no seu número. Estes ainda têm:' : 'A equipe confirma o seu número no balcão.';
    box.innerHTML = o.lista.map(function (c) {
      var p = produto(c) || { codigo: c, nome: c };
      var resta = disp(c, E.sel.numero);
      var sub = temEstoque() ? 'Nº ' + esc(E.sel.numero) + (resta <= 2 ? ' · últimos pares' : '') : 'Nº ' + esc(E.sel.numero);
      return '<label class="amostra"><input type="radio" name="amostra" value="' + esc(c) + '"' + (E.sel.amostra === c ? ' checked' : '') + '>' +
        '<span class="amostra-caixa"><span class="miniatura">' + imagem(p) + '</span><span><strong>' + esc(p.nome) + '</strong><small>' + sub + '</small></span></span></label>';
    }).join('');
    cuidarFotos(box);
  }

  function renderizarPasso3() {
    $$('[data-max-favoritos]').forEach(function (el) { el.textContent = E.conf.max_favoritos || 3; });
    renderizarNumeros();
    renderizarProdutos();
    renderizarAmostras();
  }

  function turmaAgora() { return horaSP() < (E.conf.corte_tarde || '13:30') ? 'manha' : 'tarde'; }

  function renderizarOferta() {
    var t = turmaAgora();
    $('#oferta-titulo').textContent = t === 'manha' ? 'Parceria Top LUMISS' : 'Colaboração LUMISS';
    var comissao = t === 'manha' ? E.conf.comissao_manha : E.conf.comissao_tarde;
    var el = $('#oferta-comissao');
    if (comissao) {
      el.textContent = 'Comissão de ' + comissao + '% na colaboração direcionada' +
        (E.conf.comissao_aberta ? ' (no plano aberto é ' + E.conf.comissao_aberta + '%)' : '');
      el.hidden = false;
    } else {
      el.hidden = true;
    }
    var itens = (t === 'manha' ? E.conf.oferta_manha : E.conf.oferta_tarde) || [];
    $('#oferta-itens').innerHTML = itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('');
    var lista = E.conf.compromissos || [];
    E.sel.compromissos = E.sel.compromissos.filter(function (c) { return lista.indexOf(c) !== -1; });
    $('#lista-compromissos').innerHTML = lista.map(function (c) {
      return '<label class="chip"><input type="checkbox" name="compromissos" value="' + esc(c) + '"' + (E.sel.compromissos.indexOf(c) !== -1 ? ' checked' : '') + '><span>' + esc(c) + '</span></label>';
    }).join('');
  }

  function renderizarDinamicos() {
    renderizarVitrine();
    if (E.tela === 'passo-3') renderizarPasso3();
    if (E.tela === 'passo-4') renderizarOferta();
  }

  /* ------------------------------------------------------------ validação */
  function radio(nome) {
    var r = F.querySelector('input[name="' + nome + '"]:checked');
    return r ? r.value : '';
  }
  function marcados(nome) {
    return $$('input[name="' + nome + '"]:checked', F).map(function (i) { return i.value; });
  }
  function limparErros(escopo) {
    $$('.erro', escopo).forEach(function (e) { e.hidden = true; e.textContent = ''; });
    $$('.com-erro', escopo).forEach(function (c) { c.classList.remove('com-erro'); });
    $$('[aria-invalid]', escopo).forEach(function (c) { c.removeAttribute('aria-invalid'); });
  }
  function mostrarErro(campo, msg) {
    var p = $('[data-erro="' + campo + '"]');
    if (p) { p.textContent = msg; p.hidden = false; }
    var c = $('[data-campo="' + campo + '"]');
    if (c) {
      c.classList.add('com-erro');
      var i = c.querySelector('input:not([type=radio]):not([type=checkbox]), select');
      if (i) i.setAttribute('aria-invalid', 'true');
    }
  }

  function validar(n) {
    var erros = [];
    if (n === 1) {
      if ($('#f-nome').value.trim().length < 2) erros.push(['nome', 'Escreva seu nome.']);
      var arroba = normalizarArroba($('#f-arroba').value);
      $('#f-arroba').value = arroba;
      if (!arrobaValida(arroba)) erros.push(['arroba', 'Confira o @: só letras, números, ponto e _.']);
      if (!whatsValido($('#f-whatsapp').value)) erros.push(['whatsapp', 'Coloque o WhatsApp com DDD.']);
    } else if (n === 2) {
      if (!radio('formato')) erros.push(['formato', 'Escolha live, vídeo ou os dois.']);
    } else if (n === 3) {
      if (!E.sel.favoritos.length) erros.push(['favoritos', 'Marque pelo menos um modelo.']);
      if (!E.sel.numero) erros.push(['numero', 'Escolha seu número.']);
      var op = opcoesAmostra();
      if (op.motivo !== 'fixa' && op.lista.length && !E.sel.amostra) erros.push(['amostra', 'Escolha qual modelo você leva hoje.']);
    } else if (n === 4) {
      if (!E.sel.compromissos.length) erros.push(['compromissos', 'Escolha pelo menos uma opção.']);
      if (!$('#f-aceita-convite').checked) erros.push(['aceita_convite', 'É assim que a amostra vira parceria.']);
      if (!$('#f-aceite-dados').checked) erros.push(['aceite_dados', 'Sem essa autorização a gente não consegue falar com você.']);
    }
    var tela = document.getElementById('passo-' + n);
    limparErros(tela);
    erros.forEach(function (e) { mostrarErro(e[0], e[1]); });
    if (erros.length) {
      var alvo = $('[data-campo="' + erros[0][0] + '"]');
      if (alvo) {
        try { alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { alvo.scrollIntoView(); }
        focar(alvo.querySelector('input, select'));
      }
    }
    return !erros.length;
  }

  /* ------------------------------------------------------------ eventos do formulário */
  $('#botao-comecar').addEventListener('click', function () {
    E.inicioEm = Date.now();
    irPasso(1);
  });

  $$('[data-avancar]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (validar(E.passo)) irPasso(E.passo + 1);
    });
  });
  $$('[data-voltar]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (E.passo <= 1) { mostrarInicio(); return; }
      irPasso(E.passo - 1);
    });
  });

  $('#f-whatsapp').addEventListener('input', function () {
    this.value = mascaraWhats(digitosWhats(this.value).slice(0, 11));
  });
  $('#f-arroba').addEventListener('blur', function () { this.value = normalizarArroba(this.value); });

  var sequencia = ['#f-nome', '#f-arroba', '#f-whatsapp'];
  sequencia.forEach(function (sel, i) {
    $(sel).addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (sequencia[i + 1]) focar($(sequencia[i + 1])); else this.blur();
    });
  });

  F.addEventListener('input', function (ev) {
    var c = ev.target.closest('[data-campo]');
    if (c && c.classList.contains('com-erro')) {
      c.classList.remove('com-erro');
      var p = c.querySelector('.erro');
      if (p) p.hidden = true;
    }
  });

  F.addEventListener('change', function (ev) {
    var t = ev.target;
    var c = t.closest('[data-campo]');
    if (c) { c.classList.remove('com-erro'); var p = c.querySelector('.erro'); if (p) p.hidden = true; }
    if (t.name === 'numero') {
      E.sel.numero = t.value;
      renderizarProdutos();
      renderizarAmostras();
    } else if (t.name === 'favoritos') {
      var max = E.conf.max_favoritos || 3;
      var marc = marcados('favoritos');
      if (marc.length > max) {
        t.checked = false;
        aviso('Escolha até ' + max + ' favoritos.');
        return;
      }
      E.sel.favoritos = marc;
      renderizarAmostras();
      var erroAmostra = $('[data-erro="amostra"]');
      if (erroAmostra) erroAmostra.hidden = true;
    } else if (t.name === 'amostra') {
      E.sel.amostra = t.value;
    } else if (t.name === 'compromissos') {
      E.sel.compromissos = marcados('compromissos');
    }
  });

  function montarCorpo() {
    return {
      acao: 'cadastrar',
      id: uuid(),
      origem: ORIGEM,
      site: F.elements.site.value,
      tempo_ms: E.inicioEm ? Date.now() - E.inicioEm : 0,
      cadastro: {
        nome: $('#f-nome').value.trim(),
        arroba: normalizarArroba($('#f-arroba').value),
        whatsapp: $('#f-whatsapp').value,
        formato: radio('formato'),
        numero: E.sel.numero,
        favoritos: E.sel.favoritos.slice(),
        amostra_codigo: E.sel.amostra || '',
        compromissos: E.sel.compromissos.slice(),
        aceita_convite: $('#f-aceita-convite').checked,
        aceite_dados: $('#f-aceite-dados').checked
      }
    };
  }

  F.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (E.passo !== 4) return;
    if (!validar(4) || E.enviando) return;
    E.enviando = true;
    var corpo = montarCorpo();
    enfileirar(corpo);
    mostrarFinal(corpo, null);
    enviarFila().then(function (res) {
      if (E.ultimo && E.ultimo.corpo.id === corpo.id) mostrarFinal(corpo, res[corpo.id] || { ok: false, erro: 'sem_resposta' }, true);
    }, function () {
      if (E.ultimo && E.ultimo.corpo.id === corpo.id) mostrarFinal(corpo, { ok: false, erro: 'offline' }, true);
    });
  });

  /* ------------------------------------------------------------ tela final */
  function mostrarFinal(corpo, r, soAtualizar) {
    var c = corpo.cadastro;
    E.ultimo = { corpo: corpo, resposta: r };
    var perfil = (r && r.perfil) || perfilDe(c.formato);
    var nome = primeiroNome(c.nome);
    $('#final-titulo').textContent = nome ? 'Deu match, ' + nome + '!' : 'Deu match!';
    $('#final-perfil-nome').textContent = perfil;
    $('#final-perfil-texto').textContent = (CFG.perfis || {})[perfil] || '';

    var a = (r && r.ok && r.amostra) ? r.amostra : {
      status: c.amostra_codigo ? 'reservada' : 'sem_estoque', codigo: c.amostra_codigo, numero: c.numero, modelo: nomeProduto(c.amostra_codigo)
    };
    var temPar = a.status === 'reservada' || a.status === 'entregue';
    $('#final-amostra').classList.toggle('sem-par', !temPar);
    if (a.status === 'entregue') {
      $('#final-amostra-rotulo').textContent = 'Sua amostra';
      $('#final-amostra-modelo').textContent = a.modelo + ' · nº ' + a.numero;
      $('#final-amostra-texto').textContent = 'Você já retirou esta amostra. Obrigada!';
    } else if (a.status === 'reservada') {
      $('#final-amostra-rotulo').textContent = 'Sua amostra';
      $('#final-amostra-modelo').textContent = (a.modelo || nomeProduto(a.codigo)) + ' · nº ' + a.numero;
      $('#final-amostra-texto').textContent = 'Mostre esta tela pra equipe LUMISS no balcão.';
    } else {
      $('#final-amostra-rotulo').textContent = 'Amostra';
      $('#final-amostra-modelo').textContent = 'Seu número: ' + (a.numero || c.numero);
      $('#final-amostra-texto').textContent = a.codigo
        ? 'O modelo que você escolheu acabou no seu número. Mostre esta tela pra equipe: eles resolvem com você.'
        : 'Mostre esta tela pra equipe LUMISS: eles resolvem a sua amostra no balcão.';
    }
    $('#final-arroba').textContent = '@' + c.arroba;
    $('#final-codigo').textContent = (r && r.ok && r.codigo) ? r.codigo : '';

    var grupo = $('#final-grupo');
    if (MODO !== 'tablet' && E.conf.whatsapp_grupo) { grupo.href = E.conf.whatsapp_grupo; grupo.hidden = false; } else grupo.hidden = true;

    var st = $('#final-envio');
    st.classList.remove('pendente');
    if (r === null) {
      st.textContent = 'Enviando…';
    } else if (r.ok) {
      st.textContent = r.repetido ? 'Você já estava cadastrada: atualizamos seus dados.' : 'Cadastro confirmado.';
    } else if (ERROS_DEFINITIVOS.indexOf(r.erro) !== -1) {
      st.textContent = 'Algo no cadastro não passou. Chame a equipe LUMISS no balcão.';
      st.classList.add('pendente');
    } else {
      st.textContent = MODO === 'tablet'
        ? 'Sem internet agora. O cadastro ficou salvo neste tablet e sobe sozinho.'
        : 'Sem internet agora. Não feche esta página: o cadastro sobe assim que a conexão voltar.';
      st.classList.add('pendente');
    }
    if (!soAtualizar) {
      mostrar('tela-final');
      try { history.replaceState({ final: true }, ''); } catch (e) { /* sem histórico */ }
      focar($('#final-titulo'));
      if (MODO === 'tablet') iniciarContagemFinal();
    }
  }

  /* ------------------------------------------------------------ modo tablet: recomeçar sozinho */
  var relogioInatividade = null;
  var contagemAviso = null;
  var contagemFinal = null;

  function recomecar() {
    esconderInatividade();
    pararContagemFinal();
    F.reset();
    E.sel = { numero: '', favoritos: [], amostra: '', compromissos: [] };
    E.passo = 0;
    E.enviando = false;
    E.inicioEm = 0;
    E.ultimo = null;
    limparErros(document);
    ['#final-titulo', '#final-perfil-nome', '#final-perfil-texto', '#final-amostra-modelo', '#final-amostra-texto', '#final-arroba', '#final-codigo', '#final-envio']
      .forEach(function (s) { $(s).textContent = ''; });
    $('#bloco-amostra').hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (E.recarregarDepois) { location.reload(); return; }
    mostrarInicio();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sem histórico */ }
    if (swRegistro) swRegistro.update().catch(function () {});
    atualizarConfig();
  }

  function reiniciarRelogioInatividade() {
    clearTimeout(relogioInatividade);
    if (MODO !== 'tablet') return;
    if (E.tela === 'tela-equipe') {
      relogioInatividade = setTimeout(sairEquipe, TEMPOS.equipe);
    } else if (/^passo-/.test(E.tela)) {
      relogioInatividade = setTimeout(mostrarInatividade, TEMPOS.inatividade);
    }
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
  function esconderInatividade() {
    clearInterval(contagemAviso);
    $('#aviso-inatividade').hidden = true;
  }
  $('#botao-continuar').addEventListener('click', function () { esconderInatividade(); reiniciarRelogioInatividade(); });
  $('#botao-recomecar').addEventListener('click', recomecar);

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
  function pararContagemFinal() { clearInterval(contagemFinal); $('#final-contagem').textContent = ''; }
  $('#botao-nova').addEventListener('click', recomecar);

  ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function () {
      if ($('#aviso-inatividade').hidden) reiniciarRelogioInatividade();
    }, { passive: true, capture: true });
  });

  if (MODO === 'tablet') {
    ['#f-nome', '#f-whatsapp'].forEach(function (s) { $(s).setAttribute('autocomplete', 'off'); });
    setInterval(function () { if (E.tela === 'tela-inicio') atualizarConfig(); }, TEMPOS.atualizar);
  }

  /* ------------------------------------------------------------ área da equipe */
  var atualizacaoEquipe = null;

  function abrirEquipe() {
    clearTimeout(relogioInatividade);
    esconderInatividade();
    mostrar('tela-equipe');
    var pin = lerSessao(CHAVE_PIN);
    if (pin) {
      entrarComPin(pin);
    } else {
      $('#equipe-entrada').hidden = false;
      $('#equipe-painel').hidden = true;
      setTimeout(function () { focar($('#f-pin')); }, 60);
    }
  }
  $('#botao-equipe').addEventListener('click', abrirEquipe);
  window.addEventListener('hashchange', function () { if (location.hash === '#equipe') abrirEquipe(); });

  function erroPin(msg) {
    var p = $('#erro-pin');
    p.textContent = msg || '';
    p.hidden = !msg;
  }

  $('#form-pin').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = $('#f-pin').value.trim();
    if (!pin) { erroPin('Digite o PIN.'); return; }
    entrarComPin(pin);
  });

  function entrarComPin(pin) {
    erroPin('');
    var botao = $('#form-pin button[type=submit]');
    botao.disabled = true;
    api('POST', { acao: 'equipe_listar', pin: pin }).then(function (r) {
      botao.disabled = false;
      if (r && r.ok) {
        gravarSessao(CHAVE_PIN, pin);
        E.equipe.pin = pin;
        E.equipe.dados = r;
        $('#f-pin').value = '';
        $('#equipe-entrada').hidden = true;
        $('#equipe-painel').hidden = false;
        renderizarEquipe();
        clearInterval(atualizacaoEquipe);
        atualizacaoEquipe = setInterval(recarregarEquipe, TEMPOS.atualizarEquipe);
      } else {
        gravarSessao(CHAVE_PIN, '');
        $('#equipe-entrada').hidden = false;
        $('#equipe-painel').hidden = true;
        erroPin(r && r.erro === 'pin_nao_configurado' ? 'O PIN ainda não foi criado no script da planilha.' : 'PIN errado.');
        focar($('#f-pin'));
      }
    }).catch(function () {
      botao.disabled = false;
      $('#equipe-entrada').hidden = false;
      $('#equipe-painel').hidden = true;
      erroPin(!CFG.apiUrl ? 'O site ainda não está ligado à planilha.' : (navigator.onLine === false ? 'Sem internet. A área da equipe precisa de conexão.' : 'Não consegui falar com a planilha. Tente de novo.'));
    });
  }

  function recarregarEquipe(forcar) {
    if (!E.equipe.pin || E.tela !== 'tela-equipe') return Promise.resolve();
    return api('POST', { acao: 'equipe_listar', pin: E.equipe.pin }).then(function (r) {
      if (r && r.ok) {
        E.equipe.dados = r;
        var ocupado = document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && $('#equipe-painel').contains(document.activeElement);
        if (forcar || (!ocupado && !E.equipe.trocando && !E.equipe.confirmando)) renderizarEquipe(); else renderizarStatusEquipe();
      } else if (r && r.erro === 'pin_errado') {
        sairEquipe();
      }
    }).catch(function () { renderizarStatusEquipe(true); });
  }

  function sairEquipe() {
    clearInterval(atualizacaoEquipe);
    gravarSessao(CHAVE_PIN, '');
    E.equipe.pin = '';
    E.equipe.dados = null;
    E.equipe.trocando = '';
    E.equipe.confirmando = '';
    E.equipe.rascunhos = {};
    $('#lista-cadastros').innerHTML = '';
    $('#tabela-estoque').innerHTML = '';
    $('#resumo').innerHTML = '';
    $('#f-pin').value = '';
    erroPin('');
    if (location.hash === '#equipe') {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sem histórico */ }
    }
    if (MODO === 'tablet') recomecar(); else mostrarInicio();
  }
  $$('[data-sair-equipe]').forEach(function (b) { b.addEventListener('click', sairEquipe); });
  $('#botao-atualizar').addEventListener('click', function () { recarregarEquipe(true).then(function () { aviso('Atualizado.'); }); });

  function horaCurta(texto) { var m = String(texto || '').match(/(\d{2}:\d{2})/); return m ? m[1] : ''; }

  function renderizarStatusEquipe(semConexao) {
    var d = E.equipe.dados;
    if (!d) return;
    var total = d.cadastros.length;
    $('#equipe-status').textContent = total + (total === 1 ? ' cadastro' : ' cadastros') + ' · atualizado às ' + horaCurta(d.agora) +
      (semConexao ? ' · sem conexão agora' : '');
    atualizarIndicadorFila();
  }

  function atualizarIndicadorFila() {
    var el = $('#equipe-fila');
    if (!el) return;
    var n = fila().length;
    var rec = ler(CHAVE_RECUSADOS, []).length;
    var partes = [];
    if (n) partes.push(n + (n === 1 ? ' cadastro deste aparelho esperando internet.' : ' cadastros deste aparelho esperando internet.'));
    if (rec) partes.push(rec + (rec === 1 ? ' cadastro deste aparelho foi recusado pela planilha: veja o resumo.' : ' cadastros deste aparelho foram recusados pela planilha: veja o resumo.'));
    el.textContent = partes.join(' ');
    el.hidden = !partes.length;
  }

  function renderizarEquipe() {
    renderizarStatusEquipe();
    $$('.aba').forEach(function (b) {
      var ativo = b.getAttribute('data-aba') === E.equipe.aba;
      b.setAttribute('aria-selected', ativo ? 'true' : 'false');
    });
    $$('.aba-painel').forEach(function (p) { p.hidden = p.getAttribute('data-painel') !== E.equipe.aba; });
    if (E.equipe.aba === 'cadastros') renderizarCadastros();
    if (E.equipe.aba === 'estoque') renderizarEstoque();
    if (E.equipe.aba === 'resumo') renderizarResumo();
  }

  $$('.aba').forEach(function (b) {
    b.addEventListener('click', function () { E.equipe.aba = b.getAttribute('data-aba'); renderizarEquipe(); });
  });
  $('#filtros').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-filtro]');
    if (!b) return;
    E.equipe.filtro = b.getAttribute('data-filtro');
    $$('#filtros [data-filtro]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    renderizarCadastros();
  });
  $('#busca').addEventListener('input', function () { E.equipe.busca = this.value; renderizarCadastros(); });

  function filtrarCadastros(lista) {
    var f = E.equipe.filtro;
    var b = E.equipe.busca.trim().toLowerCase().replace(/^@/, '');
    return lista.filter(function (c) {
      if (f === 'manha' && c.turma !== 'manha') return false;
      if (f === 'tarde' && c.turma !== 'tarde') return false;
      if (f === 'entregar' && c.amostra_status !== 'reservada') return false;
      if (f === 'entregue' && c.amostra_status !== 'entregue') return false;
      if (f === 'sem_estoque' && c.amostra_status !== 'sem_estoque' && c.amostra_status !== 'liberada') return false;
      if (f === 'concorrente' && !c.concorrente) return false;
      if (b && (c.arroba + ' ' + c.nome + ' ' + c.codigo).toLowerCase().indexOf(b) === -1) return false;
      return true;
    });
  }

  var ROTULO_STATUS = {
    reservada: ['Reservada', 'etiqueta-destaque'],
    entregue: ['Entregue', 'etiqueta-ok'],
    sem_estoque: ['Sem par', 'etiqueta-perigo'],
    liberada: ['Liberada', '']
  };

  function segmentos(id, campo, atual, opcoes) {
    return '<span class="segmentos" role="group">' + opcoes.map(function (o) {
      return '<button type="button" data-campo-equipe="' + campo + '" data-valor="' + esc(o[0]) + '" aria-pressed="' + (atual === o[0] ? 'true' : 'false') + '">' + esc(o[1]) + '</button>';
    }).join('') + '</span>';
  }

  function linkWhats(w) {
    var d = digitosWhats(w);
    return d ? '<a href="https://wa.me/55' + d + '" target="_blank" rel="noopener">' + esc(w) + '</a>' : esc(w);
  }

  function fichaHTML(c) {
    var d = E.equipe.dados;
    var st = ROTULO_STATUS[c.amostra_status] || ['Sem amostra', ''];
    var turma = c.turma === 'manha' ? 'Manhã' : (c.turma === 'tarde' ? 'Tarde' : '');
    var favs = String(c.favoritos || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean).map(function (cod) {
      var p = (d.produtos || []).filter(function (x) { return x.codigo === cod; })[0];
      return p ? p.nome : cod;
    }).join(', ');
    var modelo = c.amostra_modelo || c.amostra_codigo;
    var textoAmostra = modelo ? esc(modelo) + ' · nº ' + esc(c.amostra_numero) : 'Nº ' + esc(c.numero || c.amostra_numero || '?') + ', sem modelo escolhido';
    var conf = E.equipe.confirmando;
    var botoes = '';
    if (c.amostra_status === 'reservada') {
      botoes = '<button type="button" class="botao botao-pequeno" data-acao="entregar">' + (conf === c.id + ':entregar' ? 'Confirmar entrega' : 'Entregar') + '</button>' +
        '<button type="button" class="botao botao-pequeno botao-secundario" data-acao="trocar">Trocar</button>' +
        '<button type="button" class="botao botao-pequeno botao-secundario" data-acao="liberar">' + (conf === c.id + ':liberar' ? 'Confirmar' : 'Liberar') + '</button>';
    } else if (c.amostra_status === 'entregue') {
      botoes = '<button type="button" class="botao botao-pequeno botao-secundario" data-acao="liberar">' + (conf === c.id + ':liberar' ? 'Confirmar: desfazer' : 'Desfazer entrega') + '</button>';
    } else {
      botoes = '<button type="button" class="botao botao-pequeno" data-acao="trocar">Escolher par</button>';
    }
    var troca = '';
    if (E.equipe.trocando === c.id) {
      var numeroPadrao = c.amostra_numero || c.numero;
      troca = '<div class="ficha-troca">' +
        '<select data-troca="codigo" aria-label="Modelo">' + (d.produtos || []).map(function (p) {
          return '<option value="' + esc(p.codigo) + '"' + (p.codigo === c.amostra_codigo ? ' selected' : '') + '>' + esc(p.nome) + '</option>';
        }).join('') + '</select>' +
        '<select data-troca="numero" aria-label="Número">' + (d.numeros || []).map(function (n) {
          return '<option value="' + esc(n) + '"' + (n === numeroPadrao ? ' selected' : '') + '>nº ' + esc(n) + '</option>';
        }).join('') + '</select>' +
        '<span class="ajuda" data-troca-disp></span>' +
        '<button type="button" class="botao botao-pequeno" data-acao="entregar-troca">Entregar este</button>' +
        '<button type="button" class="botao botao-pequeno botao-secundario" data-acao="reservar-troca">Reservar</button>' +
        '<button type="button" class="botao botao-pequeno botao-secundario" data-acao="cancelar-troca">Cancelar</button></div>';
    }
    var rascunho = E.equipe.rascunhos.hasOwnProperty(c.id) ? E.equipe.rascunhos[c.id] : c.anotacao;
    return '<article class="ficha' + (c.concorrente ? ' destaque-concorrente' : '') + '" data-id="' + esc(c.id) + '">' +
      '<div class="ficha-topo">' +
        '<button type="button" class="ficha-arroba" data-acao="copiar-arroba" title="Copiar @">@' + esc(c.arroba) + '</button>' +
        '<span class="ficha-codigo">' + esc(c.codigo) + '</span>' +
        (turma ? '<span class="etiqueta">' + turma + '</span>' : '') +
        (c.perfil ? '<span class="etiqueta">' + esc(c.perfil) + '</span>' : '') +
        (c.concorrente ? '<span class="etiqueta etiqueta-sol">Já criou para ' + esc(c.concorrente) + '</span>' : '') +
        (c.pendencias ? '<span class="etiqueta etiqueta-perigo">Conferir: ' + esc(c.pendencias) + '</span>' : '') +
      '</div>' +
      '<p class="ficha-linha">' + esc(c.nome) + ' · ' + linkWhats(c.whatsapp) + ' · ' + esc(c.formato) + '</p>' +
      '<p class="ficha-linha">Favoritos: ' + esc(favs || '—') + ' · topou: ' + esc(c.compromissos || '—') + '</p>' +
      '<div class="ficha-amostra"><p><span class="etiqueta ' + st[1] + '">' + st[0] + '</span> ' + textoAmostra + '</p>' +
        '<div class="ficha-botoes">' + botoes + '</div>' + troca + '</div>' +
      '<div class="ficha-controles">' +
        '<div class="controle"><span>Convite</span>' + segmentos(c.id, 'convite', c.convite, [['', '—'], ['enviado', 'Enviado'], ['aceito', 'Aceito']]) + '</div>' +
        '<div class="controle"><span>Lead</span>' + segmentos(c.id, 'temperatura', c.temperatura, [['quente', 'Quente'], ['morna', 'Morna'], ['fria', 'Fria']]) + '</div>' +
      '</div>' +
      '<div class="ficha-nota"><textarea data-nota rows="2" placeholder="Anotação da conversa" aria-label="Anotação">' + esc(rascunho) + '</textarea>' +
        '<button type="button" class="botao botao-pequeno botao-secundario" data-acao="salvar-nota">Salvar</button></div>' +
      '</article>';
  }

  function renderizarCadastros() {
    var d = E.equipe.dados;
    if (!d) return;
    var lista = filtrarCadastros(d.cadastros);
    var box = $('#lista-cadastros');
    box.innerHTML = lista.length ? lista.map(fichaHTML).join('') : '<p class="vazio">Nenhum cadastro aqui.</p>';
    if (E.equipe.trocando) atualizarDispTroca();
  }

  function estoqueDe(codigo, numero) {
    var e = E.equipe.dados && E.equipe.dados.estoque;
    return e && e[codigo] && e[codigo][numero] ? e[codigo][numero] : { inicial: 0, reservado: 0, entregue: 0, disponivel: 0 };
  }

  function atualizarDispTroca() {
    var ficha = $('.ficha[data-id="' + (window.CSS && CSS.escape ? CSS.escape(E.equipe.trocando) : E.equipe.trocando) + '"]');
    if (!ficha) return;
    var cod = $('[data-troca="codigo"]', ficha).value;
    var num = $('[data-troca="numero"]', ficha).value;
    var s = estoqueDe(cod, num);
    $('[data-troca-disp]', ficha).textContent = s.disponivel > 1 ? s.disponivel + ' disponíveis' : (s.disponivel === 1 ? '1 disponível' : 'acabou');
  }

  function atualizarFichaLocal(cadastro, estoque) {
    var d = E.equipe.dados;
    d.cadastros = d.cadastros.map(function (c) { return c.id === cadastro.id ? cadastro : c; });
    if (estoque) d.estoque = estoque;
  }

  function acaoEquipe(id, extra, mensagemOk) {
    var corpo = Object.assign({ acao: 'equipe_atualizar', pin: E.equipe.pin, id: id, por: APARELHO }, extra);
    return api('POST', corpo).then(function (r) {
      if (r && r.ok) {
        atualizarFichaLocal(r.cadastro, r.estoque);
        E.equipe.trocando = '';
        E.equipe.confirmando = '';
        renderizarEquipe();
        if (mensagemOk) aviso(mensagemOk);
        return true;
      }
      if (r && r.erro === 'sem_estoque') aviso('Esse modelo acabou no número ' + r.numero + '.');
      else if (r && r.erro === 'pin_errado') sairEquipe();
      else if (r && r.erro === 'nao_encontrado') { aviso('Cadastro não encontrado. Atualizando a lista.'); recarregarEquipe(true); }
      else aviso('Não salvou. Tente de novo.');
      return false;
    }).catch(function () { aviso('Sem conexão: não salvou.'); return false; });
  }

  var confirmacaoTimer = null;
  function pedirConfirmacao(chave) {
    E.equipe.confirmando = chave;
    renderizarCadastros();
    clearTimeout(confirmacaoTimer);
    confirmacaoTimer = setTimeout(function () { E.equipe.confirmando = ''; renderizarCadastros(); }, 4000);
  }

  function copiar(texto, mensagem) {
    function reserva() {
      var t = document.createElement('textarea');
      t.value = texto;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); aviso(mensagem); } catch (e) { aviso('Não consegui copiar.'); }
      t.remove();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () { aviso(mensagem); }, reserva);
    } else {
      reserva();
    }
  }

  $('#lista-cadastros').addEventListener('click', function (ev) {
    var ficha = ev.target.closest('.ficha');
    if (!ficha) return;
    var id = ficha.getAttribute('data-id');
    var c = E.equipe.dados.cadastros.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var seg = ev.target.closest('[data-campo-equipe]');
    if (seg) {
      var campo = seg.getAttribute('data-campo-equipe');
      var valor = seg.getAttribute('data-valor');
      if (campo === 'temperatura' && c.temperatura === valor) valor = '';
      var m = {};
      m[campo] = valor;
      acaoEquipe(id, { mudancas: m });
      return;
    }
    var b = ev.target.closest('[data-acao]');
    if (!b) return;
    var acao = b.getAttribute('data-acao');
    if (acao === 'copiar-arroba') copiar('@' + c.arroba, '@' + c.arroba + ' copiado.');
    if (acao === 'entregar') {
      if (E.equipe.confirmando !== id + ':entregar') { pedirConfirmacao(id + ':entregar'); return; }
      acaoEquipe(id, { amostra: { acao: 'entregar' } }, 'Entregue.');
    }
    if (acao === 'liberar') {
      if (E.equipe.confirmando !== id + ':liberar') { pedirConfirmacao(id + ':liberar'); return; }
      acaoEquipe(id, { amostra: { acao: 'liberar' } }, 'O par voltou pro estoque.');
    }
    if (acao === 'trocar') { E.equipe.trocando = id; E.equipe.confirmando = ''; renderizarCadastros(); }
    if (acao === 'cancelar-troca') { E.equipe.trocando = ''; renderizarCadastros(); }
    if (acao === 'entregar-troca' || acao === 'reservar-troca') {
      var cod = $('[data-troca="codigo"]', ficha).value;
      var num = $('[data-troca="numero"]', ficha).value;
      acaoEquipe(id, { amostra: { acao: acao === 'entregar-troca' ? 'entregar' : 'reservar', codigo: cod, numero: num } },
        acao === 'entregar-troca' ? 'Entregue.' : 'Reservado.');
    }
    if (acao === 'salvar-nota') {
      var nota = $('[data-nota]', ficha).value;
      acaoEquipe(id, { mudancas: { anotacao: nota } }, 'Anotação salva.').then(function (ok) {
        if (ok) delete E.equipe.rascunhos[id];
      });
    }
  });
  $('#lista-cadastros').addEventListener('input', function (ev) {
    if (ev.target.matches('[data-nota]')) {
      var id = ev.target.closest('.ficha').getAttribute('data-id');
      E.equipe.rascunhos[id] = ev.target.value;
    }
  });
  $('#lista-cadastros').addEventListener('change', function (ev) {
    if (ev.target.matches('[data-troca]')) atualizarDispTroca();
  });

  function renderizarEstoque() {
    var d = E.equipe.dados;
    var nums = d.numeros || [];
    var codigos = (d.produtos || []).map(function (p) { return p.codigo; });
    Object.keys(d.estoque || {}).forEach(function (c) { if (codigos.indexOf(c) === -1) codigos.push(c); });
    var totaisNum = {};
    var linhas = codigos.map(function (cod) {
      var p = (d.produtos || []).filter(function (x) { return x.codigo === cod; })[0];
      var soma = 0;
      var somaIni = 0;
      var cel = nums.map(function (n) {
        var s = estoqueDe(cod, n);
        soma += Math.max(0, s.disponivel);
        somaIni += s.inicial;
        totaisNum[n] = (totaisNum[n] || 0) + Math.max(0, s.disponivel);
        if (!s.inicial) return '<td><small>—</small></td>';
        var classe = s.disponivel <= 0 ? 'zero' : (s.disponivel <= 2 ? 'pouco' : '');
        return '<td><span class="' + classe + '">' + Math.max(0, s.disponivel) + '</span> <small>(' + s.inicial + ')</small></td>';
      }).join('');
      return '<tr><td>' + esc(p ? p.nome : cod) + '</td>' + cel + '<td><strong>' + soma + '</strong> <small>(' + somaIni + ')</small></td></tr>';
    }).join('');
    var rodape = '<tr><td><strong>Total</strong></td>' + nums.map(function (n) { return '<td><strong>' + (totaisNum[n] || 0) + '</strong></td>'; }).join('') + '<td></td></tr>';
    $('#tabela-estoque').innerHTML = '<table><thead><tr><th>Modelo</th>' + nums.map(function (n) { return '<th>' + esc(n) + '</th>'; }).join('') +
      '<th>Total</th></tr></thead><tbody>' + linhas + rodape + '</tbody></table>';
  }

  function contar(lista, fn) {
    var m = {};
    lista.forEach(function (c) { (fn(c) || []).forEach(function (k) { if (k) m[k] = (m[k] || 0) + 1; }); });
    return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }

  function renderizarResumo() {
    var d = E.equipe.dados;
    var cs = d.cadastros;
    var por = function (fn) { return cs.filter(fn).length; };
    var nomes = {};
    (d.produtos || []).forEach(function (p) { nomes[p.codigo] = p.nome; });
    var favs = contar(cs, function (c) { return String(c.favoritos || '').split('|').map(function (x) { return x.trim(); }); });
    var nums = contar(cs, function (c) { return [c.numero]; }).sort(function (a, b) { return Number(a[0]) - Number(b[0]); });
    var formatos = contar(cs, function (c) { return [c.formato]; });
    var cartoes = [
      [cs.length, 'cadastros'],
      [por(function (c) { return c.turma === 'manha'; }), 'da manhã'],
      [por(function (c) { return c.turma === 'tarde'; }), 'da tarde'],
      [por(function (c) { return c.amostra_status === 'entregue'; }), 'amostras entregues'],
      [por(function (c) { return c.amostra_status === 'reservada'; }), 'esperando retirada'],
      [por(function (c) { return c.amostra_status === 'sem_estoque'; }), 'sem par no número'],
      [por(function (c) { return c.convite === 'enviado' || c.convite === 'aceito'; }), 'convites enviados'],
      [por(function (c) { return c.convite === 'aceito'; }), 'convites aceitos'],
      [por(function (c) { return c.temperatura === 'quente'; }), 'leads quentes'],
      [por(function (c) { return !!c.concorrente; }), 'já criaram pra GiGiL/Lorizze']
    ];
    var recusados = ler(CHAVE_RECUSADOS, []);
    $('#resumo').innerHTML =
      '<div class="resumo-grade">' + cartoes.map(function (x) { return '<div class="resumo-cartao"><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="resumo-lista"><h3>Mais escolhidos no match</h3><ol>' + (favs.length ? favs.map(function (f) { return '<li>' + esc(nomes[f[0]] || f[0]) + ' · ' + f[1] + '</li>'; }).join('') : '<li>Nada ainda.</li>') + '</ol></div>' +
      '<div class="resumo-lista"><h3>Numeração</h3><p class="ficha-linha">' + (nums.length ? nums.map(function (n) { return 'nº ' + esc(n[0]) + ': ' + n[1]; }).join(' · ') : 'Nada ainda.') + '</p></div>' +
      '<div class="resumo-lista"><h3>Formato</h3><p class="ficha-linha">' + (formatos.length ? formatos.map(function (f) { return esc(f[0]) + ': ' + f[1]; }).join(' · ') : 'Nada ainda.') + '</p></div>' +
      (recusados.length ? '<div class="resumo-lista"><h3>Recusados neste aparelho</h3><ol>' + recusados.map(function (x) {
        var c = x.corpo.cadastro || {};
        return '<li>' + esc(c.nome) + ' · @' + esc(c.arroba) + ' · ' + esc(c.whatsapp) + ' <small>(' + esc(x.resposta && x.resposta.erro) + ')</small></li>';
      }).join('') + '</ol></div>' : '');
  }

  $$('[data-copiar]').forEach(function (b) {
    b.addEventListener('click', function () {
      var tipo = b.getAttribute('data-copiar');
      var cs = (E.equipe.dados && E.equipe.dados.cadastros) || [];
      var lista = cs.filter(function (c) {
        if (tipo === 'manha') return c.turma === 'manha';
        if (tipo === 'tarde') return c.turma === 'tarde';
        if (tipo === 'sem_convite') return !c.convite;
        return true;
      }).map(function (c) { return '@' + c.arroba; });
      if (!lista.length) { aviso('Nenhum @ nessa lista.'); return; }
      copiar(lista.join('\n'), lista.length + ' @ copiados.');
    });
  });

  $('#botao-csv').addEventListener('click', function () {
    var cs = (E.equipe.dados && E.equipe.dados.cadastros) || [];
    var colunas = ['codigo', 'arroba', 'nome', 'whatsapp', 'turma', 'perfil', 'formato',
      'numero', 'favoritos', 'amostra_status', 'amostra_modelo', 'amostra_numero', 'compromissos', 'convite', 'temperatura', 'anotacao', 'concorrente', 'criado_em'];
    function cel(v) {
      var s = String(v === null || v === undefined ? '' : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var texto = '﻿' + colunas.join(';') + '\n' + cs.map(function (c) { return colunas.map(function (k) { return cel(c[k]); }).join(';'); }).join('\n');
    var blob = new Blob([texto], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    var agora = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = 'afiliadas-lumiss-' + agora.getFullYear() + ('0' + (agora.getMonth() + 1)).slice(-2) + ('0' + agora.getDate()).slice(-2) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  /* ------------------------------------------------------------ service worker (funcionar sem internet) */
  var swRegistro = null;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    var tinhaControle = !!navigator.serviceWorker.controller;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (r) { swRegistro = r; }).catch(function () {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!tinhaControle) { tinhaControle = true; return; }
      if (E.tela === 'tela-inicio' && !E.passo) location.reload();
      else E.recarregarDepois = true;
    });
  }

  /* ------------------------------------------------------------ partida */
  var cache = ler(CHAVE_CACHE, null);
  if (cache) aplicarRemoto(cache);
  E.remotoEm = 0;
  renderizarVitrine();
  mostrarInicio();
  atualizarConfig();
  if (fila().length) enviarFila().catch(function () {});
  if (location.hash === '#equipe') abrirEquipe();

  // Ganchos pros testes automáticos.
  window.__lumiss = { estado: E, fila: fila, recomecar: recomecar, modo: MODO };
})();
