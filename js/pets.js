/* Mascotes fofinhos — desenho original em SVG (sem imagens externas).
   7 personagens: 4 gatos + 3 cachorros. Dois modos:
   - Pet.face(...)  -> só a carinha (avatar, ícone, tela de perfis)
   - Pet.full(...)  -> corpo inteiro sentado, com caminha (tela principal)
   Partes com classe (para animar via CSS): .torso .head .ear-l .ear-r .eyes
   .tail .paw-l .paw-r .tongue */
(function () {
  const INK = '#33221d';

  const PETS = {
    'gato-laranja': { sp: 'gato', nome: 'Gato laranja', base: '#f3a35a', light: '#fff0dc', dark: '#d9783a', iris: '#c27a22', chest: '#fff6ea', paw: '#fff6ea', stripes: true, bed: '#e8a1ab' },
    'gato-preto':   { sp: 'gato', nome: 'Gato preto', base: '#35313c', light: '#57525f', dark: '#24212a', iris: '#cdd23c', chest: '#4a4652', paw: '#46424e', face: '#d9cfe6', bed: '#b4a2de' },
    'gato-branco':  { sp: 'gato', nome: 'Gato branco', base: '#fbf7f1', light: '#ffffff', dark: '#e4d9cb', iris: '#6aa6dc', chest: '#ffffff', paw: '#ffffff', bed: '#97cdbd' },
    'gato-cinza':   { sp: 'gato', nome: 'Gato cinza', base: '#9ba3b0', light: '#eef0f4', dark: '#767e8b', iris: '#d39a2b', chest: '#f3f4f7', paw: '#f3f4f7', stripes: true, bed: '#f0b27c' },
    'lhasa':        { sp: 'cao', raca: 'lhasa', nome: 'Lhasa Apso', base: '#403d45', light: '#a39384', dark: '#2a282e', iris: '#9a6634', chest: '#7d736c', paw: '#4a4650', face: '#e9e1d8', bed: '#82b2d8' },
    'yorkshire':    { sp: 'cao', raca: 'york', nome: 'Yorkshire', base: '#57637b', light: '#d89a5c', dark: '#3d465a', iris: '#3a2416', chest: '#d89a5c', paw: '#d89a5c', bed: '#eba3b8' },
    'lulu':         { sp: 'cao', raca: 'lulu', nome: 'Lulu caramelo', base: '#e6984a', light: '#fbe3c2', dark: '#c4752c', iris: '#3a2416', chest: '#fdf0dc', paw: '#fbe3c2', bed: '#a3c9a9' }
  };

  const f = (n) => Math.round(n * 10) / 10;

  // Contorno "fofinho": elipse com tufos de pelo (curvas para fora).
  function fluff(cx, cy, rx, ry, n, amp, seed = 1, start = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + (i * 2 * Math.PI) / n;
      const j = 1 + 0.035 * Math.sin(seed * 7.3 + i * 2.1);
      pts.push([cx + rx * j * Math.cos(a), cy + ry * j * Math.sin(a), a]);
    }
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const q = pts[(i + 1) % n];
      const am = pts[i][2] + Math.PI / n;
      const k = 1 + amp * (0.75 + 0.5 * Math.abs(Math.sin(seed + i * 1.7)));
      d += ` Q${f(cx + rx * k * Math.cos(am))} ${f(cy + ry * k * Math.sin(am))} ${f(q[0])} ${f(q[1])}`;
    }
    return d + 'Z';
  }
  const P = (d, fill, sw = 3, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
  const S = (d, color, w, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  // Traço grosso com contorno (para rabos)
  const T = (d, color, w) => S(d, INK, w + 6) + S(d, color, w);

  /* ---------- olhos ---------- */
  function eye(x, y, c, r = 11) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.iris}"/>
      <circle cx="${x}" cy="${y - 1.2}" r="${r * 0.78}" fill="#1a1012"/>
      <circle cx="${x + r * 0.32}" cy="${y - r * 0.42}" r="${r * 0.32}" fill="#fff"/>
      <circle cx="${x - r * 0.3}" cy="${y + r * 0.3}" r="${r * 0.14}" fill="#fff" opacity=".9"/>`;
  }
  function eyes(mood, c) {
    const L = -21, R = 21, Y = 3;
    const line = c.face || INK;
    const arc = (up) => S(`M${L - 9} ${Y + (up ? 2 : -2)} Q${L} ${Y + (up ? -8 : 7)} ${L + 9} ${Y + (up ? 2 : -2)} M${R - 9} ${Y + (up ? 2 : -2)} Q${R} ${Y + (up ? -8 : 7)} ${R + 9} ${Y + (up ? 2 : -2)}`, line, 4);
    switch (mood) {
      case 'bravo': {
        // olho semicerrado com pálpebra inclinada pro centro + 💢 na testa
        const lid = (x, s) => `<path d="M${x - 13} ${Y - 14} L${x + 13} ${Y - 14} L${x + 13} ${Y + (s < 0 ? -1 : -7)} L${x - 13} ${Y + (s < 0 ? -7 : -1)} Z" fill="${c.lid || c.base}"/>` +
          S(`M${x - 13} ${Y + (s < 0 ? -7 : -1)} L${x + 13} ${Y + (s < 0 ? -1 : -7)}`, line, 3.5);
        const vein = `<g transform="translate(36 -30)">${S('M-6 -2 Q-2 -2 -2 -6 M2 -6 Q2 -2 6 -2 M6 2 Q2 2 2 6 M-2 6 Q-2 2 -6 2', '#e8413f', 3)}</g>`;
        return eye(L, Y, c, 10) + eye(R, Y, c, 10) + lid(L, -1) + lid(R, 1) + vein;
      }
      case 'feliz': return arc(true);
      case 'dormindo': return arc(false);
      case 'surpreso': return eye(L, Y, c, 13) + eye(R, Y, c, 13);
      case 'preocupado':
        return eye(L, Y + 1, c) + eye(R, Y + 1, c) + S(`M${L - 10} ${Y - 15} L${L + 7} ${Y - 19} M${R + 10} ${Y - 15} L${R - 7} ${Y - 19}`, line, 3.5);
      case 'triste':
        return eye(L, Y + 2, c) + eye(R, Y + 2, c) + S(`M${L - 9} ${Y - 18} L${L + 7} ${Y - 13} M${R + 9} ${Y - 18} L${R - 7} ${Y - 13}`, line, 3.5) +
          `<path d="M${L - 7} ${Y + 12} q-4 8 0 11 q4 -3 0 -11z" fill="#8fd0f5" stroke="${INK}" stroke-width="1.5"/>`;
      default: return eye(L, Y, c) + eye(R, Y, c);
    }
  }

  function mouth(mood, c) {
    const line = c.face || INK;
    const y = 26;
    if (mood === 'bravo') {
      if (c.sp === 'cao') return P(`M-9 ${y} Q0 ${y - 4} 9 ${y} L8 ${y + 6} Q0 ${y + 3} -8 ${y + 6} Z`, '#7a2f3a', 2) + S(`M-7 ${y + 1} l2 3 l2 -3 l2 3 l2 -3 l2 3 l2 -3`, '#fff', 1.6);
      return S(`M-9 ${y + 4} Q0 ${y - 3} 9 ${y + 4}`, line, 3) + `<path d="M-5 ${y + 1} l1.5 4 l1.5 -3.5Z M5 ${y + 1} l-1.5 4 l-1.5 -3.5Z" fill="#fff" stroke="${INK}" stroke-width="1"/>`;
    }
    if (mood === 'triste') return S(`M-7 ${y + 4} Q0 ${y - 2} 7 ${y + 4}`, line, 3);
    if (mood === 'surpreso') return `<ellipse cx="0" cy="${y + 3}" rx="4.5" ry="5.5" fill="#7a2f3a" stroke="${INK}" stroke-width="2"/>`;
    if (mood === 'preocupado') return S(`M-8 ${y + 2} q4 -3 8 0 q4 3 8 0`, line, 3);
    return S(`M-9 ${y} Q-4.5 ${y + 6} 0 ${y} Q4.5 ${y + 6} 9 ${y}`, line, 3);
  }

  /* ---------- orelhas ---------- */
  function earsCat(c) {
    const ear = (s) => `<g class="${s < 0 ? 'ear-l' : 'ear-r'}">
      ${P(`M${s * 50} -14 Q${s * 52} -52 ${s * 42} -72 Q${s * 26} -56 ${s * 12} -42 Z`, c.base)}
      <path d="M${s * 43} -24 Q${s * 44} -48 ${s * 40} -60 Q${s * 30} -50 ${s * 22} -40 Z" fill="#f4a9b8"/>
      ${S(`M${s * 38} -40 l${s * 4} -6 M${s * 34} -36 l${s * 5} -4`, c.light, 2)}
    </g>`;
    return ear(-1) + ear(1);
  }
  function earsYork(c) {
    const ear = (s) => `<g class="${s < 0 ? 'ear-l' : 'ear-r'}">
      ${P(`M${s * 44} -18 Q${s * 50} -54 ${s * 40} -74 Q${s * 24} -54 ${s * 16} -40 Z`, c.light)}
      <path d="M${s * 38} -28 Q${s * 42} -50 ${s * 38} -62 Q${s * 30} -50 ${s * 24} -40 Z" fill="#f2b8a8"/>
    </g>`;
    return ear(-1) + ear(1);
  }
  function earsLulu(c) {
    const ear = (s) => `<g class="${s < 0 ? 'ear-l' : 'ear-r'}">
      ${P(`M${s * 40} -30 Q${s * 44} -60 ${s * 34} -70 Q${s * 22} -56 ${s * 14} -44 Z`, c.base)}
      <path d="M${s * 34} -38 Q${s * 37} -56 ${s * 32} -62 Q${s * 25} -54 ${s * 20} -46 Z" fill="#f4b5a0"/>
    </g>`;
    return ear(-1) + ear(1);
  }
  function earsLhasa(c) {
    // Orelhas compridas e caídas, com pelo longo
    return `<g class="ear-l">${P(fluff(-50, 14, 15, 34, 12, 0.22, 3), c.dark)}${S('M-52 0 q-3 18 2 34 M-46 4 q-2 16 2 30', '#55515a', 2)}</g>
      <g class="ear-r">${P(fluff(50, 14, 15, 34, 12, 0.22, 5), c.dark)}${S('M52 0 q3 18 -2 34 M46 4 q2 16 -2 30', '#55515a', 2)}</g>`;
  }

  /* ---------- acessórios de cabeça ---------- */
  function headAcc(acc, c) {
    switch (acc) {
      case 'oculos':
        return `<g fill="rgba(255,255,255,.18)" stroke="${INK}" stroke-width="3"><circle cx="-21" cy="3" r="15"/><circle cx="21" cy="3" r="15"/></g>${S('M-6 1 Q0 -3 6 1', INK, 3)}`;
      case 'laco':
        return `<g transform="translate(32 -44) rotate(20)">${P('M0 0 L-18 -11 L-18 11 Z M0 0 L18 -11 L18 11 Z', '#ef5d87', 2.5)}<circle r="5.5" fill="#c93d66" stroke="${INK}" stroke-width="2.5"/></g>`;
      case 'flor':
        return `<g transform="translate(-34 -40)">${[0, 72, 144, 216, 288].map((r) => `<ellipse rx="6.5" ry="10" transform="rotate(${r}) translate(0 -8)" fill="#ffd35f" stroke="${INK}" stroke-width="2"/>`).join('')}<circle r="5.5" fill="#f28a3c" stroke="${INK}" stroke-width="2"/></g>`;
      case 'chapeu':
        return `<g transform="translate(0 -40)">${P('M-40 4 Q0 -6 40 4 Q0 12 -40 4Z', '#3b3a57')}${P('M-24 2 Q-22 -30 0 -30 Q22 -30 24 2 Z', '#3b3a57')}<path d="M-23 -6 Q0 -10 23 -6 L23 0 Q0 -4 -23 0Z" fill="#ef5d87"/></g>`;
      default: return '';
    }
  }

  /* ---------- Lhasa Apso: pelo longo e LISO ---------- */
  const SHEEN = '#6e6974';
  // Pontas lisas: zigue-zague suave (fios retos), da esquerda pra direita.
  function tips(x1, x2, y, n, d) {
    let s = '';
    const step = (x2 - x1) / n;
    for (let i = 1; i <= n; i++) s += ` L${f(x1 + step * (i - 0.5))} ${f(y - d)} L${f(x1 + step * i)} ${f(y)}`;
    return s;
  }
  function lhasaHead(c, mood, acc) {
    const BEARD = '#b3a496', CHIN = '#8c7f74';
    const ear = (k) => {
      const x = (v) => f(k * v);
      return `<g class="${k < 0 ? 'ear-l' : 'ear-r'}">
        ${P(`M${x(30)} -42 C${x(54)} -44 ${x(66)} -22 ${x(64)} 4 C${x(63)} 26 ${x(62)} 42 ${x(54)} 58 C${x(50)} 50 ${x(46)} 56 ${x(42)} 50 C${x(38)} 54 ${x(36)} 48 ${x(36)} 44 C${x(42)} 18 ${x(42)} -12 ${x(30)} -42 Z`, c.base)}
        ${S(`M${x(46)} -30 C${x(56)} -12 ${x(57)} 16 ${x(54)} 46 M${x(40)} -18 C${x(48)} 2 ${x(49)} 24 ${x(46)} 46`, SHEEN, 2.2)}
      </g>`;
    };
    let s = '';
    // cabeça lisa
    s += `<ellipse cx="0" cy="0" rx="54" ry="49" fill="${c.base}" stroke="${INK}" stroke-width="3"/>`;
    // topete repartido
    s += P('M-1 -46 C-8 -58 -22 -62 -34 -54 C-24 -52 -16 -48 -12 -42 Z', c.base, 2.5) + P('M1 -46 C8 -58 22 -62 34 -54 C24 -52 16 -48 12 -42 Z', c.base, 2.5);
    s += S('M-2 -44 C-6 -36 -8 -28 -8 -20 M2 -44 C6 -36 8 -28 8 -20', SHEEN, 2);
    // orelhas compridas e lisas emoldurando o rosto
    s += ear(-1) + ear(1);
    // manchinhas escuras em volta dos olhos
    s += `<ellipse cx="-22" cy="1" rx="17" ry="15" fill="${c.dark}" transform="rotate(-12 -22 1)"/><ellipse cx="22" cy="1" rx="17" ry="15" fill="${c.dark}" transform="rotate(12 22 1)"/>`;
    // sobrancelhas expressivas de tiozinho
    if (mood !== 'bravo' && mood !== 'preocupado' && mood !== 'triste') s += S('M-38 -12 Q-26 -24 -10 -16 M38 -12 Q26 -24 10 -16', '#8f8a96', 3);
    s += `<g class="eyes">${eyes(mood, Object.assign({}, c, { face: '#e9e1d8', lid: c.dark }))}</g>`;
    // tufinho de barba pontudo
    s += P('M-13 30 C-12 40 -6 48 0 53 C6 48 12 40 13 30 Z', CHIN, 2.5) + S('M-4 37 L-1 48 M4 37 L1 48', '#6f645b', 1.6);
    // língua
    if (mood === 'feliz' || mood === 'normal') s += `<g class="tongue"><path d="M-5 30 Q-5 41 0 41 Q5 41 5 30 Z" fill="#f2788f" stroke="${INK}" stroke-width="2"/></g>`;
    else if (mood === 'surpreso') s += `<ellipse cx="0" cy="33" rx="4.5" ry="6" fill="#7a2f3a" stroke="${INK}" stroke-width="2"/>`;
    else if (mood === 'bravo') s += P('M-8 29 Q0 26 8 29 L7 35 Q0 33 -7 35 Z', '#7a2f3a', 2) + S('M-6 30 l2 3 l2 -3 l2 3 l2 -3 l2 3', '#fff', 1.4);
    // bigodão em dois "bolinhos"
    s += `<ellipse cx="-17" cy="23" rx="22" ry="15" fill="${BEARD}" stroke="${INK}" stroke-width="2.5"/><ellipse cx="17" cy="23" rx="22" ry="15" fill="${BEARD}" stroke="${INK}" stroke-width="2.5"/>`;
    s += `<path d="M-3 14 L3 14 L3 32 L-3 32Z" fill="${BEARD}"/>`;
    s += S('M-30 20 Q-22 22 -14 20 M-28 27 Q-20 28 -12 26 M30 20 Q22 22 14 20 M28 27 Q20 28 12 26', '#8f8174', 1.6);
    if (mood === 'triste' || mood === 'preocupado') s += S('M-6 33 Q0 29 6 33', '#4a3f3a', 2.5);
    // narizão
    s += `<ellipse cx="0" cy="12" rx="11" ry="7.5" fill="#1d1719" stroke="${INK}" stroke-width="2"/><ellipse cx="-3" cy="9.5" rx="3.6" ry="2" fill="#fff" opacity=".75"/>`;
    s += headAcc(acc, c);
    return `<g class="head">${s}</g>`;
  }

  function lhasaBody(c, acc) {
    let s = '';
    s += `<g class="tail">${P('M136 138 C168 132 186 106 174 82 C166 68 148 70 144 82 C154 82 162 92 156 106 C150 118 140 126 128 130Z', c.base)}
      ${S('M146 130 C166 120 176 102 170 86 M140 124 C156 116 164 104 160 92', SHEEN, 2)}</g>`;
    // patinhas de trás + quadris
    s += `<ellipse cx="48" cy="203" rx="17" ry="9" fill="${c.paw}" stroke="${INK}" stroke-width="3"/><ellipse cx="152" cy="203" rx="17" ry="9" fill="${c.paw}" stroke="${INK}" stroke-width="3"/>`;
    s += `<ellipse cx="62" cy="182" rx="24" ry="22" fill="${c.base}" stroke="${INK}" stroke-width="3"/><ellipse cx="138" cy="182" rx="24" ry="22" fill="${c.base}" stroke="${INK}" stroke-width="3"/>`;
    s += S('M50 170 C46 180 48 192 54 198 M150 170 C154 180 152 192 146 198', SHEEN, 2);
    let torso = P('M64 116 C54 138 54 168 60 200 L140 200 C146 168 146 138 136 116 Q100 102 64 116Z', c.base);
    if (acc === 'roupinha') {
      torso += P('M62 120 Q100 106 138 120 Q152 144 144 172 Q100 186 56 172 Q48 144 62 120Z', '#8fb9ea') +
        P('M66 120 Q100 108 134 120 Q134 129 124 129 Q100 136 76 129 Q66 129 66 120Z', '#a9cbf2', 2.5) +
        `<g fill="#fff" opacity=".85"><circle cx="80" cy="148" r="3.5"/><circle cx="120" cy="154" r="3.5"/><circle cx="100" cy="142" r="3"/><circle cx="92" cy="162" r="3"/><circle cx="128" cy="136" r="3"/><circle cx="70" cy="160" r="3"/></g>`;
    } else {
      torso += P('M80 120 Q100 126 120 120 C117 146 109 166 100 180 C91 166 83 146 80 120Z', c.chest, 2.5) + S('M94 130 C95 146 97 158 100 170 M106 130 C105 146 103 158 100 170', '#5d5751', 1.6);
    }
    if (acc === 'coleira') torso += P('M66 116 Q100 132 134 116 L134 124 Q100 140 66 124 Z', '#e04f5f', 2.5) + `<circle cx="100" cy="138" r="7" fill="#ffcf4d" stroke="${INK}" stroke-width="2.5"/>`;
    s += `<g class="torso">${torso}</g>`;
    // perninhas da frente (colunas) e patonas
    const leg = (x, cls) => `<g class="${cls}"><path d="M${x - 11} 162 C${x - 14} 174 ${x - 13} 186 ${x - 12} 198 L${x + 12} 198 C${x + 13} 186 ${x + 14} 174 ${x + 11} 162 Z" fill="${c.base}"/>${S(`M${x - 11} 166 C${x - 13} 178 ${x - 13} 188 ${x - 12} 198 M${x + 11} 166 C${x + 13} 178 ${x + 13} 188 ${x + 12} 198`, INK, 3)}${S(`M${x - 4} 166 L${x - 5} 192`, SHEEN, 2)}
      ${P(`M${x - 17} 204 Q${x - 18} 190 ${x} 190 Q${x + 18} 190 ${x + 17} 204 Q${x} 212 ${x - 17} 204 Z`, c.paw)}${S(`M${x - 6} 198 v7 M${x} 197 v8 M${x + 6} 198 v7`, SHEEN, 2)}</g>`;
    s += leg(84, 'paw-l') + leg(116, 'paw-r');
    return s;
  }

  /* ---------- cabeça (centro 0,0) ---------- */
  function head(c, mood, acc) {
    if (c.raca === 'lhasa') return lhasaHead(c, mood, acc);
    let behind = '', base = '', face = '', over = '';
    const seed = c.nome.length;
    if (c.sp === 'gato') behind += earsCat(c);
    if (c.raca === 'york') behind += earsYork(c);
    if (c.raca === 'lulu') { behind += P(fluff(0, 8, 66, 60, 24, 0.16, 2), c.light) + earsLulu(c); }

    base += c.raca === 'lhasa'
      ? P(fluff(0, 2, 54, 48, 26, 0.17, seed), c.base) + S('M-40 -20 q-6 14 -4 30 M40 -20 q6 14 4 30 M-30 -38 q-2 -6 2 -10 M30 -38 q2 -6 -2 -10', '#58545d', 2)
      : P(fluff(0, 0, 54, 47, 20, 0.1, seed), c.base);

    if (c.sp === 'gato') {
      base += `<path d="${fluff(0, 20, 30, 18, 12, 0.14, 4)}" fill="${c.light}"/>`;
      if (c.stripes) base += S('M0 -44 v12 M-12 -42 l3 10 M12 -42 l-3 10', c.dark, 4);
    }
    if (c.raca === 'york') base += `<path d="${fluff(0, 12, 46, 36, 18, 0.13, 6)}" fill="${c.light}"/>` + `<path d="${fluff(0, -30, 18, 12, 10, 0.2, 2)}" fill="${c.light}"/>`;
    if (c.raca === 'lulu') base += `<path d="${fluff(0, 18, 32, 22, 14, 0.14, 7)}" fill="${c.light}"/>`;
    if (c.raca === 'lhasa') base += `<path d="${fluff(0, 26, 34, 24, 16, 0.2, 9)}" fill="${c.light}"/>` + S('M-14 30 l-4 14 M-5 34 l-1 14 M5 34 l1 14 M14 30 l4 14', '#b4a597', 2);

    // bochechas
    face += `<ellipse cx="-34" cy="18" rx="8" ry="5" fill="#ff8fa6" opacity=".45"/><ellipse cx="34" cy="18" rx="8" ry="5" fill="#ff8fa6" opacity=".45"/>`;
    face += `<g class="eyes">${eyes(mood, c)}</g>`;

    if (c.raca === 'lhasa') {
      // franja repartida no meio, caindo por cima dos olhos ("cara de tiozinho")
      face += `<path d="M-2 -40 Q-30 -44 -46 -22 Q-40 -16 -36 -8 Q-30 -14 -26 -6 Q-20 -14 -14 -7 Q-9 -16 -4 -10 Q-2 -24 -2 -40Z" fill="${c.base}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
      face += `<path d="M2 -40 Q30 -44 46 -22 Q40 -16 36 -8 Q30 -14 26 -6 Q20 -14 14 -7 Q9 -16 4 -10 Q2 -24 2 -40Z" fill="${c.base}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
      face += S('M-30 -34 q-6 10 -8 20 M-18 -36 q-4 12 -6 22 M18 -36 q4 12 6 22 M30 -34 q6 10 8 20', '#5c5862', 2);
      face += S('M-1 -6 q-2 6 -1 12 M1 -6 q2 6 1 12', '#5c5862', 2);
    }

    if (c.sp === 'gato') {
      face += P('M-5 15 L5 15 L0 20.5 Z', '#ef8aa0', 2);
      face += `<g stroke="${c.face || INK}" stroke-width="1.6" stroke-linecap="round" opacity=".6"><path d="M-30 20 L-58 15 M-30 25 L-57 28 M30 20 L58 15 M30 25 L57 28"/></g>`;
    } else {
      face += `<ellipse cx="0" cy="17" rx="9" ry="6.5" fill="#1d1719" stroke="${INK}" stroke-width="2"/><ellipse cx="-2.5" cy="15" rx="3" ry="1.8" fill="#fff" opacity=".7"/>`;
    }
    face += mouth(mood, c);
    if (c.sp === 'cao' && (mood === 'feliz' || mood === 'normal')) {
      face += `<g class="tongue"><path d="M-6 30 Q-6 42 0 42 Q6 42 6 30 Z" fill="#f2788f" stroke="${INK}" stroke-width="2"/><path d="M0 31 v7" stroke="#c9536b" stroke-width="1.5"/></g>`;
    }
    if (c.raca === 'lhasa') over += earsLhasa(c);
    over += headAcc(acc, c);
    return `<g class="head">${behind}${base}${face}${over}</g>`;
  }

  /* ---------- corpo inteiro ---------- */
  function tail(c) {
    if (c.sp === 'gato') return `<g class="tail">${T('M138 196 C176 202 190 170 178 140 C170 120 178 104 190 100', c.base, 17)}${S('M180 112 l6 -3', c.light, 3)}</g>`;
    if (c.raca === 'lhasa') return `<g class="tail">${P(fluff(160, 116, 24, 34, 14, 0.25, 4), c.base)}${S('M152 96 q8 18 2 40 M164 92 q8 20 2 44', '#57535b', 2)}</g>`;
    if (c.raca === 'york') return `<g class="tail">${T('M144 152 C158 142 164 126 160 110', c.base, 11)}</g>`;
    return `<g class="tail">${P(fluff(152, 112, 32, 24, 16, 0.22, 8), c.light)}</g>`;
  }

  function bed(c, front) {
    const darker = c.bed;
    if (!front) {
      return `<ellipse cx="100" cy="198" rx="92" ry="26" fill="${darker}" stroke="${INK}" stroke-width="3"/>
        <ellipse cx="100" cy="194" rx="74" ry="15" fill="#fff" opacity=".45"/>`;
    }
    return `${P('M8 198 A92 28 0 0 0 192 198 L176 193 A76 13 0 0 1 24 193 Z', darker)}
      <path d="M24 205 Q100 226 176 205" fill="none" stroke="#fff" stroke-width="3" opacity=".35" stroke-dasharray="2 9" stroke-linecap="round"/>`;
  }

  function body(c, acc) {
    let s = '';
    if (c.raca === 'lhasa') {
      s += lhasaBody(c, acc);
      return s;
    }
    if (c.raca !== 'lulu') s += tail(c);
    // quadris
    s += P(fluff(62, 180, 26, 22, 12, 0.14, 3), c.base) + P(fluff(138, 180, 26, 22, 12, 0.14, 5), c.base);
    let torso = P(fluff(100, 150, 52, 52, 22, 0.1, 2), c.base);
    if (acc === 'roupinha') {
      // roupinha azul que abraça o corpo, com gola e manguinhas
      torso += P('M60 122 Q100 108 140 122 Q160 146 150 178 Q126 188 112 184 Q100 172 88 184 Q74 188 50 178 Q40 146 60 122Z', '#8fb9ea') +
        P('M62 122 Q100 110 138 122 Q138 132 128 132 Q100 140 72 132 Q62 132 62 122Z', '#a9cbf2', 2.5) +
        S('M58 160 Q64 168 60 176 M142 160 Q136 168 140 176', '#6f9bd0', 3) +
        `<g fill="#fff" opacity=".85"><circle cx="80" cy="150" r="3.5"/><circle cx="120" cy="156" r="3.5"/><circle cx="100" cy="146" r="3"/><circle cx="92" cy="166" r="3"/><circle cx="130" cy="140" r="3"/><circle cx="68" cy="166" r="3"/></g>`;
    } else {
      torso += `<path d="${fluff(100, 138, 28, 34, 14, 0.16, 6)}" fill="${c.chest}"/>`;
      if (c.raca === 'lhasa') torso += S('M90 128 l-2 12 M100 124 v14 M110 128 l2 12', '#5d5751', 2);
    }
    if (acc === 'coleira') torso += P('M64 118 Q100 134 136 118 L136 126 Q100 142 64 126 Z', '#e04f5f', 2.5) + `<circle cx="100" cy="140" r="7" fill="#ffcf4d" stroke="${INK}" stroke-width="2.5"/>`;
    s += `<g class="torso">${torso}</g>`;
    if (c.raca === 'lulu') s += tail(c);
    // garrinhas (só aparecem quando o gato fica bravo)
    const claws = (x) => c.sp === 'gato'
      ? `<g class="claws">${[-8, 0, 8].map((d) => `<path d="M${x + d - 2.5} 184 L${x + d} 175 L${x + d + 2.5} 184Z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`).join('')}</g>` : '';
    const paw = (x, cls) => `<g class="${cls}">${cls === 'paw-r' ? claws(x) : ''}${P(`M${x - 15} 196 Q${x - 16} 182 ${x} 182 Q${x + 16} 182 ${x + 15} 196 Q${x} 203 ${x - 15} 196 Z`, c.paw)}${S(`M${x - 5} 191 v6 M${x + 5} 191 v6`, INK, 2)}</g>`;
    s += paw(80, 'paw-l') + paw(120, 'paw-r');
    return s;
  }

  /* ---------- deitado (pãozinho), usado quando dorme ---------- */
  function lying(c, acc, mood, a) {
    let s = '';
    // rabo de trás / costas
    if (c.raca === 'lhasa') s += `<g class="tail">${P('M150 160 C170 150 178 132 168 120 C162 112 152 116 152 124 C158 126 160 134 154 142 C150 148 146 152 140 156Z', c.base)}</g>`;
    if (c.raca === 'york') s += `<g class="tail">${T('M160 172 C172 164 176 152 172 142', c.base, 10)}</g>`;
    // corpo deitado
    let torso = P(fluff(108, 178, 68, 28, 24, 0.1, 3), c.base) + P(fluff(150, 170, 26, 22, 12, 0.13, 5), c.base);
    if (c.raca === 'lhasa') torso += S('M60 186 l-2 12 M76 190 l-1 12 M140 190 l1 12 M156 186 l2 12 M120 160 C140 156 156 160 166 168', SHEEN, 2);
    else torso += `<path d="${fluff(70, 186, 22, 14, 12, 0.18, 6)}" fill="${c.chest}"/>`;
    if (acc === 'roupinha') torso += P('M92 160 Q128 148 164 162 Q172 180 164 196 Q128 204 92 198 Q86 178 92 160Z', '#8fb9ea') + `<g fill="#fff" opacity=".85"><circle cx="112" cy="172" r="3.5"/><circle cx="136" cy="166" r="3.5"/><circle cx="150" cy="184" r="3"/><circle cx="124" cy="188" r="3"/></g>`;
    s += `<g class="torso">${torso}</g>`;
    if (c.raca === 'lulu') s += `<g class="tail">${P(fluff(146, 156, 30, 20, 14, 0.22, 8), c.light)}</g>`;
    // rabo enrolado na frente (gatos)
    if (c.sp === 'gato') s += `<g class="tail">${T('M170 186 C186 200 160 210 120 208 C96 207 80 205 70 201', c.base, 13)}</g>`;
    // cabeça apoiada nas patinhas
    s += `<g transform="translate(70 158) scale(.86) rotate(-6)">${head(c, mood, a)}</g>`;
    const paw = (x, y) => P(`M${x - 14} ${y} Q${x - 14} ${y - 10} ${x} ${y - 10} Q${x + 14} ${y - 10} ${x + 14} ${y} Q${x} ${y + 6} ${x - 14} ${y} Z`, c.paw, 2.5);
    s += `<g class="paw-l">${paw(52, 202)}</g><g class="paw-r">${paw(80, 204)}</g>`;
    return s;
  }

  function get(id) { return PETS[id] || PETS['gato-laranja']; }

  /* ---------- falas ----------
     {som}: "Miau" ou "Au". O tom acolhedor NUNCA culpa e nunca fica bravo. */
  const FALAS = {
    debochado: {
      // ---- entrada e estado do mês ----
      boasVindas: ['Bem-vinda! A partir de hoje nenhum gasto escapa de mim. Nem aquele de madrugada.', 'Oi! Vou saber pra onde vai cada centavo seu. Pode ir se acostumando.'],
      vazio: ['Zero lançamentos. Ou você virou monge, ou tá me escondendo coisa.', 'Tô dormindo porque não tem nada pra eu julgar. Por enquanto.', 'Silêncio total por aqui. Suspeito.'],
      resumo: ['Mês nos trilhos: saiu {saiu} e ainda sobram {sobra}. Não estraga, hein.', 'Sobrando {sobra}. Tô quase orgulhoso. Quase.', 'Por enquanto tudo certo. Mas eu sigo de olho no seu cartão.'],
      apertado: ['Ainda tá no azul, mas é um azul bem clarinho: sobram só {sobra}. Freia aí.', 'Sobram {sobra}. Tá na hora de fingir que o delivery não existe.'],
      negativo: ['Opa! Saiu mais do que entrou: {sobra}. O mês tá no vermelho.', 'Vermelho detectado: {sobra}. Hora de cortar o supérfluo, chefe.'],
      semEntrada: ['Já saiu {saiu} e não entrou nada? Anota o salário aí, vai.', 'Só vejo dinheiro saindo. Cadê as entradas? Anota quando cair!'],
      naoEss: ['{pct} dos seus gastos foram não essenciais. Eu vi, tá?', 'Não essenciais já são {pct} do mês. A vontade de comprar tá ganhando de você.'],
      contaVencendo: ['{conta} vence {quando}: {valor}. Só lembrando, com carinho e julgamento.', 'Ei! {conta} vence {quando}. {valor}. Não me faz passar vergonha.'],
      contaAtrasada: ['{conta} tá ATRASADA! {valor}. Juros e multa são meu pesadelo.', 'Alô?! {conta} venceu e ninguém pagou. Corre antes da multa.'],
      tudoPago: ['Todas as contas do mês pagas. Quem é você e o que fez com a minha dona?', 'Tudo pago! Vou tirar um cochilo merecido.'],
      // ---- reações ao salvar um gasto (escolhidas pela situação do mês) ----
      gastoEss: ['{cat}: {valor}. Essencial, vou deixar passar.', 'Anotado. Gasto de gente adulta, nada a declarar.', 'Esse era necessário mesmo. Raro, mas acontece.'],
      gastoNaoEss: ['{valor} em {cat}? Anotei. E julguei.', 'Não essencial, né? Eu vi. Eu sempre vejo.', 'Ah, os pequenos prazeres… e os pequenos rombos.'],
      gastoAlto: ['EITA! {valor} de uma vez?! Meu bigode até tremeu.', '{valor}?! Isso foi um gasto ou um assalto?', 'Respira. Eu respiro também. {valor} não é pouca coisa.'],
      gastoApertado: ['Anotado. Mas ó: sobram só {sobra}. Tô de olho.', 'Mais {valor} a menos. O mês tá ficando magrinho: {sobra}.'],
      gastoApertadoNaoEss: ['Sobram {sobra} e você gasta {valor} em {cat}? Coragem, hein.', 'Mês apertado e gasto não essencial. Ousada.'],
      virouNegativo: ['Pronto: com esse, o mês entrou no vermelho ({sobra}). Parabéns pelo feito. 👏', 'Acabou de virar negativo: {sobra}. Hora de esconder o cartão.'],
      gastoNeg: ['Mais {valor} num mês que já tá em {sobra}. Eu anoto, mas sofro.', 'O vermelho só aumenta: {sobra}. Vou ali chorar na caminha.'],
      gastoNegNaoEss: ['No vermelho e gastando com {cat}?! Assim não dá, chefe!', 'Mês em {sobra} e mais {valor} em coisa não essencial. Tô BRAVO.'],
      gastoNegAlto: ['{valor} com o mês em {sobra}?! Alguém segura esse cartão!'],
      gastoSemEntrada: ['Anotado. Mas cadê as entradas? Só vejo dinheiro saindo.', '{valor} saindo e nada entrando. Anota o salário, vai.'],
      receitaSalva: ['Caiu {valor}! Finalmente uma notícia boa.', 'Opa, entrou {valor}! Não gasta tudo hoje, hein.'],
      saiuDoVermelho: ['Ufa! Com essa entrada o mês voltou pro azul. Agora segura!'],
      apagado: ['Apagado. Vou fingir que não vi.'],
      contaPaga: ['{conta} paga! Olha só, adulta responsável.', 'Conta quitada. Tô até emocionado, de verdade.'],
      // ---- cutucar: só brincadeira, sem falar de dinheiro ----
      acordar: ['Hã?! Eu não tava dormindo, tava… analisando.', 'Me acordou pra quê? Tava sonhando com um mês sem fatura.'],
      cutucar: ['Ei! Dedo pra lá.', '{som}. Isso foi um "me deixa em paz".', 'Cutucar o mascote não paga conta, viu?', 'Tô trabalhando aqui, ó.', 'De novo? Tô contando as cutucadas também.'],
      bravo: ['CHEGA! Vai cutucar a fatura do cartão!', 'Mais uma cutucada e eu escondo o seu Pix.', '{som}!! Respeita meu espaço pessoal!'],
      calmo: ['Tá, passou. Mas eu não esqueci.', 'Ok, te perdoo. Dessa vez.'],
      // ---- sistema ----
      senhaErrada: ['Errou. Tô de olho.', 'Não é essa não, hein.'],
      pinCriado: ['Senha criada. Agora nem eu entro sem pedir licença.'],
      backup: ['Backup feito. Responsável demais, tô até emocionado.']
    },
    acolhedor: {
      // Gentil e honesto: nunca culpa, mas também não esconde quando é hora de frear.
      boasVindas: ['Oi! Que bom ter você aqui. Vamos cuidar das contas juntinhas, no seu tempo.', 'Seja bem-vinda! Aqui é o seu cantinho. O que você anota é só seu.'],
      vazio: ['Tudo tranquilo por aqui. Quando quiser anotar algo, eu acordo.', 'Nada anotado este mês ainda, e tudo bem. Um passo de cada vez.'],
      resumo: ['O mês está sob controle: saiu {saiu} e ainda sobram {sobra}. Assim mesmo!', 'Sobrando {sobra} até agora. Vamos manter esse ritmo tranquilo.', 'Tudo nos eixos este mês. Que bom!'],
      apertado: ['Vamos com calma: ainda está no azul, mas sobram só {sobra}. Dá pra dar uma freadinha.', 'O mês está mais apertadinho. Nada de pânico, só vamos segurar um pouco os gastos que não são essenciais.'],
      negativo: ['Este mês saiu um pouco mais do que entrou ({sobra}). Sem culpa: vamos com calma e dar uma freada no que não é essencial.', 'O mês ficou no vermelho, mas dá pra ajeitar. Uma coisa de cada vez, tá?'],
      semEntrada: ['Já saíram {saiu} este mês. Quando entrar dinheiro, anota aqui que eu fico feliz!', 'Lembrete carinhoso: ainda não tem nenhuma entrada anotada neste mês.'],
      naoEss: ['{pct} dos gastos foram com coisas não essenciais. Tudo bem se divertir, só vamos ficar de olho, tá?', 'Os não essenciais já são {pct} do mês. Que tal segurar um pouquinho até o próximo?'],
      contaVencendo: ['Lembrete: {conta} vence {quando} ({valor}).', 'Só pra não esquecer: {conta} vence {quando}, {valor}.'],
      contaAtrasada: ['{conta} passou do vencimento. Quando puder, dá uma olhadinha, tá?', 'Ficou pendente: {conta} ({valor}). Vamos resolver com calma?'],
      tudoPago: ['Todas as contas do mês estão pagas. Que tranquilidade!', 'Tudo em dia este mês. Pode descansar!'],
      gastoEss: ['Anotado: {cat}, {valor}. Coisa necessária, tudo certo.', 'Prontinho! Gasto essencial guardado aqui.', 'Anotei. Cuidar da casa é isso mesmo.'],
      gastoNaoEss: ['Anotei! Um agradinho de vez em quando faz bem.', 'Guardado. Só vamos ficar de olho nos não essenciais, tá?'],
      gastoAlto: ['Esse foi um gasto maior ({valor}). Fica registrado, sem problema.', 'Anotei os {valor}. Gastos grandes acontecem, o importante é saber.'],
      gastoApertado: ['Anotado. O mês está apertadinho: sobram {sobra}. Vamos com calma.', 'Guardei. Agora sobram {sobra}, então vamos segurar um pouquinho.'],
      gastoApertadoNaoEss: ['Anotei. Como sobram só {sobra}, que tal deixar os não essenciais pra depois?', 'Guardado. O mês está curtinho, vamos dar uma freada nos agradinhos?'],
      virouNegativo: ['Anotei. Com esse gasto o mês passou do que entrou ({sobra}). Sem culpa: daqui pra frente, só o essencial, combinado?', 'O mês ficou no vermelho agora. Respira, dá pra ajeitar. Vamos frear um pouquinho.'],
      gastoNeg: ['Anotado. O mês está em {sobra}, então vamos com calma nos próximos.', 'Guardei. Estamos no vermelho, mas um passo de cada vez a gente ajeita.'],
      gastoNegNaoEss: ['Anotei. Como o mês já está no vermelho, que tal deixar os agradinhos pro mês que vem?', 'Guardado. Agora é hora de frear o que não é essencial, tá bom?'],
      gastoNegAlto: ['Anotei os {valor}. O mês ficou mais apertado ({sobra}). Vamos ver com calma onde dá pra segurar?'],
      gastoSemEntrada: ['Anotado! Quando entrar dinheiro este mês, anota também que eu te ajudo a ver como está.'],
      receitaSalva: ['Que bom! Entraram {valor}!', 'Oba! Anotei a entrada de {valor}.'],
      saiuDoVermelho: ['Que alívio! Com essa entrada o mês voltou pro azul.'],
      apagado: ['Pronto, apaguei.'],
      contaPaga: ['{conta} paga! Que alívio, parabéns!', 'Conta em dia! Fiquei feliz por você.'],
      acordar: ['Oi! Acordei! Que bom te ver.', 'Hmm, que soninho bom. Estou aqui!'],
      cutucar: ['Hihi, cócegas!', 'Esse carinho eu aceito sempre.', 'Oi, oi! Estou aqui.', 'Ronron… ai, que delícia!', 'Ai, que gostoso. Mais um?'],
      bravo: ['Hihi, assim faz muitas cócegas!'],
      calmo: ['Estou aqui, pertinho.'],
      senhaErrada: ['Hmm, não foi essa. Tenta de novo com calma.', 'Quase! Tenta mais uma vez.'],
      pinCriado: ['Pronto! Agora seu cantinho tem cadeado.'],
      backup: ['Cópia guardada! Seus dados estão protegidos.']
    }
  };
  // Cachorro não ronrona :)
  const DOG_SWAP = { 'Ronron… ai, que delícia!': 'Abanei o rabo todinho!' };
  function fala(tone, situ, sp, avoid) {
    const list = (FALAS[tone] || FALAS.acolhedor)[situ] || [''];
    let pool = list.length > 1 && avoid ? list.filter((t) => t.replace('{som}', sp === 'cao' ? 'Au' : 'Miau') !== avoid) : list;
    if (!pool.length) pool = list;
    let out = pool[Math.floor(Math.random() * pool.length)].replace('{som}', sp === 'cao' ? 'Au' : 'Miau');
    if (sp === 'cao' && DOG_SWAP[out]) out = DOG_SWAP[out];
    return out;
  }

  window.Pet = {
    list: PETS,
    get,
    fala,
    // Ações de "vida própria" por espécie (usadas pelo app de tempos em tempos)
    idleActs(id) { return get(id).sp === 'cao' ? ['look', 'shake', 'stretch'] : ['look', 'lick', 'stretch']; },
    face({ pet, acc = 'none', mood = 'normal', label = 'Mascote' } = {}) {
      const c = get(pet);
      const a = acc === 'roupinha' || acc === 'coleira' ? 'none' : acc;
      return `<svg viewBox="-74 -82 148 150" role="img" aria-label="${label}" class="pet face m-${mood} sp-${c.sp} r-${c.raca || 'gato'}">${head(c, mood, a)}</svg>`;
    },
    full({ pet, acc = 'none', mood = 'normal', bed: withBed = true, label = 'Mascote' } = {}) {
      const c = get(pet);
      const a = acc === 'roupinha' || acc === 'coleira' ? 'none' : acc;
      return `<svg viewBox="0 -22 200 250" role="img" aria-label="${label}" class="pet full m-${mood} sp-${c.sp} r-${c.raca || 'gato'}${mood === 'dormindo' ? ' lying' : ''}">
        ${withBed ? bed(c, false) : '<ellipse cx="100" cy="206" rx="70" ry="9" fill="#000" opacity=".12"/>'}
        <g class="all">${mood === 'dormindo'
          ? `<g transform="translate(0 ${withBed ? -6 : 2})">${lying(c, acc, mood, a)}</g>`
          : `${body(c, acc)}<g transform="translate(100 78)">${head(c, mood, a)}</g>`}</g>
        ${withBed ? bed(c, true) : ''}</svg>`;
    }
  };
})();
