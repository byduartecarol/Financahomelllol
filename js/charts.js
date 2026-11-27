/* Gráficos em SVG puro (sem biblioteca, funciona offline).
   Cores por papel via CSS (--s1..--s8 categóricas, --ok/--bad status). Todo gráfico tem
   rótulos/legenda escritos (nunca só cor) e dica ao tocar/passar o dedo (data-tip). */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = (n) => Math.round(n * 10) / 10;
  const brlShort = (c) => {
    const v = (c || 0) / 100;
    if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  };
  // escala "bonita" pro eixo
  function niceMax(v) {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  /* Rosca: fatias com 2px de folga (traço da cor do cartão) */
  function donut(items, { big = '', small = '' } = {}) {
    const total = items.reduce((a, i) => a + i.value, 0);
    if (!total) return '';
    const R = 80, r = 52, cx = 100, cy = 100;
    let a0 = -Math.PI / 2;
    const arcs = items.map((it) => {
      const frac = it.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, ang) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      let d;
      if (frac >= 0.9999) {
        d = `M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L${cx - 0.01} ${cy - r} A${r} ${r} 0 1 0 ${cx} ${cy - r}Z`;
      } else {
        const [x1, y1] = p(R, a0), [x2, y2] = p(R, a1), [x3, y3] = p(r, a1), [x4, y4] = p(r, a0);
        d = `M${f(x1)} ${f(y1)} A${R} ${R} 0 ${large} 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${r} ${r} 0 ${large} 0 ${f(x4)} ${f(y4)}Z`;
      }
      a0 = a1;
      return `<path d="${d}" fill="${it.color}" stroke="var(--card)" stroke-width="2" data-tip="${esc(it.label)}: ${esc(it.tip || '')}" class="vz-hit"/>`;
    }).join('');
    return `<svg viewBox="0 0 200 200" class="vz vz-donut" role="img" aria-label="Gastos por categoria">${arcs}
      <text x="100" y="98" text-anchor="middle" class="vz-big">${esc(big)}</text>
      <text x="100" y="118" text-anchor="middle" class="vz-small">${esc(small)}</text></svg>`;
  }

  /* Barras agrupadas (2 séries), topo arredondado 4px, base no zero */
  function bars(groups, series, { money = true } = {}) {
    const W = 340, H = 190, L = 44, B = 26, T = 10, Rr = 6;
    const max = niceMax(Math.max(1, ...groups.flatMap((g) => series.map((s) => g[s.key] || 0))));
    const cw = (W - L - Rr) / groups.length;
    const bw = Math.min(16, (cw - 10) / series.length);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '';
    [0, 0.5, 1].forEach((k) => {
      const v = max * k, yy = y(v);
      s += `<line x1="${L}" x2="${W - Rr}" y1="${f(yy)}" y2="${f(yy)}" class="vz-grid"/><text x="${L - 6}" y="${f(yy + 4)}" text-anchor="end" class="vz-axis">${money ? brlShort(v) : v}</text>`;
    });
    groups.forEach((g, i) => {
      const gx = L + cw * i + (cw - bw * series.length - 2 * (series.length - 1)) / 2;
      series.forEach((sr, j) => {
        const v = g[sr.key] || 0;
        const x = gx + j * (bw + 2), yy = y(v), h = Math.max(0, H - B - yy);
        const rr = Math.min(4, h);
        const d = h > 0 ? `M${f(x)} ${f(H - B)} L${f(x)} ${f(yy + rr)} Q${f(x)} ${f(yy)} ${f(x + rr)} ${f(yy)} L${f(x + bw - rr)} ${f(yy)} Q${f(x + bw)} ${f(yy)} ${f(x + bw)} ${f(yy + rr)} L${f(x + bw)} ${f(H - B)}Z` : '';
        if (d) s += `<path d="${d}" fill="${sr.color}"/>`;
      });
      // área de toque maior que as barras
      const tip = `${g.label}: ` + series.map((sr) => `${sr.name} ${money ? brlFull(g[sr.key]) : g[sr.key]}`).join(' · ');
      s += `<rect x="${f(L + cw * i)}" y="${T}" width="${f(cw)}" height="${H - T - B}" fill="transparent" class="vz-hit" data-tip="${esc(tip)}"/>`;
      s += `<text x="${f(L + cw * i + cw / 2)}" y="${H - 8}" text-anchor="middle" class="vz-axis ${g.current ? 'vz-cur' : ''}">${esc(g.label)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - Rr}" y1="${H - B}" y2="${H - B}" class="vz-base"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="vz" role="img" aria-label="${esc(series.map((x) => x.name).join(' e '))} por mês">${s}</svg>`;
  }

  /* Barras empilhadas por status (em dia / atrasado / pendente) */
  function stack(groups, parts) {
    const W = 340, H = 170, L = 44, B = 26, T = 10, Rr = 6;
    const max = niceMax(Math.max(1, ...groups.map((g) => parts.reduce((a, p) => a + (g[p.key] || 0), 0))));
    const cw = (W - L - Rr) / groups.length, bw = Math.min(26, cw - 14);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '';
    [0, 0.5, 1].forEach((k) => { const yy = y(max * k); s += `<line x1="${L}" x2="${W - Rr}" y1="${f(yy)}" y2="${f(yy)}" class="vz-grid"/><text x="${L - 6}" y="${f(yy + 4)}" text-anchor="end" class="vz-axis">${brlShort(max * k)}</text>`; });
    groups.forEach((g, i) => {
      const x = L + cw * i + (cw - bw) / 2;
      let acc = 0;
      parts.forEach((p) => {
        const v = g[p.key] || 0; if (!v) return;
        const y1 = y(acc + v), y0 = y(acc);
        s += `<rect x="${f(x)}" y="${f(y1)}" width="${f(bw)}" height="${f(Math.max(0, y0 - y1 - 2))}" rx="3" fill="${p.color}"/>`;
        acc += v;
      });
      const tip = `${g.label}: ` + parts.map((p) => `${p.name} ${brlFull(g[p.key])}`).join(' · ');
      s += `<rect x="${f(L + cw * i)}" y="${T}" width="${f(cw)}" height="${H - T - B}" fill="transparent" class="vz-hit" data-tip="${esc(tip)}"/>`;
      s += `<text x="${f(L + cw * i + cw / 2)}" y="${H - 8}" text-anchor="middle" class="vz-axis ${g.current ? 'vz-cur' : ''}">${esc(g.label)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - Rr}" y1="${H - B}" y2="${H - B}" class="vz-base"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="vz" role="img" aria-label="Contas pagas em dia e atrasadas por mês">${s}</svg>`;
  }

  /* Linha (1 série) com marcadores >= 8px e média tracejada */
  function line(points, { avg = null } = {}) {
    const W = 340, H = 170, L = 44, B = 26, T = 14, Rr = 14;
    const vals = points.map((p) => p.value).filter((v) => v != null);
    const max = niceMax(Math.max(1, ...vals, avg || 0));
    const x = (i) => L + (points.length === 1 ? (W - L - Rr) / 2 : (W - L - Rr) * i / (points.length - 1));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '';
    [0, 0.5, 1].forEach((k) => { const yy = y(max * k); s += `<line x1="${L}" x2="${W - Rr}" y1="${f(yy)}" y2="${f(yy)}" class="vz-grid"/><text x="${L - 6}" y="${f(yy + 4)}" text-anchor="end" class="vz-axis">${brlShort(max * k)}</text>`; });
    if (avg) s += `<line x1="${L}" x2="${W - Rr}" y1="${f(y(avg))}" y2="${f(y(avg))}" class="vz-avg"/><text x="${W - Rr}" y="${f(y(avg) - 5)}" text-anchor="end" class="vz-axis">média ${brlShort(avg)}</text>`;
    let d = '', started = false;
    points.forEach((p, i) => { if (p.value == null) { started = false; return; } d += `${started ? 'L' : 'M'}${f(x(i))} ${f(y(p.value))} `; started = true; });
    s += `<path d="${d}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    points.forEach((p, i) => {
      if (p.value != null) s += `<circle cx="${f(x(i))}" cy="${f(y(p.value))}" r="4.5" fill="var(--s1)" stroke="var(--card)" stroke-width="2"/>`;
      s += `<rect x="${f(x(i) - 18)}" y="${T}" width="36" height="${H - T - B}" fill="transparent" class="vz-hit" data-tip="${esc(p.label)}: ${p.value == null ? 'sem valor' : brlFull(p.value)}"/>`;
      s += `<text x="${f(x(i))}" y="${H - 8}" text-anchor="middle" class="vz-axis">${esc(p.label)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - Rr}" y1="${H - B}" y2="${H - B}" class="vz-base"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="vz" role="img" aria-label="Valor por mês">${s}</svg>`;
  }
  function brlFull(c) { return ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

  // Dica flutuante ao tocar/passar o dedo em qualquer [data-tip]
  let tipEl = null;
  function showTip(e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'vz-tip'; document.body.append(tipEl); }
    tipEl.textContent = t.getAttribute('data-tip');
    tipEl.hidden = false;
    const r = t.getBoundingClientRect();
    const w = Math.min(260, window.innerWidth - 16);
    tipEl.style.maxWidth = w + 'px';
    tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.style.top = Math.max(8, r.top - 8 + window.scrollY - 44) + 'px';
  }
  document.addEventListener('pointerover', showTip);
  document.addEventListener('click', showTip);
  window.addEventListener('scroll', () => { if (tipEl) tipEl.hidden = true; }, { passive: true });

  window.Charts = { donut, bars, stack, line, COLORS, brlShort };
})();
