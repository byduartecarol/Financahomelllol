/* Regras de dinheiro: categorias, formas de pagamento, datas e formatação.
   Valores SEMPRE em centavos (número inteiro) pra não ter erro de arredondamento. */
(function () {
  // ess = essencial por padrão (o usuário pode trocar em cada lançamento)
  const CATS_OUT = [
    { id: 'mercado', nome: 'Mercado', emo: '🛒', ess: true },
    { id: 'casa', nome: 'Casa', emo: '🏠', ess: true },
    { id: 'farmacia', nome: 'Farmácia', emo: '💊', ess: true },
    { id: 'saude', nome: 'Saúde', emo: '🩺', ess: true },
    { id: 'transporte', nome: 'Transporte', emo: '🚌', ess: true },
    { id: 'educacao', nome: 'Educação', emo: '📚', ess: true },
    { id: 'pets', nome: 'Pets', emo: '🐾', ess: true },
    { id: 'lanche', nome: 'Lanche e delivery', emo: '🍔', ess: false },
    { id: 'lazer', nome: 'Lazer', emo: '🎉', ess: false },
    { id: 'roupas', nome: 'Roupas', emo: '👕', ess: false },
    { id: 'beleza', nome: 'Beleza', emo: '💅', ess: false },
    { id: 'assinaturas', nome: 'Assinaturas', emo: '📺', ess: false },
    { id: 'presentes', nome: 'Presentes', emo: '🎁', ess: false },
    { id: 'outros', nome: 'Outros', emo: '📦', ess: false }
  ];
  const CATS_IN = [
    { id: 'salario', nome: 'Salário', emo: '💼' },
    { id: 'extra', nome: 'Extra / bico', emo: '💵' },
    { id: 'presente-in', nome: 'Presente', emo: '🎁' },
    { id: 'reembolso', nome: 'Reembolso', emo: '↩️' },
    { id: 'outros-in', nome: 'Outros', emo: '📥' }
  ];
  const PAYS = [
    { id: 'pix', nome: 'Pix', emo: '⚡' },
    { id: 'debito', nome: 'Débito', emo: '💳' },
    { id: 'credito', nome: 'Crédito', emo: '🧾' },
    { id: 'dinheiro', nome: 'Dinheiro', emo: '💵' }
  ];
  const BANCOS = ['Nubank', 'Itaú', 'Bradesco', 'Caixa', 'Banco do Brasil', 'Santander', 'Inter', 'C6', 'Mercado Pago', 'PicPay'];
  const pad = (n) => String(n).padStart(2, '0');
  // Emojis sugeridos pra categorias criadas pela pessoa
  const EMOJIS = ['🛍️', '🍞', '🥩', '☕', '🍺', '🍕', '🚗', '⛽', '🅿️', '🛵', '✈️', '📱', '💻', '🎮', '🎬', '🎵', '📖', '🎓', '🏋️', '💈',
    '🧴', '🧹', '🔧', '💡', '💧', '🔥', '🌱', '👶', '🧸', '🐶', '🐱', '🏥', '🦷', '👓', '🙏', '⛪', '💍', '🎂', '🏖️', '💰', '🧾', '📦'];
  let custom = []; // categorias da pessoa (records type:'cat'), atualizadas pelo app

  const Money = window.Money = {
    CATS_OUT, CATS_IN, PAYS, BANCOS, EMOJIS,
    setCustom(list) { custom = (list || []).map((c) => ({ id: c.id, nome: c.name, emo: c.emo || '🏷️', ess: !!c.ess, dir: c.dir || 'out', archived: !!c.archived, custom: true })); },
    customList() { return custom.filter((c) => !c.archived); },
    cats(dir) {
      const mine = custom.filter((c) => !c.archived && c.dir === dir);
      const base = dir === 'in' ? CATS_IN : CATS_OUT;
      // "Outros" sempre por último
      return base.filter((c) => !/^outros/.test(c.id)).concat(mine, base.filter((c) => /^outros/.test(c.id)));
    },
    cat(id) { return CATS_OUT.concat(CATS_IN, custom).find((c) => c.id === id) || { id, nome: 'Outros', emo: '📦', ess: false }; },
    pay(id) { return PAYS.find((p) => p.id === id) || { id, nome: '', emo: '' }; },
    // Datas locais (sem fuso UTC, pra não "pular" o dia à noite)
    ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    mkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); },
    parse(s) { const [y, m, dd] = String(s).split('-').map(Number); return new Date(y, m - 1, dd || 1); },
    sum(list) { return list.reduce((a, r) => a + (r.cents || 0), 0); },
    brl(c) { return ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
    dayLabel(s) {
      const t = new Date();
      const d = Money.parse(s);
      const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - d) / 86400000);
      if (diff === 0) return 'Hoje';
      if (diff === 1) return 'Ontem';
      const l = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
      return l.charAt(0).toUpperCase() + l.slice(1);
    },
    addMonths(key, n) { const d = Money.parse(key + '-01'); return Money.mkey(new Date(d.getFullYear(), d.getMonth() + n, 1)); },
    monthName(key) { return Money.parse(key + '-01').toLocaleDateString('pt-BR', { month: 'long' }); },
    shortDate(d) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); },
    // Dia limitado ao tamanho do mês (ex.: dia 31 em fevereiro vira 28/29)
    dayIn(key, day) { const d = Money.parse(key + '-01'); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return new Date(d.getFullYear(), d.getMonth(), Math.min(day, dim)); },
    /* ---- Fatura do cartão ----
       A fatura é identificada pelo MÊS EM QUE VENCE ("AAAA-MM").
       Compra no dia do fechamento ou depois -> fatura seguinte. */
    faturaOf(dateStr, closeDay, dueDay) {
      const d = Money.parse(dateStr);
      let m = d.getMonth();
      if (d.getDate() >= closeDay) m += 1;   // já fechou: vai pra próxima
      if (dueDay <= closeDay) m += 1;        // vence no mês seguinte ao fechamento
      return Money.mkey(new Date(d.getFullYear(), m, 1));
    },
    faturaDates(key, closeDay, dueDay) {
      const due = Money.dayIn(key, dueDay);
      const closeKey = dueDay <= closeDay ? Money.addMonths(key, -1) : key;
      return { close: Money.dayIn(closeKey, closeDay), due };
    },
    // Divide em parcelas; a diferença de centavos vai na 1ª
    split(cents, n) { const base = Math.floor(cents / n); return Array.from({ length: n }, (_, i) => base + (i === 0 ? cents - base * n : 0)); },
    // "1.234,56" / "1234.56" / "50" -> centavos
    parseBRL(str) {
      let t = String(str || '').replace(/[^\d.,]/g, '');
      if (!t) return 0;
      if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
      else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
      return Math.round(parseFloat(t) * 100) || 0;
    },
    // Gasto "alto de uma vez": R$ 300+ ou 25%+ do que entrou no mês
    isBig(cents, incomeMonth) { return cents >= 30000 || (incomeMonth > 0 && cents >= incomeMonth * 0.25); }
  };
})();
