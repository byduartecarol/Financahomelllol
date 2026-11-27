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
    const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));

    /* ---------- estado do mês (pra frases do mascote) ---------- */
    function state() {
      const all = monthTx();
      const outL = all.filter((r) => r.dir === 'out');
      const out = M.sum(outL), inn = M.sum(all.filter((r) => r.dir === 'in'));
      const noEss = M.sum(outL.filter((r) => r.ess === false));
      return { n: all.length, out, inn, bal: inn - out, noEss, pctNoEss: out ? noEss / out : 0 };
    }

    /* ---------- faturas do cartão (etapa 3) ----------
       Fatura = mês em que vence (AAAA-MM). Itens: compras no crédito (divididas em parcelas),
       "valor que já estava na fatura" (cardopen) e "parcelamento em andamento" (cardinst). */
    const openKey = (w) => M.faturaOf(today(), w.closeDay, w.dueDay);
    function faturaItems(w, key) {
      const items = [];
      txs().filter((r) => r.wallet === w.id && r.pay === 'credito' && r.dir === 'out').forEach((r) => {
        const n = r.parcelas || 1;
        const k0 = M.faturaOf(r.date, w.closeDay, w.dueDay);
        const parts = M.split(r.cents, n);
        for (let i = 0; i < n; i++) {
          if (M.addMonths(k0, i) === key) items.push({ kind: 'tx', rec: r, cents: parts[i], ess: r.ess, date: r.date, label: n > 1 ? `Parcela ${i + 1}/${n}` : '' });
        }
      });
      S.recs.filter((r) => r.type === 'cardopen' && r.wallet === w.id && r.key === key)
        .forEach((r) => items.push({ kind: 'prev', rec: r, cents: r.cents, ess: r.ess ?? null, date: '', label: 'Já estava na fatura' }));
      S.recs.filter((r) => r.type === 'cardinst' && r.wallet === w.id).forEach((r) => {
        for (let i = 0; i < r.remaining; i++) {
          if (M.addMonths(r.firstKey, i) === key) items.push({ kind: 'prev', rec: r, cents: r.parcela, ess: r.ess ?? null, date: '', label: `Parcela ${r.next + i}/${r.total} · em andamento` });
        }
      });
      return items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }
    const paidRec = (w, key) => S.recs.find((r) => r.type === 'fatpaid' && r.wallet === w.id && r.key === key);
    function faturaStatus(w, key) {
      const { close, due } = M.faturaDates(key, w.closeDay, w.dueDay);
      const t = M.parse(today());
      const days = Math.round((due - t) / 86400000);
      const base = { close, due, days };
      if (paidRec(w, key)) return { ...base, id: 'paga', label: 'Paga ✓' };
      if (t < close) return { ...base, id: 'aberta', label: 'Aberta' };
      if (days > 1) return { ...base, id: 'fechada', label: `Fechada · vence em ${days} dias` };
      if (days === 1) return { ...base, id: 'logo', label: 'Vence amanhã' };
      if (days === 0) return { ...base, id: 'hoje', label: 'Vence hoje' };
      return { ...base, id: 'atrasada', label: `Atrasada há ${-days} dia${days === -1 ? '' : 's'}` };
    }
    // Próxima fatura a pagar: a mais antiga, não paga, com valor
    function nextFatura(w) {
      const ok = openKey(w);
      for (const k of [M.addMonths(ok, -2), M.addMonths(ok, -1), ok, M.addMonths(ok, 1)]) {
        const total = M.sum(faturaItems(w, k));
        if (total > 0 && !paidRec(w, k)) return { w, key: k, total, st: faturaStatus(w, k) };
      }
      return null;
    }
    /* ---------- contas fixas (etapa 4) ----------
       bill:    { type:'bill', name, emo, kind:'fixa'|'variavel', cents (valor ou estimativa), dueDay, cat, ess, startKey }
       billpay: { type:'billpay', bill, key:'AAAA-MM', cents (valor real do mês), paidAt, txId }
       Pagar uma conta cria um lançamento (gasto) ligado a ela. */
    const BILL_SUG = [['Aluguel', '🏠', 'fixa'], ['Condomínio', '🏢', 'fixa'], ['Luz', '💡', 'variavel'], ['Água', '💧', 'variavel'], ['Gás', '🔥', 'variavel'],
      ['Internet', '📶', 'fixa'], ['Celular', '📱', 'fixa'], ['Plano de saúde', '🩺', 'fixa'], ['Escola / faculdade', '📚', 'fixa'], ['IPTU', '🏛️', 'fixa'], ['Seguro', '🛡️', 'fixa']];
    const bills = () => S.recs.filter((r) => r.type === 'bill' && !r.archived).sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name, 'pt-BR'));
    const billPay = (b, key) => S.recs.find((r) => r.type === 'billpay' && r.bill === b.id && r.key === key);
    // Variável: média dos últimos 3 meses com valor real (antes do mês pedido); sem histórico, usa a estimativa
    function billAvg(b, key) {
      const vals = S.recs.filter((r) => r.type === 'billpay' && r.bill === b.id && r.key < key && r.cents > 0)
        .sort((x, y) => y.key.localeCompare(x.key)).slice(0, 3).map((r) => r.cents);
      return vals.length ? Math.round(vals.reduce((a, c) => a + c, 0) / vals.length) : b.cents;
    }
    function dueStatus(due, paid) {
      const days = Math.round((due - M.parse(today())) / 86400000);
      if (paid) return { id: 'paga', label: 'Paga ✓', days, due };
      if (days > 3) return { id: 'aberta', label: `Vence em ${days} dias`, days, due };
      if (days > 1) return { id: 'logo', label: `Vence em ${days} dias`, days, due };
      if (days === 1) return { id: 'logo', label: 'Vence amanhã', days, due };
      if (days === 0) return { id: 'hoje', label: 'Vence hoje', days, due };
      return { id: 'atrasada', label: `Atrasada há ${-days} dia${days === -1 ? '' : 's'}`, days, due };
    }
    function billInst(b, key) {
      const bp = billPay(b, key);
      const real = bp && bp.cents ? bp.cents : null;
      const est = b.kind === 'fixa' ? b.cents : billAvg(b, key);
      const due = M.dayIn(key, b.dueDay);
      return { b, key, bp, real, est, cents: real ?? est, due, st: dueStatus(due, !!(bp && bp.paidAt)), estimated: b.kind === 'variavel' && !real };
    }
    // Tudo que vence no mês (contas fixas + faturas). No mês atual inclui atrasadas dos 2 meses anteriores.
    function dueList(key) {
      const keys = key === M.mkey(new Date()) ? [M.addMonths(key, -2), M.addMonths(key, -1), key] : [key];
      const out = [];
      keys.forEach((k) => {
        bills().filter((b) => (b.startKey || '0000-00') <= k).forEach((b) => {
          const i = billInst(b, k);
          if (k !== key && i.st.id === 'paga') return;
          out.push({ kind: 'bill', id: b.id, key: k, name: b.name + (k !== key ? ` (${M.monthName(k)})` : ''), emo: b.emo || '🧾',
            cents: i.cents, estimated: i.estimated, st: i.st, due: i.due, paid: i.st.id === 'paga' });
        });
        wallets('cartao').forEach((w) => {
          const tot = M.sum(faturaItems(w, k));
          if (!tot) return;
          const fs = faturaStatus(w, k);
          const st = fs.id === 'paga' ? dueStatus(fs.due, true) : fs.id === 'aberta' ? { ...dueStatus(fs.due, false), id: 'aberta', label: `Aberta · fecha ${M.shortDate(fs.close)}` } : dueStatus(fs.due, false);
          if (k !== key && st.id === 'paga') return;
          out.push({ kind: 'fatura', id: w.id, key: k, name: `Fatura ${w.name}` + (k !== key ? ` (${M.monthName(k)})` : ''), emo: '💳', cents: tot, st, due: fs.due, paid: st.id === 'paga' });
        });
      });
      const rank = { atrasada: 0, hoje: 1, logo: 2, aberta: 3, paga: 9 };
      return out.sort((a, b) => (rank[a.st.id] ?? 5) - (rank[b.st.id] ?? 5) || a.due - b.due);
    }
    const dueRow = (d) => `<button class="due-row ${d.paid ? 'paid' : ''}" data-action="${d.kind === 'bill' ? 'openBill' : 'openFatura'}" data-id="${esc(d.id)}" data-k="${d.key}">
        <span class="check ${d.paid ? 'on' : ''}" aria-hidden="true">${d.paid ? '✓' : ''}</span>
        <span class="tx-mid"><b>${esc(d.emo)} ${esc(d.name)}</b><small>vence ${M.shortDate(d.due)}${d.estimated ? ' · valor estimado' : ''}</small></span>
        <span class="fat-r"><b>${d.estimated ? '~' : ''}${brl(d.cents)}</b><span class="st st-${d.st.id}">${esc(d.st.label)}</span></span></button>`;

    /* Reação do mascote ao salvar um lançamento: olha o mês inteiro, não só o gasto. */
    function reaction(rec) {
      const t = X.tone(S.cur);
      const m = state();
      const vars = { valor: brl(rec.cents), cat: M.cat(rec.cat).nome, sobra: brl(m.bal), saiu: brl(m.out) };
      const say = (situ) => fill(X.catFala(t, situ), vars);
      if (rec.dir === 'in') {
        const before = m.bal - rec.cents;
        if (before < 0 && m.bal >= 0) return { mood: 'feliz', fala: say('saiuDoVermelho'), fx: 'celebrate' };
        return { mood: 'feliz', fala: say('receitaSalva'), fx: 'celebrate' };
      }
      const big = M.isBig(rec.cents, m.inn);
      const noEss = rec.ess === false;
      const wasPositive = m.bal + rec.cents >= 0;
      if (m.inn === 0) return { mood: big ? 'surpreso' : 'normal', fala: say(big ? 'gastoAlto' : 'gastoSemEntrada'), fx: big ? 'surprise' : '' };
      if (m.bal < 0 && wasPositive) return { mood: 'preocupado', fala: say('virouNegativo') };
      if (m.bal < 0) {
        if (noEss) return t === 'debochado' ? { mood: 'bravo', fala: say('gastoNegNaoEss'), fx: 'angry' } : { mood: 'preocupado', fala: say('gastoNegNaoEss') };
        return { mood: big ? 'triste' : 'preocupado', fala: say(big ? 'gastoNegAlto' : 'gastoNeg') };
      }
      if (m.bal < m.inn * 0.1) return { mood: 'preocupado', fala: say(noEss ? 'gastoApertadoNaoEss' : 'gastoApertado') };
      if (big) return { mood: 'surpreso', fala: say('gastoAlto'), fx: 'surprise' };
      return { mood: noEss ? 'normal' : 'feliz', fala: say(noEss ? 'gastoNaoEss' : 'gastoEss') };
    }

    const quando = (st) => st.days === 0 ? 'hoje' : st.days === 1 ? 'amanhã' : `em ${st.days} dias`;
    const fatLabel = (key) => `Fatura de ${M.monthName(key)}`;

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
      const cw = r.pay === 'credito' && S.recs.find((x) => x.id === r.wallet && x.kind === 'cartao');
      if (cw) bits.push(`fatura de ${M.monthName(M.faturaOf(r.date, cw.closeDay, cw.dueDay)).slice(0, 3)}`);
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
      const dl = dueList(M.mkey(S.month));
      const falta = M.sum(dl.filter((d) => !d.paid));
      const pend = dl.filter((d) => !d.paid).length;
      return `<section class="card total">
          <span>Falta pagar em ${X.monthLabel(S.month).split(' de ')[0].toLowerCase()}</span>
          <strong>${brl(falta)}</strong>
          <span class="sub">${dl.length ? (pend ? `${pend} conta(s) pendente(s)` : 'Tudo pago este mês ✓') : 'Nenhuma conta fixa cadastrada'} · saiu ${brl(out)} · entrou ${brl(inn)}</span>
          <span class="bal ${bal < 0 ? 'neg-pill' : ''}">${bal < 0 ? '⚠️ ' : ''}${balanceLabel(bal)}: <b>${brl(bal)}</b></span>
        </section>
        <div class="add-row">
          <button class="btn primary big-add" data-action="novo" data-dir="out">＋ Lançar gasto</button>
          <button class="btn big-add in" data-action="novo" data-dir="in">＋ Receita</button>
        </div>
        <section class="card"><h3>Contas do mês</h3>
          ${dl.length ? `<div class="tx-list">${dl.slice(0, 6).map(dueRow).join('')}</div>` : '<p class="empty">Cadastre aluguel, luz, internet… e elas aparecem aqui todo mês num checklist.</p>'}
          <button class="link" data-action="goContas">${dl.length ? (dl.length > 6 ? `Ver todas (${dl.length}) e cadastrar` : 'Ver todas e cadastrar') : '＋ Cadastrar contas fixas'}</button>
        </section>
        <section class="card">
          <h3>Últimos lançamentos</h3>
          ${recent.length ? `<div class="tx-list">${recent.map(txRow).join('')}</div>
            <button class="link" data-action="tab" data-v="extrato">Ver extrato completo</button>`
            : '<p class="empty">Nada anotado neste mês ainda.</p>'}
        </section>
`;
    }

    // Humor e fala ao entrar, pela situação REAL (prioridade: fatura atrasada > vencendo > negativo > …)
    function moodOnEnter(p) {
      const t = X.tone(p);
      const say = (situ, vars) => fill(X.catFala(t, situ), vars || {});
      const dl = dueList(M.mkey(new Date())).filter((d) => !d.paid);
      const late = dl.find((d) => d.st.id === 'atrasada');
      if (late) return { mood: t === 'acolhedor' ? 'preocupado' : 'triste', fala: say('contaAtrasada', { conta: late.name, valor: brl(late.cents) }) };
      const soon = dl.find((d) => ['hoje', 'logo'].includes(d.st.id));
      if (soon) return { mood: 'preocupado', fala: say('contaVencendo', { conta: soon.name, valor: brl(soon.cents), quando: quando(soon.st) }) };
      const m = state();
      const vars = { saiu: brl(m.out), sobra: brl(m.bal), pct: Math.round(m.pctNoEss * 100) + '%', n: m.n };
      if (!m.n) return { mood: 'dormindo', fala: say('vazio') };
      if (m.inn === 0 && m.out > 0) return { mood: 'normal', fala: say('semEntrada', vars) };
      if (m.bal < 0) return { mood: 'preocupado', fala: say('negativo', vars) };
      if (m.bal < m.inn * 0.1) return { mood: 'preocupado', fala: say('apertado', vars) };
      const all = dueList(M.mkey(new Date()));
      if (all.length && all.every((d) => d.paid)) return { mood: 'feliz', fala: say('tudoPago', vars) };
      if (m.out >= 10000 && m.pctNoEss >= 0.4) return { mood: 'normal', fala: say('naoEss', vars) };
      return { mood: 'feliz', fala: say('resumo', vars) };
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
        <span class="tx-mid"><b>${esc(w.name)}</b><small>${w.kind === 'cartao'
          ? (() => { const f = nextFatura(w); return f ? `${fatLabel(f.key)}: ${brl(f.total)} · ${f.st.label.toLowerCase()}` : `Fecha dia ${w.closeDay} · vence dia ${w.dueDay}`; })()
          : `Conta${used(w.id) ? ` · saiu ${brl(used(w.id))} no mês` : ''}`}</small></span>
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
          <section class="card"><h3>Formas de pagamento <span class="tiny">· ${X.monthLabel(S.month).split(' de ')[0].toLowerCase()}</span></h3>
            ${M.PAYS.map((p) => `<button class="w-row" data-action="payGo" data-v="${p.id}"><span class="w-ico" aria-hidden="true">${p.emo}</span>
              <span class="tx-mid"><b>${p.nome}</b><small>${mt.filter((r) => r.pay === p.id && r.dir === 'out').length} gasto(s) no mês</small></span>
              <span class="fat-r"><b>${brl(M.sum(mt.filter((r) => r.pay === p.id && r.dir === 'out')))}</b></span><span class="chev">›</span></button>`).join('')}
          </section>
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

    function vFatura(w) {
      const key = S.fk || (nextFatura(w) || {}).key || openKey(w);
      S.fk = key;
      const items = faturaItems(w, key);
      const total = M.sum(items);
      const ess = M.sum(items.filter((i) => i.ess === true)), noEss = M.sum(items.filter((i) => i.ess === false));
      const st = faturaStatus(w, key);
      const paid = paidRec(w, key);
      const row = (it) => {
        const r = it.rec;
        const c = it.kind === 'tx' ? M.cat(r.cat) : { emo: r.type === 'cardinst' ? '🧾' : '📌', nome: '' };
        const title = it.kind === 'tx' ? (r.desc || c.nome) : (r.desc || (r.type === 'cardinst' ? 'Parcelamento' : 'Valor que já estava na fatura'));
        const sub = [it.label, it.kind === 'tx' ? `comprado ${M.dayLabel(r.date).toLowerCase()}` : '', it.ess === false ? 'não essencial' : ''].filter(Boolean).join(' · ');
        return `<button class="tx-row" data-action="${it.kind === 'tx' ? 'editTx' : 'editPrev'}" data-id="${esc(r.id)}">
          <span class="tx-emo" aria-hidden="true">${esc(c.emo)}</span>
          <span class="tx-mid"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
          <span class="tx-amt out">${brl(it.cents)}</span></button>`;
      };
      return `<div class="page">
        <header class="topbar"><button class="icon-btn" data-action="wdBack">‹ Voltar</button>
          <div class="who"><b>${esc(w.name)}</b><small>Fecha dia ${w.closeDay} · vence dia ${w.dueDay}</small></div>
          <button class="icon-btn" data-action="editWallet" data-id="${esc(w.id)}">Editar</button></header>
        <main class="content">
          <section class="month-nav">
            <button class="round" data-action="fk" data-d="-1" aria-label="Fatura anterior">‹</button>
            <b>${fatLabel(key)}</b>
            <button class="round" data-action="fk" data-d="1" aria-label="Próxima fatura">›</button></section>
          <section class="card total fat st-bg-${st.id}">
            <span class="st st-${st.id}">${st.label}</span>
            <strong>${brl(total)}</strong>
            <span class="sub">Fecha ${M.shortDate(st.close)} · vence ${M.shortDate(st.due)}</span>
          </section>
          ${total ? `<section class="card">
            <div class="essbar"><div style="width:${(ess / total * 100).toFixed(1)}%"></div></div>
            <div class="ess-legend"><span><i class="k ess"></i>Essencial <b>${brl(ess)}</b></span><span><i class="k"></i>Não essencial <b>${brl(noEss)}</b></span></div>
            ${total - ess - noEss ? `<p class="tiny">Sem etiqueta (valores antigos): ${brl(total - ess - noEss)}</p>` : ''}
          </section>` : ''}
          <section class="card"><h3>O que tem nessa fatura</h3>
            ${items.length ? `<div class="tx-list">${items.map(row).join('')}</div>` : '<p class="empty">Nada nesta fatura.</p>'}
          </section>
          ${total ? (paid
            ? `<p class="small center-t">Paga em ${new Date(paid.paidAt).toLocaleDateString('pt-BR')}.</p><button class="btn wide" data-action="fpaid">Desmarcar pagamento</button>`
            : '<button class="btn primary wide big-save" data-action="fpaid">✓ Marquei como paga</button>') : ''}
          <button class="btn wide" data-action="novoWallet" data-id="${esc(w.id)}">＋ Lançar compra neste cartão</button>
          <button class="btn wide" data-action="newPrev" data-id="${esc(w.id)}">＋ Já tinha coisa nesse cartão?</button>
          <p class="tiny">"Já tinha coisa" serve pra colocar o valor que já estava na fatura e os parcelamentos que você já pagava antes de usar o app, sem precisar digitar compra por compra.</p>
        </main>${X.nav('carteira')}</div>`;
    }

    // "Já tinha coisa no cartão": valor anterior da fatura ou parcelamento em andamento
    function vPrev() {
      const c = S.cp;
      const w = S.recs.find((r) => r.id === c.wallet) || {};
      const ok = openKey(w);
      const keys = [M.addMonths(ok, -1), ok];
      return `<div class="page form-page">
        <header class="topbar"><button class="icon-btn" data-action="cpBack">‹ Voltar</button>
          <div class="who"><b>${esc(w.name || 'Cartão')}</b><small>O que já existia no cartão</small></div></header>
        <main class="content">
          ${c.id ? '' : `<div class="seg">${btns('cpkind', [['cardopen', 'Valor na fatura'], ['cardinst', 'Parcelamento']], c.kind, '')}</div>`}
          <section class="card">
            ${c.kind === 'cardopen'
              ? `<p class="small">O total que já estava na fatura antes de você começar a anotar aqui (olhe no app do banco).</p>
                 <label class="lbl" for="cpval">Valor</label><input class="field money" id="cpval" inputmode="decimal" placeholder="Ex.: 850,00" value="${c.cents ? (c.cents / 100).toFixed(2).replace('.', ',') : ''}">`
              : `<label class="lbl" for="cpdesc">O que é?</label><input class="field" id="cpdesc" maxlength="40" placeholder="Ex.: Geladeira" value="${esc(c.desc)}">
                 <label class="lbl" for="cpval">Valor de cada parcela</label><input class="field money" id="cpval" inputmode="decimal" placeholder="Ex.: 200,00" value="${c.cents ? (c.cents / 100).toFixed(2).replace('.', ',') : ''}">
                 <div class="two">
                   <div><label class="lbl" for="cpnext">Parcela que vem nessa fatura</label><input class="field" id="cpnext" type="number" inputmode="numeric" min="1" max="99" value="${c.next || ''}" placeholder="Ex.: 4"></div>
                   <div><label class="lbl" for="cptot">De quantas?</label><input class="field" id="cptot" type="number" inputmode="numeric" min="1" max="99" value="${c.total || ''}" placeholder="Ex.: 10"></div>
                 </div>`}
            <label class="lbl">Em qual fatura?</label>
            <div class="chips">${btns('cpkey', keys.map((k) => [k, `${fatLabel(k)}${k === ok ? ' (aberta)' : ''}`]), c.key)}</div>
            <label class="lbl">Era essencial?</label>
            <div class="seg">${btns('cpess', [['1', 'Sim'], ['0', 'Não'], ['', 'Não sei']], c.ess === null || c.ess === undefined ? '' : c.ess ? '1' : '0', '')}</div>
          </section>
          <button class="btn primary wide big-save" data-action="cpsave">Salvar</button>
          ${c.id ? '<button class="btn danger-outline wide" data-action="cpdel">Apagar</button>' : ''}
        </main></div>`;
    }

    /* ---------- telas de contas fixas ---------- */
    function vContas() {
      const key = M.mkey(S.month);
      const dl = dueList(key);
      const falta = M.sum(dl.filter((d) => !d.paid)), pago = M.sum(dl.filter((d) => d.paid));
      const list = bills();
      return `<div class="page">
        <header class="topbar"><button class="icon-btn" data-action="tab" data-v="home">‹ Início</button>
          <div class="who"><b>Contas do mês</b><small>${esc(S.cur.name)}</small></div></header>
        <main class="content">
          ${monthNav()}
          <section class="sum3 two-col">
            <div class="${falta ? 'neg-box' : ''}"><small>Falta pagar</small><b class="${falta ? 'neg' : ''}">${brl(falta)}</b></div>
            <div><small>Já pago</small><b class="pos">${brl(pago)}</b></div>
          </section>
          <section class="card"><h3>Checklist</h3>
            ${dl.length ? `<div class="tx-list">${dl.map(dueRow).join('')}</div><p class="tiny">Toque numa conta pra marcar como paga ou informar o valor que chegou.</p>`
              : '<p class="empty">Nenhuma conta neste mês.</p>'}
          </section>
          <section class="card"><h3>Minhas contas fixas</h3>
            ${list.length ? list.map((b) => `<button class="w-row" data-action="editBill" data-id="${esc(b.id)}"><span class="w-ico" aria-hidden="true">${esc(b.emo || '🧾')}</span>
              <span class="tx-mid"><b>${esc(b.name)}</b><small>${b.kind === 'fixa' ? `Fixa · ${brl(b.cents)}` : `Varia · média ~${brl(billAvg(b, key))}`} · vence dia ${b.dueDay}</small></span><span class="chev">›</span></button>`).join('')
              : '<p class="empty">Aluguel, luz, água, internet… cadastre uma vez e ela aparece todo mês.</p>'}
            <button class="btn wide" data-action="newBill">＋ Nova conta fixa</button>
          </section>
          ${list.length ? `<section class="card"><h3>Lembretes</h3>
            <p class="small">Manda os vencimentos pro <b>Google Agenda</b>: ele avisa 3 dias antes e no dia, mesmo com este app fechado.</p>
            <button class="btn primary wide" data-action="ics">📅 Mandar pro Google Agenda</button></section>` : ''}
        </main>${X.nav('home')}</div>`;
    }

    function vBillForm() {
      const b = S.b;
      const days = Array.from({ length: 31 }, (_, i) => i + 1);
      const outCats = M.cats('out');
      return `<div class="page form-page">
        <header class="topbar"><button class="icon-btn" data-action="bBack">‹ Voltar</button>
          <div class="who"><b>${b.id ? 'Editar' : 'Nova'} conta fixa</b></div></header>
        <main class="content">
          <section class="card">
            ${b.id ? '' : `<label class="lbl">Atalhos</label><div class="chips sugs">${BILL_SUG.map(([n, e]) => `<button class="chip sm" data-action="bsug" data-v="${esc(n)}">${e} ${esc(n)}</button>`).join('')}</div>`}
            <label class="lbl" for="bname">Nome</label>
            <div class="row"><span class="emo-badge">${esc(b.emo)}</span><input class="field" id="bname" maxlength="30" value="${esc(b.name)}" placeholder="Ex.: Aluguel"></div>
            <label class="lbl">O valor…</label>
            <div class="seg">${btns('bkind', [['fixa', 'É sempre o mesmo'], ['variavel', 'Muda todo mês']], b.kind, '')}</div>
            <label class="lbl" for="bval">${b.kind === 'fixa' ? 'Valor' : 'Valor médio (uma estimativa)'}</label>
            <input class="field money" id="bval" inputmode="decimal" placeholder="Ex.: 150,00" value="${b.cents ? (b.cents / 100).toFixed(2).replace('.', ',') : ''}">
            ${b.kind === 'variavel' ? '<p class="tiny">Com o tempo, o app usa a média dos últimos 3 meses e pede o valor real quando a conta chegar.</p>' : ''}
            <label class="lbl" for="bdue">Vence todo dia</label>
            <select class="field" id="bdue">${days.map((d) => `<option value="${d}" ${b.dueDay === d ? 'selected' : ''}>Dia ${d}</option>`).join('')}</select>
            <label class="lbl" for="bcat">Categoria</label>
            <select class="field" id="bcat">${outCats.map((c) => `<option value="${esc(c.id)}" ${b.cat === c.id ? 'selected' : ''}>${esc(c.emo)} ${esc(c.nome)}</option>`).join('')}</select>
            <label class="lbl">É essencial?</label>
            <div class="seg">${btns('bess', [['1', 'Sim'], ['0', 'Não']], b.ess ? '1' : '0', '')}</div>
          </section>
          <button class="btn primary wide big-save" data-action="bsave">Salvar</button>
          ${b.id ? '<button class="btn danger-outline wide" data-action="bdel">Apagar conta fixa</button>' : ''}
        </main></div>`;
    }

    function vBillPay() {
      const P = S.bp;
      const b = S.recs.find((r) => r.id === P.bill);
      if (!b) return vContas();
      const i = billInst(b, P.key);
      const paid = i.st.id === 'paga';
      const tx = paid && i.bp.txId ? S.recs.find((r) => r.id === i.bp.txId) : null;
      const cards = wallets('cartao'), contas = wallets('conta');
      const hist = S.recs.filter((r) => r.type === 'billpay' && r.bill === b.id && r.cents > 0).sort((x, y) => y.key.localeCompare(x.key)).slice(0, 6);
      return `<div class="page form-page">
        <header class="topbar"><button class="icon-btn" data-action="bpBack">‹ Voltar</button>
          <div class="who"><b>${esc(b.emo || '🧾')} ${esc(b.name)}</b><small>Conta de ${M.monthName(P.key)} · vence ${M.shortDate(i.due)}</small></div>
          <button class="icon-btn" data-action="editBill" data-id="${esc(b.id)}">Editar</button></header>
        <main class="content">
          <section class="card total ${paid ? 'st-bg-paga' : i.st.id === 'atrasada' ? 'st-bg-atrasada' : ''}">
            <span class="st st-${i.st.id}">${esc(i.st.label)}</span>
            <strong>${i.estimated ? '~' : ''}${brl(i.cents)}</strong>
            <span class="sub">${i.estimated ? 'Valor estimado pela média. Quando a conta chegar, coloque o valor real.' : b.kind === 'fixa' ? 'Valor fixo' : 'Valor real deste mês'}</span>
          </section>
          ${paid ? `<p class="small center-t">Paga ${tx ? `em ${M.dayLabel(tx.date).toLowerCase()} com ${M.pay(tx.pay).nome}${tx.wallet && wname(tx.wallet) ? ' (' + esc(wname(tx.wallet)) + ')' : ''}` : ''}. O pagamento entrou no extrato como gasto.</p>
            <button class="btn wide" data-action="bunpay">Desmarcar pagamento</button>`
          : `<section class="card">
              <label class="lbl" for="bpval">Valor desta conta</label>
              <input class="field money" id="bpval" inputmode="decimal" value="${esc(S.bpVal ?? (i.cents / 100).toFixed(2).replace('.', ','))}">
              ${b.kind === 'variavel' ? `<button class="btn wide" data-action="bpvalue">Chegou a conta: salvar valor sem pagar</button>` : ''}
              <label class="lbl">Como vai pagar?</label>
              <div class="chips">${btns('bppay', M.PAYS.map((p) => [p.id, `${p.emo} ${p.nome}`]), P.pay)}</div>
              ${P.pay === 'credito' && cards.length ? `<label class="lbl">Qual cartão?</label><div class="chips">${btns('bpwallet', cards.map((w) => [w.id, esc(w.name)]), P.wallet)}</div>` : ''}
              ${(P.pay === 'pix' || P.pay === 'debito') && contas.length ? `<label class="lbl">De qual conta? <span class="tiny">(opcional)</span></label><div class="chips">${btns('bpwallet', contas.map((w) => [w.id, esc(w.name)]), P.wallet)}</div>` : ''}
            </section>
            <button class="btn primary wide big-save" data-action="bpay" ${P.pay ? '' : 'disabled'}>✓ Paguei</button>
            ${P.pay ? '' : '<p class="tiny center-t">Escolha como vai pagar</p>'}`}
          ${hist.length ? `<section class="card"><h3>Últimos meses</h3>${hist.map((h) => `<div class="hist-row"><span>${M.monthName(h.key)}</span><b>${brl(h.cents)}</b></div>`).join('')}
            <p class="tiny">Na Fase 2 isso vira gráfico.</p></section>` : ''}
        </main></div>`;
    }

    function readB() {
      if (!S.b) return;
      const n = document.getElementById('bname'); if (n) S.b.name = n.value;
      const v = document.getElementById('bval'); if (v) S.b.cents = M.parseBRL(v.value);
      const d = document.getElementById('bdue'); if (d) S.b.dueDay = Number(d.value);
      const c = document.getElementById('bcat'); if (c) S.b.cat = c.value;
    }
    const snapB = (b) => JSON.stringify([b.name.trim(), b.kind, b.cents, b.dueDay, b.cat, b.ess, b.emo]);

    // Arquivo .ics: cada conta vira 2 eventos mensais (3 dias antes e no dia), às 9h.
    function buildIcs() {
      const pad = (n) => String(n).padStart(2, '0');
      const dt = (d, h = 9) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}0000`;
      const escI = (t) => String(t).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
      const now = new Date();
      const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      // próxima data que bate com BYMONTHDAY (positivo ou negativo, -1 = último dia)
      const firstOcc = (md) => {
        for (let i = 0; i < 14; i++) {
          const base = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
          const day = md > 0 ? md : dim + md + 1;
          if (day < 1 || day > dim) continue;
          const d = new Date(base.getFullYear(), base.getMonth(), day);
          if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return d;
        }
        return now;
      };
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Financas da Casa//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escI('Contas - ' + S.cur.name)}`];
      bills().forEach((b) => {
        const valor = b.kind === 'fixa' ? brl(b.cents) : `~${brl(billAvg(b, M.mkey(now)))}`;
        const dueMd = b.dueDay > 28 ? -1 : b.dueDay;                  // dia 29-31: usa o último dia do mês
        const preMd = b.dueDay > 28 ? -4 : (b.dueDay > 3 ? b.dueDay - 3 : b.dueDay - 4); // 3 dias antes
        [['due', dueMd, `${b.emo || '🧾'} ${b.name} vence hoje (${valor})`], ['pre', preMd, `⏰ ${b.name} vence em 3 dias (${valor})`]].forEach(([tag, md, title]) => {
          const d = firstOcc(md);
          lines.push('BEGIN:VEVENT', `UID:${b.id}-${tag}@financas-casa`, `DTSTAMP:${stamp}`, `DTSTART:${dt(d)}`, `DTEND:${dt(d, 9).replace(/0000$/, '1500')}`,
            `RRULE:FREQ=MONTHLY;BYMONTHDAY=${md}`, `SUMMARY:${escI(title)}`, `DESCRIPTION:${escI('Lembrete do app Finanças da Casa. Marque como paga no app.')}`,
            'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escI(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
        });
      });
      lines.push('END:VCALENDAR');
      // Padrão do calendário: linhas com no máximo 75 bytes (continua na linha de baixo com um espaço)
      const enc = new TextEncoder();
      const fold = (ln) => {
        const out = []; let cur = ''; let bytes = 0;
        for (const ch of Array.from(ln)) {
          const n = enc.encode(ch).length;
          if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
          cur += ch; bytes += n;
        }
        out.push(cur);
        return out.join('\r\n ');
      };
      return lines.map(fold).join('\r\n') + '\r\n';
    }

    function vWDetail() {
      const w = S.recs.find((r) => r.id === S.wd);
      if (!w) return vCarteira();
      if (w.kind === 'cartao') return vFatura(w);
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

    function readCP() {
      if (!S.cp) return;
      const v = document.getElementById('cpval'); if (v) S.cp.cents = M.parseBRL(v.value);
      const d = document.getElementById('cpdesc'); if (d) S.cp.desc = d.value;
      const n = document.getElementById('cpnext'); if (n) S.cp.next = Number(n.value) || null;
      const t = document.getElementById('cptot'); if (t) S.cp.total = Number(t.value) || null;
    }

    function keepBpVal() { const v = document.getElementById('bpval'); if (v) S.bpVal = v.value; }

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
        const r = reaction(rec);
        if (S.lancReturn === 'wdetail') { X.go('wdetail'); X.toast(r.fala); return; }
        S.mood = r.mood; S.fala = r.fala; X.go('home');
        if (r.fx === 'celebrate') X.celebrate();
        if (r.fx === 'surprise') setTimeout(() => X.pops(['!?']), 150);
        if (r.fx === 'angry') setTimeout(() => { X.act('angry', 1700); X.pops(['GRRR!'], 'pop bark'); }, 150);
      },
      async fdel() {
        const ok = await X.modal({ title: 'Apagar lançamento?', html: '<p>Ele some do extrato e dos totais. Não dá pra desfazer.</p>',
          buttons: [X.CANCEL, { label: 'Apagar', value: true, kind: 'danger' }] });
        if (!ok) return;
        const bp = S.recs.find((r) => r.type === 'billpay' && r.txId === S.f.id);
        if (bp) await put({ ...bp, paidAt: null, txId: null });
        await del(S.f.id);
        S.f = null;
        goBackTo(S.lancReturn);
        X.toast(X.catFala(X.tone(S.cur), 'apagado'));
      },
      xfilter(d) { S.xfilter = d.v; if (d.v === 'in') S.xpay = ''; X.render(); },
      xpay(d) { S.xpay = S.xpay === d.v ? '' : d.v; if (S.xpay) S.xfilter = 'out'; X.render(); },
      openWallet(d) { S.wd = d.id; S.fk = null; S.wdReturn = 'carteira'; X.go('wdetail'); },
      goContas() { X.go('contas'); },
      openBill(d) {
        const b = S.recs.find((r) => r.id === d.id); if (!b) return;
        const pr = S.cur.prefs;
        S.bpReturn = S.view;
        S.bp = { bill: b.id, key: d.k || M.mkey(S.month), pay: pr.lastPay || null, wallet: pr.lastPay && pr.lastPay !== 'dinheiro' ? pr.lastWallet || null : null };
        const w = S.recs.find((r) => r.id === S.bp.wallet);
        if (w && ((S.bp.pay === 'credito') !== (w.kind === 'cartao'))) S.bp.wallet = null;
        S.bpVal = null;
        X.go('billpay');
      },
      bpBack() { const r = S.bpReturn; S.bp = null; X.go(['home', 'contas'].includes(r) ? r : 'contas'); },
      bppay(d) {
        S.bp.pay = d.v; S.bp.wallet = null;
        if (d.v === 'credito') { const cs = wallets('cartao'); if (cs.length === 1) S.bp.wallet = cs[0].id; }
        keepBpVal(); X.render();
      },
      bpwallet(d) { S.bp.wallet = S.bp.wallet === d.v ? null : d.v; keepBpVal(); X.render(); },
      async bpvalue() {
        const v = M.parseBRL((document.getElementById('bpval') || {}).value);
        if (!v) return X.toast('Coloque o valor da conta.');
        const b = S.recs.find((r) => r.id === S.bp.bill);
        const cur = billPay(b, S.bp.key);
        await put({ ...(cur || { id: `bp-${b.id}-${S.bp.key}`, type: 'billpay', bill: b.id, key: S.bp.key, paidAt: null, txId: null }), cents: v });
        S.bpVal = null; X.render(); X.toast('Valor guardado. Quando pagar, toque em "Paguei".');
      },
      async bpay() {
        const b = S.recs.find((r) => r.id === S.bp.bill); if (!b) return;
        const v = M.parseBRL((document.getElementById('bpval') || {}).value);
        if (!v) return X.toast('Coloque o valor da conta.');
        if (!S.bp.pay) return;
        const tx = { id: Sec.uid(), type: 'tx', dir: 'out', cents: v, cat: b.cat || 'casa', pay: S.bp.pay, wallet: S.bp.wallet || null, ess: b.ess !== false,
          parcelas: 1, desc: b.name, date: today(), billId: b.id, billKey: S.bp.key, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await put(tx);
        const cur = billPay(b, S.bp.key);
        await put({ ...(cur || { id: `bp-${b.id}-${S.bp.key}`, type: 'billpay', bill: b.id, key: S.bp.key }), cents: v, paidAt: new Date().toISOString(), txId: tx.id });
        S.cur.prefs.lastPay = tx.pay; S.cur.prefs.lastWallet = tx.wallet; await X.save(S.cur);
        S.bpVal = null;
        const t = X.tone(S.cur);
        const left = dueList(M.mkey(new Date())).filter((d) => !d.paid);
        const ret = S.bpReturn; S.bp = null;
        if (ret === 'home') {
          S.mood = 'feliz';
          S.fala = fill(X.catFala(t, left.length ? 'contaPaga' : 'tudoPago'), { conta: b.name });
          X.go('home');
        } else { X.go('contas'); X.toast(fill(X.catFala(t, left.length ? 'contaPaga' : 'tudoPago'), { conta: b.name })); }
        X.celebrate();
      },
      async bunpay() {
        const b = S.recs.find((r) => r.id === S.bp.bill); const cur = b && billPay(b, S.bp.key);
        if (!cur) return;
        const ok = await X.modal({ title: 'Desmarcar pagamento?', html: '<p>O gasto que foi lançado junto também sai do extrato.</p>', buttons: [X.CANCEL, { label: 'Desmarcar', value: true, kind: 'danger' }] });
        if (!ok) return;
        if (cur.txId) await del(cur.txId);
        await put({ ...cur, paidAt: null, txId: null });
        X.render();
      },
      newBill() {
        S.b = { id: null, name: '', emo: '🧾', kind: 'fixa', cents: 0, dueDay: 10, cat: 'casa', ess: true };
        S.b0 = snapB(S.b); S.bReturn = S.view; X.go('billform');
      },
      editBill(d) {
        const b = S.recs.find((r) => r.id === d.id); if (!b) return;
        S.b = { ...b }; S.b0 = snapB(S.b); S.bReturn = S.view; X.go('billform');
      },
      bsug(d) {
        readB();
        const sg = BILL_SUG.find((x) => x[0] === d.v); if (!sg) return;
        S.b.name = sg[0]; S.b.emo = sg[1]; S.b.kind = sg[2];
        X.render();
      },
      bkind(d) { readB(); S.b.kind = d.v; X.render(); },
      bess(d) { readB(); S.b.ess = d.v === '1'; X.render(); },
      async bBack() {
        readB();
        if (!(await leave(snapB(S.b) !== S.b0, 'nesta conta'))) return;
        const r = S.bReturn; S.b = null; X.go(r === 'billpay' && S.bp ? 'billpay' : 'contas');
      },
      async bsave() {
        readB();
        const b = S.b;
        if (!b.name.trim()) return X.toast('Dê um nome, tipo "Aluguel".');
        if (!b.cents) return X.toast(b.kind === 'fixa' ? 'Coloque o valor.' : 'Coloque uma estimativa do valor.');
        let startKey = b.startKey;
        if (!b.id) {
          // Conta nova cujo vencimento deste mês já passou: pergunta se já foi paga (pra não aparecer "atrasada" à toa)
          const nowKey = M.mkey(new Date());
          startKey = nowKey;
          if (M.dayIn(nowKey, b.dueDay) < M.parse(today())) {
            const paidAlready = await X.modal({ title: `A de ${M.monthName(nowKey)} já foi paga?`,
              html: `<p>Ela venceu dia ${b.dueDay}. Se já pagou, ela começa a aparecer a partir de ${M.monthName(M.addMonths(nowKey, 1))}.</p>`,
              buttons: [{ label: 'Ainda não', value: false }, { label: 'Já paguei', value: true, kind: 'primary' }] });
            if (paidAlready) startKey = M.addMonths(nowKey, 1);
          }
        }
        const rec = { id: b.id || 'b-' + Sec.uid(), type: 'bill', name: b.name.trim().slice(0, 30), emo: b.emo || '🧾', kind: b.kind, cents: b.cents,
          dueDay: b.dueDay, cat: b.cat || 'casa', ess: !!b.ess, startKey, archived: false, createdAt: b.createdAt || new Date().toISOString() };
        await put(rec);
        const r = S.bReturn; S.b = null;
        X.go(r === 'billpay' && S.bp ? 'billpay' : 'contas');
        X.toast('Conta fixa salva. Ela aparece todo mês.');
      },
      async bdel() {
        const n = S.recs.filter((r) => r.type === 'billpay' && r.bill === S.b.id && r.paidAt).length;
        const ok = await X.modal({ title: `Apagar "${esc(S.b.name)}"?`,
          html: `<p>Ela para de aparecer nos próximos meses.${n ? ' Os pagamentos antigos continuam no extrato.' : ''}</p>`,
          buttons: [X.CANCEL, { label: 'Apagar', value: true, kind: 'danger' }] });
        if (!ok) return;
        const cur = S.recs.find((r) => r.id === S.b.id);
        if (n && cur) await put({ ...cur, archived: true }); else await del(S.b.id);
        S.b = null; S.bp = null; X.go('contas');
      },
      async ics() {
        const file = new File([buildIcs()], `contas-${S.cur.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}.ics`, { type: 'text/calendar' });
        let shared = false;
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Contas da casa' }); shared = true; } catch (e) { if (e.name === 'AbortError') return; }
        }
        if (!shared) {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
        await X.modal({ title: 'Agora, no Google Agenda', html: `<ol class="steps">
            <li>Abra <b>calendar.google.com</b> no navegador (no celular, ative "Site para computador" só nessa hora).</li>
            <li>Engrenagem ⚙ → <b>Configurações</b> → <b>Importar e exportar</b>.</li>
            <li>Escolha o arquivo <b>${esc(file.name)}</b> (fica em Downloads) e toque em <b>Importar</b>.</li></ol>
            <p class="tiny">Cada conta vira 2 lembretes por mês, às 9h: 3 dias antes e no dia. Se mudar alguma conta, mande de novo.</p>`,
          buttons: [{ label: 'Entendi', value: true, kind: 'primary' }] });
      },
      openFatura(d) { S.wd = d.id; S.fk = d.k; S.wdReturn = S.view; X.go('wdetail'); },
      payGo(d) { S.xpay = d.v; S.xfilter = 'out'; X.go('extrato'); },
      fk(d) { S.fk = M.addMonths(S.fk, Number(d.d)); X.render(); },
      async fpaid() {
        const w = S.recs.find((r) => r.id === S.wd); if (!w) return;
        const key = S.fk, p = paidRec(w, key);
        if (p) { await del(p.id); X.render(); X.toast('Pagamento desmarcado.'); return; }
        const total = M.sum(faturaItems(w, key));
        await put({ id: `fp-${w.id}-${key}`, type: 'fatpaid', wallet: w.id, key, cents: total, paidAt: new Date().toISOString() });
        X.render(); X.celebrate();
        X.toast(fill(X.catFala(X.tone(S.cur), 'contaPaga'), { conta: `Fatura do ${w.name}` }));
      },
      newPrev(d) {
        const w = S.recs.find((r) => r.id === d.id); if (!w) return;
        S.cp = { id: null, kind: 'cardopen', wallet: w.id, cents: 0, desc: '', next: null, total: null, ess: null, key: openKey(w) };
        S.cp0 = null; X.go('cardprev');
      },
      editPrev(d) {
        const r = S.recs.find((x) => x.id === d.id); if (!r) return;
        S.cp = { id: r.id, kind: r.type, wallet: r.wallet, cents: r.type === 'cardinst' ? r.parcela : r.cents, desc: r.desc || '',
          next: r.next, total: r.total, ess: r.ess ?? null, key: r.type === 'cardinst' ? r.firstKey : r.key, createdAt: r.createdAt };
        readCP(); S.cp0 = JSON.stringify(S.cp); X.go('cardprev');
      },
      cpkind(d) { readCP(); S.cp.kind = d.v; X.render(); },
      cpkey(d) { readCP(); S.cp.key = d.v; X.render(); },
      cpess(d) { readCP(); S.cp.ess = d.v === '' ? null : d.v === '1'; X.render(); },
      async cpBack() {
        readCP();
        const dirty = S.cp0 ? JSON.stringify(S.cp) !== S.cp0 : !!(S.cp.cents || S.cp.desc);
        if (!(await leave(dirty, 'aqui'))) return;
        S.cp = null; X.go('wdetail');
      },
      async cpsave() {
        readCP();
        const c = S.cp;
        if (!c.cents) return X.toast('Coloque o valor.');
        let rec;
        if (c.kind === 'cardopen') {
          rec = { id: c.id || Sec.uid(), type: 'cardopen', wallet: c.wallet, key: c.key, cents: c.cents, desc: 'Valor que já estava na fatura', ess: c.ess };
        } else {
          if (!c.desc.trim()) return X.toast('Diga o que é, tipo "Geladeira".');
          if (!c.next || !c.total || c.next > c.total) return X.toast('Confira as parcelas: ex. parcela 4 de 10.');
          rec = { id: c.id || Sec.uid(), type: 'cardinst', wallet: c.wallet, desc: c.desc.trim().slice(0, 40), parcela: c.cents,
            next: c.next, total: c.total, remaining: c.total - c.next + 1, firstKey: c.key, ess: c.ess };
        }
        rec.createdAt = c.createdAt || new Date().toISOString();
        await put(rec);
        S.cp = null; S.fk = rec.key || rec.firstKey; X.go('wdetail');
        X.toast(rec.type === 'cardinst' ? `Parcelamento salvo: ${rec.remaining} parcela(s) pela frente.` : 'Valor salvo na fatura.');
      },
      async cpdel() {
        const ok = await X.modal({ title: 'Apagar?', html: '<p>Ele sai das faturas.</p>', buttons: [X.CANCEL, { label: 'Apagar', value: true, kind: 'danger' }] });
        if (!ok) return;
        await del(S.cp.id); S.cp = null; X.go('wdetail');
      },
      wdBack() { X.go(['home', 'contas'].includes(S.wdReturn) ? S.wdReturn : 'carteira'); },

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
        for (const r of S.recs.filter((x) => ['cardopen', 'cardinst', 'fatpaid'].includes(x.type) && x.wallet === S.w.id)) await del(r.id);
        await del(S.w.id);
        S.w = null; S.wd = null;
        X.go('carteira');
      }
    };

    // Botão "voltar" do Android nas telas deste módulo. true = tratado aqui.
    function back() {
      const map = { lancar: 'lancBack', wallet: 'wBack', catform: 'cBack', wdetail: 'wdBack', cardprev: 'cpBack', billform: 'bBack', billpay: 'bpBack' };
      if (S.view === 'contas') { X.go('home'); return true; }
      if (map[S.view]) { Promise.resolve(actions[map[S.view]]()).catch(() => {}); return true; }
      return false;
    }

    return {
      reload, home, moodOnEnter, back, settingsCats, state,
      views: { lancar: vLancar, extrato: vExtrato, carteira: vCarteira, wallet: vWallet, wdetail: vWDetail, catform: vCatForm, cardprev: vPrev,
        contas: vContas, billform: vBillForm, billpay: vBillPay },
      actions,
      onInput(e) { if (e.target.id === 'fdesc' && S.f) S.f.desc = e.target.value; },
      onChange(e) { if (e.target.id === 'fdate' && S.f && e.target.value) { readF(); S.f.date = e.target.value; X.render(); } }
    };
  };
})();
