/* =========================================================================
   O CADASTRO NO LUMISS OS (01/11/2026) — comum aos sites /tiktok e /shopee.

   O formulário não fala mais com a planilha do Apps Script: manda o cadastro
   para a porta do LUMISS OS (POST /api/afiliadas/cadastro).

   NINGUÉM PERDE O CADASTRO POR CAUSA DA INTERNET (o evento da Shopee, 03/11:
   300 afiliadas no mesmo wi-fi):
     1. o cadastro é GUARDADO NO APARELHO antes de qualquer envio;
     2. em até 2,5 s a afiliada vê "cadastro recebido" — confirmado pelo OS ou
        só guardado, tanto faz para ela;
     3. o que ficou guardado reenvia SOZINHO: 5 s, 10 s, 20 s, 40 s e depois de
        60 em 60 s enquanto a página estiver aberta; na hora em que a internet
        volta; e de novo quando a página abrir outra vez;
     4. ao fechar a página, o navegador ainda leva os guardados (sendBeacon).
   Reenviar não duplica: o OS não repete o mesmo @ no mesmo canal.

   O pedido vai como texto (text/plain) de propósito: é o pedido "simples" do
   navegador, sem a pergunta prévia do CORS — metade das idas e voltas.

   As regras do @ e do WhatsApp são AS MESMAS do OS (backend/src/modules/
   afiliadas/services/cadastro.js): o que a página aceita, o OS aceita — senão
   um cadastro guardado seria recusado depois do "recebido".
   ========================================================================= */
(function () {
  'use strict';

  var CHAVE = 'lumiss-afiliadas-fila-v1';
  var ESPERA_MS = 2500;
  var PRAZO_MS = 15000;
  var PASSOS_S = [5, 10, 20, 40, 60];
  var PERFIL_RE = /^[a-z0-9._-]{2,40}$/;

  var memoria = [];
  var emVoo = {};
  var ouvintes = {};
  var aoMudar = [];
  var falhas = 0;
  var relogio = null;

  var temStorage = (function () {
    try {
      localStorage.setItem('__lumiss_t', '1');
      localStorage.removeItem('__lumiss_t');
      return true;
    } catch (e) {
      return false;
    }
  })();

  /* ---------- a limpeza (igual à do OS) ---------- */
  function normalizarPerfil(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, '');
    var arroba = s.match(/@([^/?#@]+)/);
    if (arroba) s = arroba[1];
    else if (s.indexOf('/') >= 0) {
      s = s.split(/[?#]/)[0].replace(/\/+$/, '');
      s = s.slice(s.lastIndexOf('/') + 1);
    }
    return s.replace(/^@+/, '');
  }
  /* O e-mail no campo do @ (02/11/2026, igual ao OS): texto antes de um "@"
     e sem "/" (não é link) — "maria@gmail.com" é e-mail; "@maria", "maria.loja"
     e "tiktok.com/@maria" passam. */
  var MSG_EMAIL_NO_PERFIL = 'Este campo é o @ do seu perfil (ex.: @maria.calcados), não o e-mail.';
  function pareceEmail(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/^@+/, '');
    return s.indexOf('/') < 0 && /^[^@]+@/.test(s);
  }
  function normalizarWhatsapp(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '');
    return d || null;
  }
  function normalizarNome(v) {
    return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  }

  /** A mensagem do primeiro problema, ou '' quando está tudo certo. */
  function validar(d, pedeWhatsapp) {
    var nome = normalizarNome(d.nome);
    if (nome.length < 2) return 'Escreva o seu nome.';
    if (nome.length > 120) return 'O nome vai até 120 letras.';
    if (pareceEmail(d.perfil)) return MSG_EMAIL_NO_PERFIL;
    if (!PERFIL_RE.test(normalizarPerfil(d.perfil))) return 'O @ só pode ter letras sem acento, números, ponto e sublinhado.';
    if (pedeWhatsapp) {
      var w = normalizarWhatsapp(d.whatsapp);
      if (!w || w.length < 10 || w.length > 13) return 'O WhatsApp precisa do DDD e do número.';
    }
    if (!d.seguidores) return 'Escolha a faixa de seguidores.';
    if (d.aceite !== true) return 'É preciso aceitar as regras da campanha.';
    return '';
  }

  /* ---------- a fila guardada no aparelho ---------- */
  function lerFila() {
    if (!temStorage) return memoria.slice();
    try {
      var f = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      return Array.isArray(f) ? f : [];
    } catch (e) {
      return memoria.slice();
    }
  }
  function gravarFila(f) {
    memoria = f.slice();
    if (!temStorage) return;
    try {
      if (f.length) localStorage.setItem(CHAVE, JSON.stringify(f));
      else localStorage.removeItem(CHAVE);
    } catch (e) { /* cheio ou bloqueado: fica na memória */ }
    avisarMudanca();
  }
  function guardar(item) {
    // O mesmo @ no mesmo canal: o mais novo substitui o guardado.
    var f = lerFila().filter(function (i) { return i.chave !== item.chave; });
    f.push(item);
    gravarFila(f);
  }
  function tirar(id) {
    gravarFila(lerFila().filter(function (i) { return i.id !== id; }));
  }
  function avisarMudanca() {
    var n = lerFila().length;
    aoMudar.forEach(function (fn) { try { fn(n); } catch (e) { /* a página cuida */ } });
  }

  /* ---------- o envio ---------- */
  function tentar(item) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var corte = setTimeout(function () { if (ctrl) ctrl.abort(); }, PRAZO_MS);
    return fetch(item.url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(item.dados),
      signal: ctrl ? ctrl.signal : undefined,
    }).then(
      function (r) {
        clearTimeout(corte);
        if (r.ok) return { estado: 'ok' };
        if (r.status === 400 || r.status === 413 || r.status === 422) {
          return r.json().then(
            function (j) { return { estado: 'recusado', mensagem: (j && j.error) || 'Confira os dados e envie de novo.' }; },
            function () { return { estado: 'recusado', mensagem: 'Confira os dados e envie de novo.' }; }
          );
        }
        return { estado: 'falhou', status: r.status };
      },
      function (e) {
        clearTimeout(corte);
        return { estado: 'falhou', erro: e && e.name };
      }
    );
  }

  function mandar(item) {
    if (emVoo[item.id]) return;
    emVoo[item.id] = true;
    tentar(item).then(function (r) {
      delete emVoo[item.id];
      if (r.estado === 'ok' || r.estado === 'recusado') {
        if (r.estado === 'recusado') console.warn('[cadastro] o OS recusou um cadastro guardado:', r.mensagem);
        tirar(item.id);
        falhas = 0;
      } else {
        falhas += 1;
        agendar();
      }
      var fn = ouvintes[item.id];
      if (fn && r.estado !== 'falhou') { delete ouvintes[item.id]; fn(r); }
    });
  }

  function processar() {
    clearTimeout(relogio);
    relogio = null;
    if (navigator.onLine === false) { agendar(); return; }
    lerFila().forEach(mandar);
  }

  function agendar() {
    if (relogio || !lerFila().length) return;
    var s = PASSOS_S[Math.min(Math.max(falhas, 1), PASSOS_S.length) - 1];
    relogio = setTimeout(processar, s * 1000);
  }

  /**
   * Guarda e envia. Responde em até 2,5 s:
   *   { estado: 'confirmado' }  o OS gravou;
   *   { estado: 'guardado' }    ficou no aparelho e vai sozinho;
   *   { estado: 'recusado', mensagem }  o OS disse que falta ou está errado algo.
   * `depois(r)`: quando o guardado termina mais tarde (com esta página aberta), a mesma resposta, para a página atualizar o aviso.
   */
  function enviar(url, dados, depois) {
    var item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      url: url,
      dados: dados,
      chave: dados.canal + ':' + normalizarPerfil(dados.perfil),
      criadoEm: new Date().toISOString(),
    };
    guardar(item);
    return new Promise(function (resolve) {
      var pronto = false;
      ouvintes[item.id] = function (r) {
        var v = r.estado === 'ok' ? { estado: 'confirmado' } : { estado: 'recusado', mensagem: r.mensagem };
        if (!pronto) { pronto = true; resolve(v); }
        else if (typeof depois === 'function') depois(v);
      };
      setTimeout(function () { if (!pronto) { pronto = true; resolve({ estado: 'guardado' }); } }, ESPERA_MS);
      if (navigator.onLine === false) agendar();
      else mandar(item);
    });
  }

  /* ---------- os gatilhos ---------- */
  window.addEventListener('online', function () { falhas = 0; processar(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && lerFila().length) processar();
  });
  window.addEventListener('pagehide', function () {
    if (!navigator.sendBeacon) return;
    lerFila().forEach(function (i) {
      try { navigator.sendBeacon(i.url, new Blob([JSON.stringify(i.dados)], { type: 'text/plain;charset=UTF-8' })); } catch (e) { /* nada a fazer */ }
    });
  });
  // O que ficou guardado de uma visita anterior vai já.
  setTimeout(function () { if (lerFila().length) processar(); }, 800);

  window.CadastroOS = {
    enviar: enviar,
    validar: validar,
    normalizarPerfil: normalizarPerfil,
    normalizarWhatsapp: normalizarWhatsapp,
    normalizarNome: normalizarNome,
    pendentes: function () { return lerFila().length; },
    aoMudar: function (fn) { aoMudar.push(fn); },
    processar: processar,
  };
})();
