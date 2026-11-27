/* Finanças da Casa — Fase 1, Etapa 1.1
   Perfis estilo Netflix, senha opcional, recuperação, ajustes por perfil, mascotes animados e backup. */
(function () {
  const APP_VERSION = '0.5.0 (etapa 4)';
  const $app = document.getElementById('app');

  const DEFAULT_PROFILES = [
    { id: 'eu', name: 'Eu', owner: true, pet: 'gato-cinza', acc: 'oculos',
      prefs: { font: 'p', theme: 'claro', tone: 'debochado', big: false, bed: true } },
    { id: 'mae', name: 'Mãe', owner: false, pet: 'gato-laranja', acc: 'flor',
      prefs: { font: 'g', theme: 'claro', tone: 'acolhedor', big: true, bed: true } }
  ];
  const ACCS = [['oculos', 'Óculos'], ['laco', 'Laço'], ['flor', 'Flor'], ['chapeu', 'Chapéu'], ['roupinha', 'Roupinha'], ['coleira', 'Coleira'], ['none', 'Nenhum']];

  // Estado da tela
  const S = {
    profiles: [], cur: null, view: 'profiles', p: {},
    buf: '', msg: '', shake: false, fala: '', mood: 'normal',
    month: firstOfMonth(new Date()), fails: {}, lockUntil: {}, hiddenAt: 0,
    taps: [], angryUntil: 0, lastTouch: Date.now(),
    recs: [], f: null, w: null, xfilter: 'todos'
  };

  /* ---------- utilidades ---------- */
  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
  const ymd = () => new Date().toISOString().slice(0, 10);
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const prof = (id) => S.profiles.find((x) => x.id === id);
  const tone = (p) => (p && p.prefs.tone) || 'acolhedor';
  const daysSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity;
  function monthLabel(d) {
    const s = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Carinha do mascote (avatares) e corpo inteiro (tela principal)
  const cat = (p, mood, extra = '') => `<span class="catbox ${extra}">${Pet.face({ pet: p.pet, acc: p.acc, mood, label: 'Mascote de ' + p.name })}</span>`;
  const petFull = (p, mood, extra = '') => `<span class="petbox ${extra}">${Pet.full({ pet: p.pet, acc: p.acc, mood, bed: p.prefs.bed !== false, label: 'Mascote de ' + p.name })}</span>`;
  const sp = (p) => Pet.get(p.pet).sp;
  const catFala = (t, situ, avoid) => Pet.fala(t, situ, S.cur ? sp(S.cur) : 'gato', avoid);

  async function save(p) { await DB.put('profiles', p); }

  /* ---------- vida do mascote ---------- */
  // Toca uma ação (classe CSS act-*) no mascote grande da tela.
  function act(name, ms) {
    const box = document.querySelector('#app .petbox');
    if (!box) return;
    box.className = box.className.replace(/\bact-\S+/g, '').trim();
    void box.offsetWidth;
    box.classList.add('act-' + name);
    clearTimeout(act._t);
    act._t = setTimeout(() => box.classList.remove('act-' + name), ms);
  }
  // Balõezinhos que saltam do mascote ("AU! AU!", "HSSS!", confete…)
  function pops(items, cls = 'pop') {
    const hero = document.querySelector('#app .pet-stage');
    if (!hero) return;
    items.forEach((t, i) => setTimeout(() => {
      const s = document.createElement('span');
      s.className = cls; s.textContent = t;
      s.style.left = (30 + Math.random() * 40) + '%';
      s.style.setProperty('--r', (Math.random() * 40 - 20) + 'deg');
      hero.append(s);
      setTimeout(() => s.remove(), 1400);
    }, i * 380));
  }
  function confetti() {
    const hero = document.querySelector('#app .pet-stage');
    if (!hero) return;
    const colors = ['#ef5d87', '#ffcf4d', '#5fb39b', '#8fb9ea', '#f08a3c'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('i');
      s.className = 'confete';
      s.style.left = Math.random() * 100 + '%';
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = Math.random() * 0.3 + 's';
      s.style.setProperty('--x', (Math.random() * 80 - 40) + 'px');
      hero.append(s);
      setTimeout(() => s.remove(), 1800);
    }
  }
  // Comemoração: pulinho + confete (conta paga, meta batida, backup feito…)
  function celebrate() {
    requestAnimationFrame(() => {
      if (document.querySelector('#app .petbox')) { act('jump', 1900); confetti(); }
      document.querySelectorAll('#app .catbox').forEach((c) => {
        c.classList.remove('celebra'); void c.offsetWidth; c.classList.add('celebra');
        setTimeout(() => c.classList.remove('celebra'), 1900);
      });
    });
  }
  // De tempos em tempos o mascote faz algo sozinho (só na tela inicial)
  setInterval(() => {
    if (S.view !== 'home' || document.hidden || !S.cur) return;
    // App parado por ~45 s: o mascote deita e cochila
    if ((S.mood === 'feliz' || S.mood === 'normal') && Date.now() - S.lastTouch > 45000) {
      S.mood = 'dormindo'; S.fala = catFala(tone(S.cur), 'vazio'); render(); return;
    }
    if (S.mood === 'dormindo' || S.mood === 'bravo' || Math.random() < 0.35) return;
    const box = document.querySelector('#app .petbox');
    if (!box || /act-/.test(box.className)) return;
    const acts = Pet.idleActs(S.cur.pet);
    act(acts[Math.floor(Math.random() * acts.length)], 2400);
  }, 6000);

  // Modo "Site para computador" ligado no celular deixa tudo minúsculo
  const desktopMode = () => navigator.maxTouchPoints > 0 && window.innerWidth >= 900 &&
    Math.min(screen.width, screen.height) < 600;
  const desktopWarn = () => desktopMode() ? `<div class="desk-warn">As letras estão pequenas? Desligue <b>"Site para computador"</b> no menu ⋮ do Chrome e abra o app de novo.</div>` : '';

  function applyPrefs(p) {
    const r = document.documentElement;
    const pr = p ? p.prefs : { font: 'm', theme: 'claro', big: true };
    r.dataset.font = pr.font;
    r.dataset.theme = pr.theme;
    r.dataset.big = pr.big ? '1' : '0';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = pr.theme === 'escuro' ? '#161a1f' : '#2f6f5e';
  }

  function go(view, params = {}) {
    S.view = view; S.p = params; S.buf = ''; S.msg = ''; S.shake = false;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- avisos e janelas ---------- */
  function toast(text) {
    document.querySelectorAll('.toast').forEach((o) => o.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    document.body.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // Janela de confirmação própria (o navegador bloqueia/estraga o confirm() em app instalado).
  function modal({ title, html, buttons, input }) {
    return new Promise((resolve) => {
      const bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
        <h3 id="mt">${title}</h3><div class="modal-body">${html}</div>
        ${input ? `<input class="field" id="modal-input" autocomplete="off" placeholder="${esc(input)}">` : ''}
        <div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.kind || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
      bg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const val = buttons[b.dataset.i].value;
        const text = input ? bg.querySelector('#modal-input').value : undefined;
        bg.remove();
        resolve(input ? { value: val, text } : val);
      });
      document.body.append(bg);
      const f = bg.querySelector('#modal-input, .btn:last-child');
      if (f) f.focus();
    });
  }
  const CANCEL = { label: 'Cancelar', value: false };

  /* ---------- módulo de lançamentos (etapa 2) ---------- */
  const L = window.Lanc({
    S, esc, go: (...a) => go(...a), render: () => render(), toast: (t) => toast(t), modal: (o) => modal(o), CANCEL,
    tone, catFala: (...a) => catFala(...a), act: (...a) => act(...a), pops: (...a) => pops(...a), celebrate: () => celebrate(),
    nav: (a) => nav(a), save: (p) => save(p), desktopWarn: () => desktopWarn(), monthLabel
  });

  /* ---------- telas ---------- */
  function vProfiles() {
    return `<main class="screen center">
      <h1 class="title">Quem está usando?</h1>
      <div class="profile-grid">
        ${S.profiles.map((p) => `<button class="profile-card" data-action="pick" data-id="${p.id}">
          ${cat(p, 'feliz', 'avatar')}
          <span class="pname">${esc(p.name)}${p.pin ? ' <span class="lock" aria-label="com senha">🔒</span>' : ''}</span>
        </button>`).join('')}
      </div>
      <p class="hint">Tudo fica salvo só neste celular. Nada vai pra internet e nada se conecta ao banco.</p>
    </main>`;
  }

  function vPin() {
    const p = prof(S.p.id);
    const titles = { unlock: `Senha de ${esc(p.name)}`, check: 'Digite sua senha atual', new: 'Crie uma senha (4 a 6 números)', confirm: 'Repita a senha' };
    const n = S.p.mode === 'unlock' || S.p.mode === 'check' ? p.pin.len : S.p.mode === 'confirm' ? S.p.first.length : Math.max(4, S.buf.length);
    const dots = Array.from({ length: n }, (_, i) => `<span class="dot ${i < S.buf.length ? 'on' : ''}"></span>`).join('');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    const showOk = S.p.mode === 'new';
    return `<main class="screen center">
      <button class="back" data-action="pinBack" aria-label="Voltar">‹ Voltar</button>
      ${cat(p, S.shake ? 'surpreso' : 'normal', 'avatar sm')}
      <h2 class="h2">${titles[S.p.mode]}</h2>
      <div class="dots ${S.shake ? 'shake' : ''}" aria-label="${S.buf.length} números digitados">${dots}</div>
      <p class="msg" role="status">${esc(S.msg)}</p>
      <div class="keypad">
        ${keys.map((k) => {
          if (k === 'del') return `<button class="key ghost" data-action="key" data-k="del" aria-label="Apagar">⌫</button>`;
          if (k === 'ok') return showOk ? `<button class="key ok" data-action="key" data-k="ok" ${S.buf.length < 4 ? 'disabled' : ''}>OK</button>` : '<span></span>';
          return `<button class="key" data-action="key" data-k="${k}">${k}</button>`;
        }).join('')}
      </div>
      ${S.p.mode === 'unlock' ? '<button class="link" data-action="forgot">Esqueci a senha</button>' : ''}
    </main>`;
  }

  function vCode() {
    return `<main class="screen center narrow">
      <h2 class="h2">Guarde seu código de recuperação</h2>
      <p>Se esquecer a senha, este código abre seu perfil. Ele aparece <b>só agora</b>.</p>
      <div class="code" aria-label="Código">${esc(S.p.code)}</div>
      <p class="small">Anote num papel ou tire um print e guarde num lugar seguro.</p>
      <label class="check"><input type="checkbox" id="anotei" data-action="anotei"> Já anotei o código</label>
      <button class="btn primary wide" data-action="codeDone" id="codeDone" disabled>Continuar</button>
    </main>`;
  }

  function vRecover() {
    const p = prof(S.p.id);
    const owner = S.profiles.find((x) => x.owner);
    return `<main class="screen center narrow">
      <button class="back" data-action="toProfiles">‹ Voltar</button>
      ${cat(p, 'preocupado', 'avatar sm')}
      <h2 class="h2">Esqueceu a senha?</h2>
      <p>Digite o código de recuperação que apareceu quando a senha foi criada.</p>
      <input class="field code-in" id="rcode" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="12">
      <p class="msg" role="status">${esc(S.msg)}</p>
      <button class="btn primary wide" data-action="tryCode">Abrir com o código</button>
      ${!p.owner && owner ? `<p class="small">Sem o código? Peça pro perfil <b>${esc(owner.name)}</b> resetar sua senha nos Ajustes dele.</p>` : ''}
      <details class="danger-zone"><summary>Perdi o código também</summary>
        <p class="small">Sem o código não tem como abrir os dados: é isso que protege sua privacidade. Dá pra <b>apagar os dados deste perfil</b> e começar do zero (e depois restaurar um backup, se você tiver).</p>
        <button class="btn danger" data-action="wipe">Apagar dados e recomeçar</button>
      </details>
    </main>`;
  }

  function vHome() {
    const p = S.cur;
    const old = daysSince(p.lastBackupAt);
    return `<div class="page">
      <header class="topbar">
        <button class="mini" data-action="toProfiles" aria-label="Trocar de perfil">${cat(p, 'feliz')}</button>
        <div class="who"><small>Perfil</small><b>${esc(p.name)}</b></div>
        <button class="icon-btn" data-action="lock" aria-label="Sair do perfil">Sair</button>
      </header>
      <main class="content">
        ${desktopWarn()}
        <section class="hero">
          <p class="bubble">${esc(S.fala)}</p>
          <div class="pet-stage">
            <button class="pet-btn" data-action="poke" aria-label="Fazer carinho no mascote">${petFull(p, S.mood, 'live')}</button>
            ${S.mood === 'dormindo' ? '<span class="zz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>' : ''}
          </div>
        </section>
        <section class="month-nav">
          <button class="round" data-action="month" data-d="-1" aria-label="Mês anterior">‹</button>
          <b>${monthLabel(S.month)}</b>
          <button class="round" data-action="month" data-d="1" aria-label="Próximo mês">›</button>
        </section>
        ${L.home()}
        ${old > 30 ? `<section class="card warn">
          <h3>${p.lastBackupAt ? 'Faz tempo que você não faz backup' : 'Faça seu primeiro backup'}</h3>
          <p class="small">Se o celular quebrar ou o app for apagado, o backup é o que salva seus dados.</p>
          <button class="btn primary" data-action="export">Fazer backup agora</button>
        </section>` : ''}
      </main>
      ${nav('home')}
    </div>`;
  }

  function nav(active) {
    const t = (v, ico, label) => `<button class="${active === v ? 'on' : ''}" data-action="tab" data-v="${v}" ${active === v ? 'aria-current="page"' : ''}><span aria-hidden="true">${ico}</span>${label}</button>`;
    return `<nav class="tabbar">
      ${t('home', '⌂', 'Início')}${t('extrato', '☰', 'Extrato')}
      <button class="fab" data-action="novo" data-dir="out" aria-label="Lançar gasto"><span aria-hidden="true">＋</span>Lançar</button>
      ${t('carteira', '▭', 'Carteira')}${t('settings', '⚙', 'Ajustes')}
    </nav>`;
  }

  function seg(key, options, value) {
    return `<div class="seg" role="group">${options.map(([v, l]) =>
      `<button class="${value === v ? 'on' : ''}" data-action="pref" data-k="${key}" data-v="${v}" aria-pressed="${value === v}">${l}</button>`).join('')}</div>`;
  }

  function vSettings() {
    const p = S.cur;
    const others = S.profiles.filter((x) => x.id !== p.id);
    const canShare = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
    return `<div class="page">
      <header class="topbar"><div class="who"><small>Ajustes de</small><b>${esc(p.name)}</b></div></header>
      <main class="content">
        ${desktopWarn()}
        <section class="card">
          <h3>Aparência</h3>
          <label class="lbl">Tamanho da letra</label>
          ${seg('font', [['p', 'P'], ['m', 'M'], ['g', 'G'], ['gg', 'GG']], p.prefs.font)}
          <label class="lbl">Tema</label>
          ${seg('theme', [['claro', 'Claro'], ['escuro', 'Escuro']], p.prefs.theme)}
          <label class="lbl">Botões</label>
          ${seg('big', [['0', 'Normais'], ['1', 'Grandes']], p.prefs.big ? '1' : '0')}
        </section>

        <section class="card">
          <h3>Mascote</h3>
          <div class="pet-preview">${petFull(p, 'feliz', 'live')}</div>
          <label class="lbl">Escolha seu bichinho</label>
          <div class="pet-grid">${Object.entries(Pet.list).map(([id, c]) => `<button class="pet-pick ${p.pet === id ? 'on' : ''}" data-action="petPick" data-v="${id}" aria-pressed="${p.pet === id}">
            ${Pet.face({ pet: id, mood: 'feliz', label: c.nome })}<span>${c.nome}</span></button>`).join('')}</div>
          <label class="lbl">Acessório</label>
          <div class="chips">${ACCS.map(([v, l]) => `<button class="chip ${p.acc === v ? 'on' : ''}" data-action="acc" data-v="${v}">${l}</button>`).join('')}</div>
          <label class="lbl">Caminha</label>
          ${seg('bed', [['1', 'Com caminha'], ['0', 'Sem caminha']], p.prefs.bed === false ? '0' : '1')}
          <label class="lbl">Jeito de falar</label>
          ${seg('tone', [['debochado', 'Debochado'], ['acolhedor', 'Acolhedor']], p.prefs.tone)}
          <p class="tiny">${p.prefs.tone === 'acolhedor' ? 'Acolhedor: só fala com carinho e nunca fica bravo.' : 'Debochado: zoa com você e fica bravo se você cutucar demais.'}</p>
        </section>

        ${L.settingsCats()}

        <section class="card">
          <h3>Nome do perfil</h3>
          <div class="row"><input class="field" id="pname" maxlength="20" value="${esc(p.name)}"><button class="btn" data-action="rename">Salvar</button></div>
        </section>

        <section class="card">
          <h3>Senha</h3>
          ${p.pin
            ? `<p class="small">Seu perfil tem senha. 🔒</p><div class="row wrap"><button class="btn" data-action="pinChange">Trocar senha</button><button class="btn danger-outline" data-action="pinRemove">Tirar senha</button></div>`
            : `<p class="small">Sem senha: qualquer pessoa com o celular abre este perfil.</p><button class="btn primary" data-action="pinCreate">Criar senha</button>`}
          <p class="tiny">A senha protege contra olhadinhas da família. Não é um cofre: quem entende de tecnologia e tem o celular desbloqueado consegue ler os dados.</p>
        </section>

        <section class="card">
          <h3>Backup</h3>
          <p class="small">Último backup: <b>${p.lastBackupAt ? fmtDate(p.lastBackupAt) : 'nunca'}</b>. O backup salva só os dados <b>deste perfil</b>.</p>
          <div class="row wrap">
            <button class="btn primary" data-action="export">Salvar backup no celular</button>
            ${canShare ? '<button class="btn" data-action="share">Enviar (Drive, WhatsApp…)</button>' : ''}
          </div>
          <label class="btn file-btn">Restaurar backup<input type="file" id="importFile" accept=".json,application/json,text/plain" data-action="import" hidden></label>
        </section>

        ${p.owner ? `<section class="card">
          <h3>Perfis da casa</h3>
          <p class="small">Como dona do app, você pode resetar a senha de outro perfil. Você continua sem ver nada aqui, e a pessoa é avisada quando entrar.</p>
          ${others.map((o) => `<div class="row between"><span>${esc(o.name)} ${o.pin ? '🔒' : '<span class="tiny">(sem senha)</span>'}</span>
            ${o.pin ? `<button class="btn danger-outline" data-action="resetOther" data-id="${o.id}">Resetar senha</button>` : ''}</div>`).join('')}
        </section>` : ''}

        <section class="card">
          <button class="btn wide" data-action="toProfiles">Trocar de perfil</button>
          <p class="tiny center-t">Finanças da Casa · versão ${APP_VERSION}</p>
        </section>
      </main>
      ${nav('settings')}
    </div>`;
  }

  function render() {
    if (S.view === 'profiles' || S.view === 'pin' || S.view === 'recover' || S.view === 'code') {
      applyPrefs(S.view === 'profiles' ? null : prof(S.p.id));
    } else applyPrefs(S.cur);
    const views = { profiles: vProfiles, pin: vPin, code: vCode, recover: vRecover, home: vHome, settings: vSettings, ...L.views };
    if (!views[S.view] || (L.views[S.view] && !S.cur)) S.view = S.cur ? 'home' : 'profiles';
    if ((S.view === 'lancar' && !S.f) || (S.view === 'wallet' && !S.w) || (S.view === 'catform' && !S.c) || (S.view === 'wdetail' && !S.wd) || (S.view === 'cardprev' && !S.cp) || (S.view === 'billform' && !S.b) || (S.view === 'billpay' && !S.bp)) S.view = 'home';
    $app.innerHTML = views[S.view]();
  }

  /* ---------- entrar / sair ---------- */
  async function enter(p) {
    S.cur = p;
    S.month = firstOfMonth(new Date());
    S.xfilter = 'todos';
    await L.reload();
    if (!p.seenWelcome) {
      S.mood = 'feliz'; S.fala = catFala(tone(p), 'boasVindas');
      p.seenWelcome = true; await save(p);
      setTimeout(celebrate, 300);
    } else {
      // Sem lançamentos no mês: dorme. Com lançamentos: comenta o mês.
      const m = L.moodOnEnter(p);
      S.mood = m.mood; S.fala = m.fala;
    }
    go('home');
    if (p.resetNotice) {
      const n = p.resetNotice;
      p.resetNotice = null; await save(p);
      await modal({ title: 'Sua senha foi resetada',
        html: `<p>O perfil <b>${esc(n.by)}</b> removeu sua senha em ${fmtDate(n.at)}. Se quiser, crie uma nova em Ajustes.</p>`,
        buttons: [{ label: 'Entendi', value: true, kind: 'primary' }] });
    }
  }

  function toProfiles() { S.cur = null; S.recs = []; S.f = null; S.w = null; S.c = null; S.wd = null; S.cp = null; S.fk = null; S.b = null; S.bp = null; Money.setCustom([]); go('profiles'); }

  /* ---------- senha ---------- */
  async function setPin(p, pin) {
    const salt = Sec.randHex(16);
    p.pin = { hash: await Sec.hash(pin, salt), salt, len: pin.length };
    const code = Sec.recoveryCode();
    const rs = Sec.randHex(16);
    p.recovery = { hash: await Sec.hash(Sec.normalizeCode(code), rs), salt: rs };
    await save(p);
    return code;
  }

  function locked(id) {
    const until = S.lockUntil[id] || 0;
    if (Date.now() < until) { S.msg = `Muitas tentativas. Espere ${Math.ceil((until - Date.now()) / 1000)} segundos.`; return true; }
    return false;
  }
  function fail(p) {
    S.fails[p.id] = (S.fails[p.id] || 0) + 1;
    if (S.fails[p.id] >= 5) { S.lockUntil[p.id] = Date.now() + 30000; S.fails[p.id] = 0; S.msg = 'Muitas tentativas. Espere 30 segundos.'; }
    else S.msg = catFala(tone(p), 'senhaErrada');
  }

  async function pinKey(k) {
    const p = prof(S.p.id);
    const mode = S.p.mode;
    S.shake = false;
    if (k === 'del') { S.buf = S.buf.slice(0, -1); S.msg = ''; return render(); }
    if (k !== 'ok') {
      if (S.buf.length >= 6) return;
      S.buf += k;
    }
    if (mode === 'unlock' || mode === 'check') {
      if (S.buf.length < p.pin.len) return render();
      if (locked(p.id)) { S.buf = ''; return render(); }
      const ok = (await Sec.hash(S.buf, p.pin.salt)) === p.pin.hash;
      if (!ok) { fail(p); S.buf = ''; S.shake = true; return render(); }
      S.fails[p.id] = 0;
      if (mode === 'unlock') return enter(p);
      if (S.p.next === 'new') return go('pin', { id: p.id, mode: 'new', back: 'settings' });
      if (S.p.next === 'remove') {
        p.pin = null; p.recovery = null; await save(p);
        go('settings'); return toast('Senha removida.');
      }
    }
    if (mode === 'new') {
      if (k === 'ok' && S.buf.length >= 4) {
        const first = S.buf;
        S.p = { ...S.p, mode: 'confirm', first }; S.buf = ''; S.msg = ''; return render();
      }
      return render();
    }
    if (mode === 'confirm') {
      if (S.buf.length < S.p.first.length) return render();
      if (S.buf !== S.p.first) {
        S.p = { ...S.p, mode: 'new', first: null }; S.buf = ''; S.shake = true;
        S.msg = 'As senhas não bateram. Vamos de novo.'; return render();
      }
      const code = await setPin(p, S.buf);
      return go('code', { id: p.id, code, after: S.p.after || 'settings' });
    }
  }

  /* ---------- backup ---------- */
  async function buildBackup() {
    const p = S.cur;
    const records = await DB.byProfile(p.id);
    const payload = {
      app: 'financas-casa', schema: 1, exportedAt: new Date().toISOString(), appVersion: APP_VERSION,
      profile: { id: p.id, name: p.name, pet: p.pet, acc: p.acc, prefs: p.prefs },
      records
    };
    const name = `financas-casa_${slug(p.name)}_${ymd()}.json`;
    return new File([JSON.stringify(payload, null, 2)], name, { type: 'application/json' });
  }

  async function markBackup() {
    S.cur.lastBackupAt = new Date().toISOString();
    await save(S.cur);
    render();
    celebrate();
    toast(catFala(tone(S.cur), 'backup'));
  }

  async function exportBackup() {
    const file = await buildBackup();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    await markBackup();
  }

  async function shareBackup() {
    const file = await buildBackup();
    try {
      await navigator.share({ files: [file], title: 'Backup Finanças da Casa' });
      await markBackup();
    } catch (e) {
      if (e.name !== 'AbortError') toast('Não deu pra compartilhar. Use "Salvar backup no celular".');
    }
  }

  async function importBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { return toast('Esse arquivo não é um backup válido.'); }
    if (!data || data.app !== 'financas-casa' || !Array.isArray(data.records)) return toast('Esse arquivo não é um backup deste app.');
    const p = S.cur;
    const otherProfile = data.profile && data.profile.id !== p.id;
    const ok = await modal({
      title: 'Restaurar backup?',
      html: `<p>Backup de <b>${esc(data.profile?.name || '?')}</b>, feito em ${fmtDate(data.exportedAt)}, com ${data.records.length} registro(s).</p>
        <p>Isso <b>substitui</b> todos os dados atuais do perfil <b>${esc(p.name)}</b>.</p>
        ${otherProfile ? '<p class="warn-t">⚠️ Este backup é de outro perfil.</p>' : ''}`,
      buttons: [CANCEL, { label: 'Restaurar', value: true, kind: 'danger' }]
    });
    if (!ok) return;
    // Backup de outro perfil: gera ids novos (pra não colidir) e mantém os vínculos gasto -> conta/cartão
    const idMap = {};
    const recs = data.records.filter((r) => r && typeof r === 'object')
      .map((r) => { const id = otherProfile || !r.id ? Sec.uid() : String(r.id); if (r.id) idMap[r.id] = id; return { ...r, profileId: p.id, id }; })
      .map((r) => (r.wallet && idMap[r.wallet] ? { ...r, wallet: idMap[r.wallet] } : r));
    await DB.replaceProfileRecords(p.id, recs);
    await L.reload();
    if (!otherProfile && data.profile) {
      if (data.profile.prefs) p.prefs = { ...p.prefs, ...data.profile.prefs };
      if (data.profile.pet && Pet.list[data.profile.pet]) p.pet = data.profile.pet;
      if (data.profile.acc) p.acc = data.profile.acc;
      await save(p);
    }
    render();
    toast(`Backup restaurado: ${recs.length} registro(s).`);
  }

  /* ---------- ações ---------- */
  const A = {
    async pick(d) {
      const p = prof(d.id);
      if (p.pin) go('pin', { id: p.id, mode: 'unlock', back: 'profiles' });
      else enter(p);
    },
    key(d) { pinKey(d.k); },
    pinBack() { if (S.p.back === 'settings' && S.cur) go('settings'); else toProfiles(); },
    forgot() { go('recover', { id: S.p.id }); },
    toProfiles,
    lock: toProfiles,
    tab(d) { go(d.v); },
    anotei(d, el) { document.getElementById('codeDone').disabled = !el.checked; },
    codeDone() {
      const p = prof(S.p.id);
      toast(catFala(tone(p), 'pinCriado'));
      if (S.p.after === 'enter') enter(p).then(celebrate); else { go('settings'); celebrate(); }
    },
    async tryCode() {
      const p = prof(S.p.id);
      if (locked(p.id + ':r')) return render();
      const v = Sec.normalizeCode(document.getElementById('rcode').value);
      const ok = p.recovery && (await Sec.hash(v, p.recovery.salt)) === p.recovery.hash;
      if (!ok) {
        S.fails[p.id + ':r'] = (S.fails[p.id + ':r'] || 0) + 1;
        if (S.fails[p.id + ':r'] >= 5) { S.lockUntil[p.id + ':r'] = Date.now() + 60000; S.fails[p.id + ':r'] = 0; }
        S.msg = 'Código não confere. Confira letras e números.';
        return render();
      }
      p.pin = null; p.recovery = null; await save(p);
      go('pin', { id: p.id, mode: 'new', after: 'enter', back: 'profiles' });
      S.msg = 'Código certo! Agora crie uma senha nova.'; render();
    },
    async wipe() {
      const p = prof(S.p.id);
      const r = await modal({
        title: `Apagar os dados de ${esc(p.name)}?`,
        html: '<p>Tudo que foi anotado neste perfil será apagado <b>para sempre</b>. Para confirmar, digite <b>APAGAR</b>.</p>',
        input: 'APAGAR',
        buttons: [CANCEL, { label: 'Apagar tudo', value: true, kind: 'danger' }]
      });
      if (!r.value) return;
      if (r.text.trim().toUpperCase() !== 'APAGAR') return toast('Não apaguei: a palavra não confere.');
      await DB.replaceProfileRecords(p.id, []);
      p.pin = null; p.recovery = null; p.lastBackupAt = null; p.seenWelcome = false;
      await save(p);
      toast('Dados apagados. Perfil recomeçado.');
      enter(p);
    },
    poke() {
      const p = S.cur;
      const t = tone(p);
      const now = Date.now();
      // Dormindo: acorda assustado
      if (S.mood === 'dormindo') {
        S.mood = 'surpreso'; S.fala = catFala(t, 'acordar'); render();
        clearTimeout(A._t);
        A._t = setTimeout(() => { if (S.view === 'home') { S.mood = 'feliz'; render(); } }, 1200);
        return;
      }
      if (S.mood === 'bravo' && now < S.angryUntil) {
        act('angry', 1500); pops(sp(p) === 'cao' ? ['AU!'] : ['HSSS!'], 'pop bark');
        return;
      }
      S.taps = S.taps.filter((x) => now - x < 4000).concat(now);
      // Muitas cutucadas seguidas: o debochado fica BRAVO (o acolhedor nunca)
      if (S.taps.length >= 6 && t === 'debochado') {
        S.taps = [];
        S.mood = 'bravo'; S.angryUntil = now + 9000;
        S.fala = catFala(t, 'bravo'); render();
        act('angry', 1700);
        pops(sp(p) === 'cao' ? ['AU!', 'AU!'] : ['HSSS!'], 'pop bark');
        clearTimeout(A._t);
        A._t = setTimeout(() => {
          if (S.view === 'home' && S.mood === 'bravo') { S.mood = 'normal'; S.fala = catFala(t, 'calmo'); render(); }
        }, 9000);
        return;
      }
      S.mood = 'feliz';
      S.fala = catFala(t, S.taps.length >= 6 ? 'bravo' : 'cutucar', S.fala);
      if (S.taps.length >= 6) S.taps = [];
      render();
      act(Math.random() < 0.6 ? 'wave' : 'roll', 1500);
    },
    async petPick(d) { S.cur.pet = d.v; await save(S.cur); render(); act('jump', 1900); },
    month(d) { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + Number(d.d), 1); render(); },
    async pref(d) {
      S.cur.prefs[d.k] = d.k === 'big' || d.k === 'bed' ? d.v === '1' : d.v;
      await save(S.cur); render();
    },
    async acc(d) { S.cur.acc = d.v; await save(S.cur); render(); },
    async rename() {
      const v = document.getElementById('pname').value.trim();
      if (!v) return toast('O nome não pode ficar vazio.');
      S.cur.name = v.slice(0, 20); await save(S.cur); render(); toast('Nome salvo.');
    },
    pinCreate() { go('pin', { id: S.cur.id, mode: 'new', back: 'settings' }); },
    pinChange() { go('pin', { id: S.cur.id, mode: 'check', next: 'new', back: 'settings' }); },
    pinRemove() { go('pin', { id: S.cur.id, mode: 'check', next: 'remove', back: 'settings' }); },
    export: exportBackup,
    share: shareBackup,
    async resetOther(d) {
      const o = prof(d.id);
      if (!S.cur.pin) {
        return modal({ title: 'Crie sua senha primeiro',
          html: '<p>Pra resetar a senha de outra pessoa, o seu perfil precisa ter senha. Senão qualquer um abriria o seu perfil e resetaria a dela.</p>',
          buttons: [{ label: 'Ok', value: true, kind: 'primary' }] });
      }
      const ok = await modal({
        title: `Resetar a senha de ${esc(o.name)}?`,
        html: `<p>A senha de <b>${esc(o.name)}</b> será removida e o perfil ficará aberto até ela criar outra.</p>
          <p>Quando ela entrar, o app vai avisar que <b>você</b> fez o reset. Isso é pra manter a confiança.</p>`,
        buttons: [CANCEL, { label: 'Resetar', value: true, kind: 'danger' }]
      });
      if (!ok) return;
      o.pin = null; o.recovery = null;
      o.resetNotice = { by: S.cur.name, at: new Date().toISOString() };
      await save(o); render(); toast(`Senha de ${o.name} resetada.`);
    }
  };

  document.addEventListener('pointerdown', () => { S.lastTouch = Date.now(); }, { passive: true });
  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || el.type === 'file' || el.type === 'checkbox') return;
    const fn = A[el.dataset.action];
    if (fn) Promise.resolve(fn(el.dataset, el)).catch(err);
  });
  Object.assign(A, L.actions);
  $app.addEventListener('input', (e) => L.onInput(e));
  $app.addEventListener('change', (e) => {
    L.onChange(e);
    const el = e.target;
    if (el.id === 'anotei') A.anotei(el.dataset, el);
    if (el.id === 'importFile' && el.files[0]) importBackup(el.files[0]).catch(err).finally(() => { el.value = ''; });
  });
  $app.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'rcode') A.tryCode().catch(err);
    if (e.key === 'Enter' && e.target.id === 'pname') A.rename().catch(err);
  });
  // Teclado físico na tela de senha (útil no computador)
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'pin' || document.querySelector('.modal-bg')) return;
    if (/^[0-9]$/.test(e.key)) pinKey(e.key).catch(err);
    else if (e.key === 'Backspace') pinKey('del').catch(err);
    else if (e.key === 'Enter') pinKey('ok').catch(err);
  });

  /* ---------- botão "voltar" do Android ----------
     Mantém uma entrada extra no histórico: cada "voltar" é interceptado e vira navegação
     dentro do app. Só na tela "Quem está usando?" o voltar sai do app de verdade. */
  function handleBack() {
    const m = document.querySelector('.modal-bg');
    if (m) { const b = m.querySelector('[data-i="0"]'); if (b) b.click(); return true; }
    if (L.back()) return true;
    switch (S.view) {
      case 'extrato': case 'carteira': case 'settings': go('home'); return true;
      case 'home': toProfiles(); return true;
      case 'pin': A.pinBack(); return true;
      case 'recover': toProfiles(); return true;
      case 'code': toast('Anote o código e toque em Continuar.'); return true;
      default: return false;
    }
  }
  const armBack = () => { try { history.pushState({ fc: 1 }, ''); } catch (e) { /* ignora */ } };
  window.addEventListener('popstate', () => {
    if (handleBack()) armBack();
    else history.back();
  });

  // Bloqueia de novo se o app ficar 2 minutos em segundo plano (só se o perfil tiver senha).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { S.hiddenAt = Date.now(); return; }
    if (S.cur && S.cur.pin && Date.now() - S.hiddenAt > 120000) toProfiles();
  });

  function err(e) {
    console.error(e);
    toast('Ops, algo deu errado: ' + (e && e.message ? e.message : e));
  }

  /* ---------- início ---------- */
  async function init() {
    try {
      S.profiles = await DB.getAll('profiles');
      if (!S.profiles.length) {
        const now = new Date().toISOString();
        S.profiles = DEFAULT_PROFILES.map((p) => ({ ...p, prefs: { ...p.prefs }, pin: null, recovery: null,
          createdAt: now, lastBackupAt: null, seenWelcome: false, resetNotice: null }));
        for (const p of S.profiles) await save(p);
      }
      // Migração da versão 0.1: cor do gato -> mascote escolhido
      for (const p of S.profiles) {
        if (!p.pet || !Pet.list[p.pet]) {
          p.pet = p.owner ? 'gato-cinza' : 'gato-laranja';
          delete p.color;
          if (p.prefs.bed === undefined) p.prefs.bed = true;
          await save(p);
        }
      }
      // Ordem fixa: Mãe primeiro, Eu depois (o dono por último)
      S.profiles.sort((a, b) => Number(a.owner) - Number(b.owner));
      // Pede ao Android pra não apagar os dados quando faltar espaço
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      go('profiles');
      try { history.replaceState({ root: 1 }, ''); } catch (e2) { /* ignora */ }
      armBack();
    } catch (e) {
      const dbErr = e && (e.name === 'InvalidStateError' || e.name === 'UnknownError' || /indexeddb|database/i.test(e.message || ''));
      $app.innerHTML = dbErr
        ? `<main class="screen center"><h2 class="h2">Não consegui abrir o banco de dados</h2>
          <p>Pode ser modo anônimo ou navegador antigo. Abra no Chrome normal.</p><p class="tiny">${esc(e.message || e)}</p></main>`
        : `<main class="screen center"><h2 class="h2">O app está se atualizando</h2>
          <p>Seus dados estão guardados, nada foi apagado. Feche o app e abra de novo daqui a alguns minutos.</p>
          <button class="btn primary" onclick="location.reload()">Tentar de novo</button><p class="tiny">${esc(e.message || e)}</p></main>`;
    }
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  init();
})();
