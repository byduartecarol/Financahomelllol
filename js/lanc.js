/* Etapa 2: contas e cartões (etiquetas), lançar gastos/receitas, extrato.
   Registros no store "records" (por perfil):
   - wallet: { type:'wallet', kind:'conta'|'cartao', name, closeDay, dueDay }
   - tx:     { type:'tx', dir:'out'|'in', cents, cat, pay, wallet, ess, parcelas, desc, date:'AAAA-MM-DD' } */
(function () {
  window.Lanc = function (X) {
    const { S, esc } = X;
    const M = window.Money;
    const brl = M.brl;
    const today = () => M.ymd(new Date());

    /* ---------- dados ---------- */
    const txs = () => S.recs.filter((r) => r.type === 'tx');
    const monthTx = () => txs().filter((r) => String(r.date).slice(0, 7) === M.mkey(S.month));
    const wallets = (kind) => S.recs.filter((r) => r.type === 'wallet' && (!kind || r.kind === kind))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const wname = (id) => (S.recs.find((r) => r.id === id) || {}).name;
    const sortTx = (a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

    const syncCats = () => M.setCustom(S.recs.filter((r) => r.type === 'cat'));
    async function reload() { S.recs = S.cur ? await DB.byProfile(S.cur.id) : []; syncCats(); }
    async function put(rec) {
      rec.profileId = S.cur.id;
      await DB.put('records', rec);
      const i = S.recs.findIndex((r) => r.id === rec.id);
      if (i >= 0) S.recs[i] = rec; else S.recs.push(rec);
      if (rec.type === 'cat') syncCats();
    }
    async function del(id) { await DB.del('records', id); S.recs = S.recs.filter((r) => r.id !== id); syncCats(); }
    const balanceLabel = (v) => v < 0 ? 'Ficou negativo' : 'Sobrou';

    /* ---------- pedacinhos de tela ---------- */
    const btns = (action, opts, value, cls = 'chip') => opts.map(([v, l]) =>
      `<button class="${cls} ${String(value) === String(v) ? 'on' : ''}" data-action="${action}" data-v="${esc(v)}" aria-pressed="${String(value) === String(v)}">${l}</button>`).join('');

    function txRow(r) {
      const c = M.cat(r.cat);
      const bits = [];
      if (r.desc) bits.push(c.nome);
      if (r.pay) bits.push(M.pay(r.pay).nome);
      if (r.wallet && wname(r.wallet)) bits.push(wname(r.wallet));
      if (r.parcelas > 1) bits.push(`${r.parcelas}x de ${brl(Math.round(r.cents / r.parcelas))}`);
      if (r.dir === 'out' && r.ess === false) bits.push('não essencial');
      return `<button class="tx-row" data-action="editTx" data-id="${esc(r.id)}">
        <span class="tx-emo" aria-hidden="true">${c.emo}</span>
        <span class="tx-mid"><b>${esc(r.desc || c.nome)}</b><small>${esc(bits.join(' · '))}</small></span>
        <span class="tx-amt ${r.dir}">${r.dir === 'out' ? '−' : '+'}${brl(r.cents)}</span></button>`;
    }

    function monthNav() {
      return `<section class="month-nav">
        <button class="round" data-action="month" data-d="-1" aria-label="Mês anterior">‹</button>
        <b>${X.monthLabel(S.month)}</b>
        <button class="round" data-action="month" data-d="1" aria-label="Próximo mês">›</button></section>`;
    }

    /* ---------- tela inicial: blocos ---------- */
    function home() {
      const all = monthTx();
      const out = M.sum(all.filter((r) => r.dir === 'out'));
      const inn = M.sum(all.filter((r) => r.dir === 'in'));
      const recent = all.slice().sort(sortTx).slice(0, 4);
      const bal = inn - out;
      return `<section class="card total">
          <span>Saiu em ${X.monthLabel(S.month).split(' de ')[0].toLowerCase()}</span>
          <strong>${brl(out)}</strong>
          <span class="sub">Entrou ${brl(inn)}</span>
          <span class="bal ${bal < 0 ? 'neg-pill' : ''}">${bal < 0 ? '⚠️ ' : ''}${balanceLabel(bal)}: <b>${brl(bal)}</b></span>
        </section>
        <div class="add-row">
          <button class="btn primary big-add" data-action="novo" data-dir="out">＋ Lançar gasto</button>
          <button class="btn big-add in" data-action="novo" data-dir="in">＋ Receita</button>
        </div>
        <section class="card">
          <h3>Últimos lançamentos</h3>
          ${recent.length ? `<div class="tx-list">${recent.map(txRow).join('')}</div>
            <button class="link" data-action="tab" data-v="extrato">Ver extrato completo</button>`
            : '<p class="empty">Nada anotado neste mês ainda.</p>'}
        </section>
        <section class="card soft">
          <h3>Contas fixas</h3>
          <p class="empty">Aluguel, luz, internet… com checklist e lembrete chegam na etapa 4.</p>
        </section>`;
    }

    function moodOnEnter(p) {
      const n = monthTx().length;
      if (!n) return { mood: 'dormindo', fala: X.catFala(X.tone(p), 'vazio') };
      const out = M.sum(monthTx().filter((r) => r.dir === 'out'));
      return { mood: 'normal', fala: X.catFala(X.tone(p), 'resumo').replace('{saiu}', brl(out)).replace('{n}', n) };
    }

    /* ---------- lançar / editar ---------- */
    function newForm(dir) {
      const pr = S.cur.prefs;
      return { id: null, dir, cents: 0, cat: null, pay: dir === 'out' ? pr.lastPay || null : null,
        wallet: dir === 'out' && pr.lastPay && pr.lastPay !== 'dinheiro' ? pr.lastWallet || null : null,
        ess: null, parcelas: 1, desc: '', date: today() };
    }

    function vLancar() {
      const f = S.f;
      const catObj = f.cat ? M.cat(f.cat) : null;
      const ess = f.ess ?? (catObj ? catObj.ess : null);
      const cards = wallets('cartao'), contas = wallets('conta');
      const missing = !f.cents ? 'Digite o valor' : !f.cat ? 'Escolha a categoria' : f.dir === 'out' && !f.pay ? 'Escolha a forma de pagamento' : '';
      const keys = [['1', '2', '3', '+10'], ['4', '5', '6', '+20'], ['7', '8', '9', '+50'], ['00', '0', 'del', '+100']];
      const walletChips = (list) => btns('fwallet', list.map((w) => [w.id, esc(w.name)]), f.wallet);
      let paySec = '';
      if (f.dir === 'out') {
        paySec = `<section class="card"><h3>Forma de pagamento</h3>
          <div class="chips">${btns('fpay', M.PAYS.map((p) => [p.id, `${p.emo} ${p.nome}`]), f.pay)}</div>
          ${f.pay === 'credito' ? `
            <label class="lbl">Qual cartão?</label>
            ${cards.length ? `<div class="chips">${walletChips(cards)}</div>` : ''}
            <button class="link" data-action="newWallet" data-kind="cartao" data-ret="lancar">＋ Cadastrar cartão</button>
            <label class="lbl">Parcelas</label>
            <div class="stepper"><button class="round" data-action="fparc" data-d="-1" aria-label="Menos parcelas">−</button>
              <b>${f.parcelas}x</b><button class="round" data-action="fparc" data-d="1" aria-label="Mais parcelas">+</button>
              ${f.parcelas > 1 && f.cents ? `<span class="small">de ${brl(Math.round(f.cents / f.parcelas))}</span>` : ''}</div>`
          : (f.pay === 'pix' || f.pay === 'debito') ? `
            <label class="lbl">De qual conta? <span class="tiny">(opcional)</span></label>
            ${contas.length ? `<div class="chips">${walletChips(contas)}</div>` : ''}
            <button class="link" data-action="newWallet" data-kind="conta" data-ret="lancar">＋ Cadastrar conta</button>` : ''}
        </section>
        <section class="card"><h3>Era essencial?</h3>
          <div class="seg">${btns('fess', [['1', 'Sim, essencial'], ['0', 'Não essencial']], ess === null ? '' : ess ? '1' : '0', '')}</div>
          <p class="tiny">${catObj ? `Sugestão pela categoria: ${catObj.ess ? 'essencial' : 'não essencial'}. Pode trocar.` : 'Escolha a categoria que eu sugiro.'}</p>
        </section>`;
      } else {
        paySec = `<section class="card"><h3>Entrou em qual conta? <span class="tiny">(opcional)</span></h3>
          ${contas.length ? `<div class="chips">${walletChips(contas)}</div>` : ''}
          <button class="link" data-action="newWallet" data-kind="conta" data-ret="lancar">＋ Cadastrar conta</button></section>`;
      }
      return `<div class="page form-page">
        <header class="topbar"><button class="icon-btn" data-action="lancBack">‹ Voltar</button>
          <div class="who"><b>${f.id ? 'Editar' : 'Novo'} ${f.dir === 'out' ? 'gasto' : 'receita'}</b></div></header>
        <main class="content">
          ${f.id ? '' : `<div class="seg">${btns('fdir', [['out', 'Gasto'], ['in', 'Receita']], f.dir, '')}</div>`}
          <section class="amount ${f.dir}">
            <span class="amt">${brl(f.cents)}</span>
            ${f.cents ? '<button class="link" data-action="nclear">limpar</button>' : '<span class="tiny">Digite o valor ou use os botões +</span>'}
          </section>
          <div class="numpad">${keys.flat().map((k) => k === 'del'
            ? '<button class="nk ghost" data-action="nk" data-k="del" aria-label="Apagar">⌫</button>'
            : `<button class="nk ${k[0] === '+' ? 'plus' : ''}" data-action="nk" data-k="${k}">${k}</button>`).join('')}</div>
          <section class="card"><h3>Categoria</h3>
            <div class="cat-grid">${M.cats(f.dir).map((c) => `<button class="cat-chip ${f.cat === c.id ? 'on' : ''}" data-action="fcat" data-v="${esc(c.id)}"><span class="emo" aria-hidden="true">${esc(c.emo)}</span>${esc(c.nome)}</button>`).join('')}
              <button class="cat-chip new" data-action="newCat" data-ret="lancar"><span class="emo" aria-hidden="true">＋</span>Nova categoria</button></div>
          </section>
          ${paySec}
          <section class="card"><h3>Detalhes</h3>
            <label class="lbl" for="fdesc">Descrição <span class="tiny">(opcional)</span></label>
            <input class="field" id="fdesc" maxlength="60" value="${esc(f.desc)}" placeholder="${f.dir === 'out' ? 'Ex.: compra do mês' : 'Ex.: salário de novembro'}">
            <label class="lbl">Data</label>
            <div class="chips">${btns('fdate', [[today(), 'Hoje'], [M.ymd(new Date(Date.now() - 86400000)), 'Ontem']], f.date)}
              <input type="date" class="field date" id="fdate" value="${esc(f.date)}" aria-label="Outra data"></div>
          </section>
          <button class="btn primary wide big-save" data-action="fsave" ${missing ? 'disabled' : ''}>Salvar</button>
          ${missing ? `<p class="tiny center-t">${missing}</p>` : ''}
          ${f.id ? '<button class="btn danger-outline wide" data-action="fdel">Apagar lançamento</button>' : ''}
        </main></div>`;
    }

    /* ---------- extrato ---------- */
    function vExtrato() {
      const all = monthTx();
      const outL = all.filter((r) => r.dir === 'out');
      const out = M.sum(outL), inn = M.sum(all.filter((r) => r.dir === 'in'));
      const ess = M.sum(outL.filter((r) => r.ess !== false));
      const filt = S.xfilter || 'todos';
      const xpay = S.xpay || '';
      const list = all.filter((r) => (filt === 'todos' || (filt === 'out' ? r.dir === 'out' : r.dir === 'in')) && (!xpay || r.pay === xpay)).sort(sortTx);
      const byPay = M.PAYS.map((p) => ({ ...p, total: M.sum(outL.filter((r) => r.pay === p.id)) }));
      const groups = [];
      list.forEach((r) => { const g = groups[groups.length - 1]; if (g && g.date === r.date) g.items.push(r); else groups.push({ date: r.date, items: [r] }); });
      return `<div class="page">
        <header class="topbar"><div class="who"><small>Extrato de</small><b>${esc(S.cur.name)}</b></div></header>
        <main class="content">
          ${X.desktopWarn()}
          ${monthNav()}
          <section class="sum3">
            <div><small>Entrou</small><b class="pos">${brl(inn)}</b></div>
            <div><small>Saiu</small><b class="neg">${brl(out)}</b></div>
            <div class="${inn - out < 0 ? 'neg-box' : ''}"><small>${balanceLabel(inn - out)}</small><b class="${inn - out < 0 ? 'neg' : ''}">${brl(inn - out)}</b></div>
          </section>
          ${out ? `<section class="card">
            <div class="essbar" role="img" aria-label="Essencial ${Math.round(ess / out * 100)}%"><div style="width:${(ess / out * 100).toFixed(1)}%"></div></div>
            <div class="ess-legend"><span><i class="k ess"></i>Essencial <b>${brl(ess)}</b></span><span><i class="k"></i>Não essencial <b>${brl(out - ess)}</b></span></div>
          </section>` : ''}
          ${out ? `<section class="card"><h3>Por forma de pagamento</h3>
            <div class="pay-grid">${byPay.map((p) => `<button class="pay-box ${xpay === p.id ? 'on' : ''}" data-action="xpay" data-v="${p.id}" aria-pressed="${xpay === p.id}">
              <span>${p.emo} ${p.nome}</span><b>${brl(p.total)}</b></button>`).join('')}</div>
            ${xpay ? `<button class="link" data-action="xpay" data-v="">Mostrar todas as formas</button>` : '<p class="tiny">Toque numa forma pra ver só os gastos dela.</p>'}
          </section>` : ''}
          <div class="chips">${btns('xfilter', [['todos', 'Tudo'], ['out', 'Gastos'], ['in', 'Receitas']], filt)}</div>
          ${xpay ? `<p class="small">Mostrando só gastos em <b>${M.pay(xpay).nome}</b>: ${brl(M.sum(list))}</p>` : ''}
          ${groups.length ? groups.map((g) => `<section class="day"><h4>${M.dayLabel(g.date)}</h4><div class="tx-list">${g.items.map(txRow).join('')}</div></section>`).join('')
            : `<section class="card"><p class="empty">Nenhum lançamento ${filt === 'in' ? 'de receita ' : filt === 'out' ? 'de gasto ' : ''}neste mês.</p></section>`}
        </main>${X.nav('extrato')}</div>`;
    }

    /* ---------- carteira (contas e cartões) ---------- */
    function vCarteira() {
      const mt = monthTx();
      const used = (id) => M.sum(mt.filter((r) => r.wallet === id && r.dir === 'out'));
      const row = (w) => `<button class="w-row" data-action="openWallet" data-id="${esc(w.id)}">
        <span class="w-ico" aria-hidden="true">${w.kind === 'cartao' ? '💳' : '🏦'}</span>
        <span class="tx-mid"><b>${esc(w.name)}</b><small>${w.kind === 'cartao' ? `Fecha dia ${w.closeDay} · vence dia ${w.dueDay}` : 'Conta'}${used(w.id) ? ` · gastos no mês ${brl(used(w.id))}` : ''}</small></span>
        <span class="chev" aria-hidden="true">›</span></button>`;
      const contas = wallets('conta'), cards = wallets('cartao');
      return `<div class="page">
        <header class="topbar"><div class="who"><small>Carteira de</small><b>${esc(S.cur.name)}</b></div></header>
        <main class="content">
          <p class="small">São só nomes pra organizar seus lançamentos. O app <b>nunca</b> se conecta ao banco.</p>
          <section class="card"><h3>Contas</h3>
            ${contas.length ? contas.map(row).join('') : '<p class="empty">Nenhuma conta ainda. Ex.: Conta Nubank, Poupança Caixa.</p>'}
            <button class="btn wide" data-action="newWallet" data-kind="conta">＋ Adicionar conta</button></section>
          <section class="card"><h3>Cartões de crédito</h3>
            ${cards.length ? cards.map(row).join('') : '<p class="empty">Nenhum cartão ainda.</p>'}
            <button class="btn wide" data-action="newWallet" data-kind="cartao">＋ Adicionar cartão</button></section>
        </main>${X.nav('carteira')}</div>`;
    }

    function vWallet() {
      const w = S.w;
      const days = Array.from({ length: 31 }, (_, i) => i + 1);
      const sel = (id, v) => `<select class="field" id="${id}">${days.map((d) => `<option value="${d}" ${Number(v) === d ? 'selected' : ''}>Dia ${d}</option>`).join('')}</select>`;
      return `<div class="page form-page">
        <header class="topbar"><button class="icon-btn" data-action="wBack">‹ Voltar</button>
          <div class="who"><b>${w.id ? 'Editar' : 'Novo'} ${w.kind === 'cartao' ? 'cartão' : 'conta'}</b></div></header>
        <main class="content">
          ${w.id ? '' : `<div class="seg">${btns('wkind', [['conta', '🏦 Conta'], ['cartao', '💳 Cartão de crédito']], w.kind, '')}</div>`}
          <section class="card">
            <label class="lbl" for="wname">Nome</label>
            <input class="field" id="wname" maxlength="30" value="${esc(w.name)}" placeholder="${w.kind === 'cartao' ? 'Ex.: Cartão Nubank' : 'Ex.: Conta Nubank'}">
            <div class="chips sugs">${M.BANCOS.map((b) => `<button class="chip sm" data-action="wsug" data-v="${esc(b)}">${esc(b)}</button>`).join('')}</div>
            ${w.kind === 'cartao' ? `
              <div class="two">
                <div><label class="lbl" for="wclose">Fecha no</label>${sel('wclose', w.closeDay)}</div>
                <div><label class="lbl" for="wdue">Vence no</label>${sel('wdue', w.dueDay)}</div>
              </div>
              <p class="tiny">Compras feitas depois do fechamento entram na fatura seguinte. A fatura completa chega na etapa 3.</p>` : ''}
          </section>
          <button class="btn primary wide big-save" data-action="wsave">Salvar</button>
          ${w.id ? '<button class="btn danger-outline wide" data-action="wdel">Apagar</button>' : ''}
        </main></div>`;
    }

    function vWDetail() {
      const w = S.recs.find((r) => r.id === S.wd);
      if (!w) return vCarteira();
      const list = monthTx().filter((r) => r.wallet === w.id).sort(sortTx);
      const out = M.sum(list.filter((r) => r.dir === 'out')), inn = M.sum(list.filter((r) => r.dir === 'in'));
      return `<div class="page">
        <header class="topbar"><button class="icon-btn" data-action="wdBack">‹ Voltar</button>
          <div class="who"><b>${esc(w.name)}</b><small>${w.kind === 'cartao' ? `Fecha dia ${w.closeDay} · vence dia ${w.dueDay}` : 'Conta'}</small></div>
          <button class="icon-btn" data-action="editWallet" data-id="${esc(w.id)}">Editar</button></header>
        <main class="content">
          ${monthNav()}
          <section class="card total">
            <span>${w.kind === 'cartao' ? 'Gasto no cartão' : 'Saiu desta conta'} em ${X.monthLabel(S.month).split(' de ')[0].toLowerCase()}</span>
            <strong>${brl(out)}</strong>
            ${inn ? `<span class="sub">Entrou ${brl(inn)}</span>` : ''}
          </section>
          ${w.kind === 'cartao' ? '<p class="tiny">Aqui aparecem as compras feitas no mês. A fatura (fechamento, parcelas e valor que já existia) chega na etapa 3.</p>' : ''}
          <section class="card"><h3>Lançamentos</h3>
            ${list.length ? `<div class="tx-list">${list.map(txRow).join('')}</div>` : '<p class="empty">Nada neste mês.</p>'}
          </section>
          <button class="btn primary wide" data-action="novoWallet" data-id="${esc(w.id)}">＋ Lançar ${w.kind === 'cartao' ? 'compra neste cartão' : 'gasto desta conta'}</button>
        </main>${X.nav('carteira')}</div>`;
    }

    function vCatForm() {
      const c = S.c;
      return `<div class="page form-page">
        <header class="topbar"><button class="icon-btn" data-action="cBack">‹ Voltar</button>
          <div class="who"><b>${c.id ? 'Editar' : 'Nova'} categoria</b></div></header>
        <main class="content">
          ${c.id ? '' : `<div class="seg">${btns('cdir', [['out', 'De gasto'], ['in', 'De receita']], c.dir, '')}</div>`}
          <section class="card">
            <div class="cat-prev"><span class="emo">${esc(c.emo)}</span><b>${esc(c.name || 'Sua categoria')}</b></div>
            <label class="lbl" for="cname">Nome</label>
            <input class="field" id="cname" maxlength="24" value="${esc(c.name)}" placeholder="Ex.: Academia, Gasolina, Igreja">
            <label class="lbl">Emoji</label>
            <div class="emoji-grid">${M.EMOJIS.map((e) => `<button class="emo-btn ${c.emo === e ? 'on' : ''}" data-action="cemo" data-v="${e}" aria-label="Emoji ${e}">${e}</button>`).join('')}</div>
            <label class="lbl" for="cemoji">Ou digite outro emoji</label>
            <input class="field emo-in" id="cemoji" maxlength="8" placeholder="🙂">
            ${c.dir === 'out' ? `<label class="lbl">Normalmente é…</label>
              <div class="seg">${btns('cess', [['1', 'Essencial'], ['0', 'Não essencial']], c.ess ? '1' : '0', '')}</div>` : ''}
          </section>
          <button class="btn primary wide big-save" data-action="csave">Salvar categoria</button>
          ${c.id ? '<button class="btn danger-outline wide" data-action="cdel">Apagar categoria</button>' : ''}
        </main></div>`;
    }

    // Categorias da pessoa, para a tela de Ajustes
    function settingsCats() {
      const mine = M.customList();
      return `<section class="card"><h3>Minhas categorias</h3>
        ${mine.length ? mine.map((c) => `<button class="w-row" data-action="editCat" data-id="${esc(c.id)}"><span class="w-ico">${esc(c.emo)}</span>
          <span class="tx-mid"><b>${esc(c.nome)}</b><small>${c.dir === 'in' ? 'Receita' : c.ess ? 'Gasto essencial' : 'Gasto não essencial'}</small></span><span class="chev">›</span></button>`).join('')
          : '<p class="empty">Você ainda não criou nenhuma. As categorias padrão continuam lá.</p>'}
        <button class="btn wide" data-action="newCat">＋ Nova categoria</button></section>`;
    }

    function readC() {
      const n = document.getElementById('cname'); if (n && S.c) S.c.name = n.value;
      const e = document.getElementById('cemoji');
      if (e && e.value.trim() && S.c) {
        const seg = window.Intl && Intl.Segmenter ? [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(e.value.trim())][0].segment : e.value.trim().slice(0, 2);
        S.c.emo = seg;
      }
    }

    function readW() {
      const n = document.getElementById('wname');
      if (n) S.w.name = n.value;
      const c = document.getElementById('wclose'), d = document.getElementById('wdue');
      if (c) S.w.closeDay = Number(c.value);
      if (d) S.w.dueDay = Number(d.value);
    }
    function readF() {
      const d = document.getElementById('fdesc');
      if (d && S.f) S.f.desc = d.value;
    }

    /* ---------- "sair sem salvar?" ---------- */
    const snapF = (f) => JSON.stringify([f.dir, f.cents, f.cat, f.pay, f.wallet, f.ess, f.parcelas, (f.desc || '').trim(), f.date]);
    function fDirty() { if (!S.f) return false; readF(); return S.f0 ? snapF(S.f) !== S.f0 : !!(S.f.cents || S.f.cat || (S.f.desc || '').trim()); }
    function wDirty() { if (!S.w) return false; readW(); return JSON.stringify([S.w.kind, S.w.name.trim(), S.w.closeDay, S.w.dueDay]) !== S.w0; }
    function cDirty() { if (!S.c) return false; readC(); return JSON.stringify([S.c.dir, S.c.name.trim(), S.c.emo, S.c.ess]) !== S.c0; }
    async function leave(dirty, what) {
      if (!dirty) return true;
      return X.modal({ title: 'Sair sem salvar?', html: `<p>Você mexeu ${what} e ainda não tocou em <b>Salvar</b>.</p>`,
        buttons: [{ label: 'Continuar editando', value: false }, { label: 'Sair sem salvar', value: true, kind: 'danger' }] });
    }
    const goBackTo = (v) => X.go(v && !['lancar', 'wallet', 'catform'].includes(v) ? v : 'home');

    /* ---------- ações ---------- */
    const actions = {
      novo(d) { S.lancReturn = S.view; S.f = newForm(d.dir || 'out'); S.f0 = null; X.go('lancar'); },
      novoWallet(d) {
        const w = S.recs.find((r) => r.id === d.id); if (!w) return;
        S.lancReturn = 'wdetail'; S.f = newForm('out'); S.f0 = null;
        S.f.wallet = w.id; S.f.pay = w.kind === 'cartao' ? 'credito' : (S.f.pay === 'debito' ? 'debito' : 'pix');
        X.go('lancar');
      },
      editTx(d) {
        const r = S.recs.find((x) => x.id === d.id);
        if (!r) return;
        S.lancReturn = S.view;
        S.f = { ...r, parcelas: r.parcelas || 1, desc: r.desc || '', wallet: r.wallet || null };
        S.f0 = snapF(S.f);
        X.go('lancar');
      },
      fdir(d) { readF(); S.f = { ...newForm(d.v), cents: S.f.cents, desc: S.f.desc, date: S.f.date }; X.render(); },
      nk(d) {
        readF();
        const f = S.f, k = d.k;
        if (k === 'del') f.cents = Math.floor(f.cents / 10);
        else if (k === '00') f.cents *= 100;
        else if (k[0] === '+') f.cents += Number(k.slice(1)) * 100;
        else f.cents = f.cents * 10 + Number(k);
        f.cents = Math.min(f.cents, 99999999);
        X.render();
      },
      nclear() { readF(); S.f.cents = 0; X.render(); },
      fcat(d) { readF(); S.f.cat = d.v; S.f.ess = null; X.render(); },
      fpay(d) {
        readF();
        S.f.pay = d.v;
        if (d.v === 'dinheiro') S.f.wallet = null;
        const w = S.recs.find((r) => r.id === S.f.wallet);
        if (w && ((d.v === 'credito') !== (w.kind === 'cartao'))) S.f.wallet = null;
        if (d.v === 'credito' && !S.f.wallet) { const cs = wallets('cartao'); if (cs.length === 1) S.f.wallet = cs[0].id; }
        if (d.v !== 'credito') S.f.parcelas = 1;
        X.render();
      },
      fwallet(d) { readF(); S.f.wallet = S.f.wallet === d.v ? null : d.v; X.render(); },
      fparc(d) { readF(); S.f.parcelas = Math.max(1, Math.min(24, S.f.parcelas + Number(d.d))); X.render(); },
      fess(d) { readF(); S.f.ess = d.v === '1'; X.render(); },
      fdate(d) { readF(); S.f.date = d.v; X.render(); },
      async lancBack() {
        if (!(await leave(fDirty(), 'neste lançamento'))) return;
        S.f = null; goBackTo(S.lancReturn);
      },
      async fsave() {
        readF();
        const f = S.f;
        if (!f || !f.cents || !f.cat || (f.dir === 'out' && !f.pay)) return;
        const rec = {
          id: f.id || Sec.uid(), type: 'tx', dir: f.dir, cents: f.cents, cat: f.cat,
          pay: f.dir === 'out' ? f.pay : null, wallet: f.wallet || null,
          ess: f.dir === 'out' ? (f.ess ?? M.cat(f.cat).ess) : null,
          parcelas: f.dir === 'out' && f.pay === 'credito' ? f.parcelas : 1,
          desc: (f.desc || '').trim().slice(0, 60), date: f.date || today(),
          createdAt: f.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await put(rec);
        if (rec.dir === 'out') { S.cur.prefs.lastPay = rec.pay; S.cur.prefs.lastWallet = rec.wallet; await X.save(S.cur); }
        const wasEdit = !!f.id;
        S.f = null;
        S.month = new Date(M.parse(rec.date).getFullYear(), M.parse(rec.date).getMonth(), 1);
        if (wasEdit) { goBackTo(S.lancReturn); X.toast('Lançamento atualizado.'); return; }
        const t = X.tone(S.cur);
        const income = M.sum(monthTx().filter((r) => r.dir === 'in'));
        const outM = M.sum(monthTx().filter((r) => r.dir === 'out'));
        const back = S.lancReturn === 'wdetail' ? 'wdetail' : 'home';
        if (back === 'wdetail') { X.go('wdetail'); X.toast(X.catFala(t, 'gastoSalvo')); return; }
        if (rec.dir === 'out' && income > 0 && outM > income && outM - rec.cents <= income) {
          S.mood = 'preocupado'; S.fala = X.catFala(t, 'negativo'); X.go('home');
        } else if (rec.dir === 'in') {
          S.mood = 'feliz'; S.fala = X.catFala(t, 'receitaSalva'); X.go('home'); X.celebrate();
        } else if (M.isBig(rec.cents, income)) {
          S.mood = 'surpreso'; S.fala = X.catFala(t, 'gastoAlto'); X.go('home');
          setTimeout(() => X.pops(['!?']), 150);
        } else {
          S.mood = 'feliz'; S.fala = X.catFala(t, 'gastoSalvo'); X.go('home');
        }
      },
      async fdel() {
        const ok = await X.modal({ title: 'Apagar lançamento?', html: '<p>Ele some do extrato e dos totais. Não dá pra desfazer.</p>',
          buttons: [X.CANCEL, { label: 'Apagar', value: true, kind: 'danger' }] });
        if (!ok) return;
        await del(S.f.id);
        S.f = null;
        goBackTo(S.lancReturn);
        X.toast(X.catFala(X.tone(S.cur), 'apagado'));
      },
      xfilter(d) { S.xfilter = d.v; if (d.v === 'in') S.xpay = ''; X.render(); },
      xpay(d) { S.xpay = S.xpay === d.v ? '' : d.v; if (S.xpay) S.xfilter = 'out'; X.render(); },
      openWallet(d) { S.wd = d.id; X.go('wdetail'); },
      wdBack() { X.go('carteira'); },

      newCat(d) {
        if (S.view === 'lancar') readF();
        S.cReturn = d.ret || 'settings';
        S.c = { id: null, dir: S.view === 'lancar' && S.f ? S.f.dir : 'out', name: '', emo: '🏷️', ess: false };
        S.c0 = JSON.stringify([S.c.dir, '', S.c.emo, S.c.ess]);
        X.go('catform');
      },
      editCat(d) {
        const r = S.recs.find((x) => x.id === d.id); if (!r) return;
        S.cReturn = 'settings'; S.c = { ...r, ess: !!r.ess };
        S.c0 = JSON.stringify([S.c.dir, S.c.name.trim(), S.c.emo, S.c.ess]);
        X.go('catform');
      },
      cdir(d) { readC(); S.c.dir = d.v; X.render(); },
      cemo(d) { readC(); S.c.emo = d.v; const e = document.getElementById('cemoji'); if (e) e.value = ''; X.render(); },
      cess(d) { readC(); S.c.ess = d.v === '1'; X.render(); },
      async cBack() {
        if (!(await leave(cDirty(), 'nesta categoria'))) return;
        S.c = null; X.go(S.cReturn === 'lancar' && S.f ? 'lancar' : 'settings');
      },
      async csave() {
        readC();
        const c = S.c;
        if (!c.name.trim()) return X.toast('Dê um nome pra categoria.');
        const dup = M.cats(c.dir).find((x) => x.id !== c.id && x.nome.toLowerCase() === c.name.trim().toLowerCase());
        if (dup) return X.toast(`Já existe a categoria "${dup.nome}".`);
        const rec = { id: c.id || 'c-' + Sec.uid(), type: 'cat', dir: c.dir, name: c.name.trim().slice(0, 24), emo: c.emo || '🏷️',
          ess: c.dir === 'out' ? !!c.ess : null, archived: false, createdAt: c.createdAt || new Date().toISOString() };
        await put(rec);
        S.c = null;
        if (S.cReturn === 'lancar' && S.f) { S.f.cat = rec.id; S.f.ess = null; X.go('lancar'); }
        else X.go('settings');
        X.toast('Categoria salva.');
      },
      async cdel() {
        const n = txs().filter((r) => r.cat === S.c.id).length;
        const ok = await X.modal({ title: `Apagar "${esc(S.c.name)}"?`,
          html: n ? `<p>${n} lançamento(s) usam essa categoria. Eles continuam no extrato com o mesmo nome, ela só some da lista de escolha.</p>` : '<p>Ela some da lista de escolha.</p>',
          buttons: [X.CANCEL, { label: 'Apagar', value: true, kind: 'danger' }] });
        if (!ok) return;
        const r = S.recs.find((x) => x.id === S.c.id);
        if (n && r) await put({ ...r, archived: true }); else await del(S.c.id);
        S.c = null; X.go('settings');
      },

      newWallet(d) {
        if (S.view === 'lancar') readF();
        S.wReturn = d.ret || 'carteira';
        S.w = { id: null, kind: d.kind || 'conta', name: '', closeDay: 1, dueDay: 10 };
        S.w0 = JSON.stringify([S.w.kind, '', 1, 10]);
        X.go('wallet');
      },
      editWallet(d) {
        const w = S.recs.find((r) => r.id === d.id); if (!w) return;
        S.wReturn = S.view === 'wdetail' ? 'wdetail' : 'carteira'; S.w = { ...w };
        S.w0 = JSON.stringify([w.kind, w.name.trim(), w.closeDay, w.dueDay]);
        X.go('wallet');
      },
      wkind(d) { readW(); S.w.kind = d.v; S.w0 = JSON.stringify([d.v, '', 1, 10]); X.render(); },
      wsug(d) {
        const n = document.getElementById('wname');
        const v = (S.w.kind === 'cartao' ? 'Cartão ' : 'Conta ') + d.v;
        if (n) { n.value = v; n.focus(); }
        S.w.name = v;
      },
      async wBack() {
        if (!(await leave(wDirty(), S.w && S.w.kind === 'cartao' ? 'neste cartão' : 'nesta conta'))) return;
        const ret = S.wReturn; S.w = null;
        X.go(ret === 'lancar' && S.f ? 'lancar' : ret === 'wdetail' ? 'wdetail' : 'carteira');
      },
      async wsave() {
        readW();
        const w = S.w;
        if (!w.name.trim()) return X.toast('Dê um nome, tipo "Conta Nubank".');
        const rec = { id: w.id || Sec.uid(), type: 'wallet', kind: w.kind, name: w.name.trim().slice(0, 30),
          closeDay: w.kind === 'cartao' ? w.closeDay : null, dueDay: w.kind === 'cartao' ? w.dueDay : null,
          createdAt: w.createdAt || new Date().toISOString() };
        await put(rec);
        S.w = null;
        if (S.wReturn === 'lancar' && S.f) {
          S.f.wallet = rec.id;
          if (rec.kind === 'cartao') S.f.pay = 'credito';
          else if (S.f.dir === 'out' && S.f.pay !== 'pix' && S.f.pay !== 'debito') S.f.pay = 'pix';
          X.go('lancar');
        } else if (S.wReturn === 'wdetail') X.go('wdetail');
        else X.go('carteira');
        X.toast(rec.kind === 'cartao' ? 'Cartão salvo.' : 'Conta salva.');
      },
      async wdel() {
        const n = txs().filter((r) => r.wallet === S.w.id).length;
        const ok = await X.modal({ title: `Apagar "${esc(S.w.name)}"?`,
          html: n ? `<p>${n} lançamento(s) usam esse nome. Eles <b>continuam</b> no extrato, só ficam sem essa etiqueta.</p>` : '<p>Pode apagar tranquila.</p>',
          buttons: [X.CANCEL, { label: 'Apagar', value: true, kind: 'danger' }] });
        if (!ok) return;
        for (const r of txs().filter((x) => x.wallet === S.w.id)) { r.wallet = null; await put(r); }
        await del(S.w.id);
        S.w = null; S.wd = null;
        X.go('carteira');
      }
    };

    // Botão "voltar" do Android nas telas deste módulo. true = tratado aqui.
    function back() {
      const map = { lancar: 'lancBack', wallet: 'wBack', catform: 'cBack', wdetail: 'wdBack' };
      if (map[S.view]) { Promise.resolve(actions[map[S.view]]()).catch(() => {}); return true; }
      return false;
    }

    return {
      reload, home, moodOnEnter, back, settingsCats,
      views: { lancar: vLancar, extrato: vExtrato, carteira: vCarteira, wallet: vWallet, wdetail: vWDetail, catform: vCatForm },
      actions,
      onInput(e) { if (e.target.id === 'fdesc' && S.f) S.f.desc = e.target.value; },
      onChange(e) { if (e.target.id === 'fdate' && S.f && e.target.value) { readF(); S.f.date = e.target.value; X.render(); } }
    };
  };
})();
