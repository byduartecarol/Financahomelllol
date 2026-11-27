/* Gatinho mascote — desenho original em SVG.
   Humores: feliz, normal, preocupado, triste, surpreso, dormindo. */
(function () {
  const INK = '#2b2522';

  function eyes(mood) {
    switch (mood) {
      case 'feliz':
        return `<path d="M37 63 Q45 54 53 63 M67 63 Q75 54 83 63" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
      case 'dormindo':
        return `<path d="M37 61 Q45 68 53 61 M67 61 Q75 68 83 61" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
          <text x="92" y="26" font-size="15" font-weight="700" fill="${INK}" opacity=".7" font-family="sans-serif">z</text>
          <text x="102" y="14" font-size="11" font-weight="700" fill="${INK}" opacity=".5" font-family="sans-serif">z</text>`;
      case 'surpreso':
        return `<circle cx="45" cy="60" r="8" fill="${INK}"/><circle cx="75" cy="60" r="8" fill="${INK}"/>
          <circle cx="48" cy="57" r="2.6" fill="#fff"/><circle cx="78" cy="57" r="2.6" fill="#fff"/>`;
      case 'preocupado':
        return `<circle cx="45" cy="62" r="5.5" fill="${INK}"/><circle cx="75" cy="62" r="5.5" fill="${INK}"/>
          <circle cx="47" cy="60" r="1.8" fill="#fff"/><circle cx="77" cy="60" r="1.8" fill="#fff"/>
          <path d="M35 53 L52 48 M85 53 L68 48" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
      case 'triste':
        return `<circle cx="45" cy="63" r="5.5" fill="${INK}"/><circle cx="75" cy="63" r="5.5" fill="${INK}"/>
          <circle cx="47" cy="61" r="1.8" fill="#fff"/><circle cx="77" cy="61" r="1.8" fill="#fff"/>
          <path d="M36 52 L51 56 M84 52 L69 56" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
          <path d="M40 70 q-3 6 0 8 q3 -2 0 -8z" fill="#7cc4f2"/>`;
      default:
        return `<circle cx="45" cy="62" r="5.5" fill="${INK}"/><circle cx="75" cy="62" r="5.5" fill="${INK}"/>
          <circle cx="47" cy="60" r="1.8" fill="#fff"/><circle cx="77" cy="60" r="1.8" fill="#fff"/>`;
    }
  }

  function mouth(mood) {
    if (mood === 'triste') return `<path d="M53 82 Q60 76 67 82" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    if (mood === 'surpreso') return `<ellipse cx="60" cy="81" rx="4" ry="5" fill="${INK}"/>`;
    if (mood === 'preocupado') return `<path d="M53 80 q3.5 -3 7 0 q3.5 3 7 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    return `<path d="M52 77 Q56 82 60 77 Q64 82 68 77" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  }

  function accessory(a) {
    switch (a) {
      case 'oculos':
        return `<g fill="none" stroke="${INK}" stroke-width="2.5"><circle cx="45" cy="62" r="11"/><circle cx="75" cy="62" r="11"/><path d="M56 61 Q60 58 64 61"/></g>`;
      case 'laco':
        return `<g transform="translate(88 34) rotate(18)"><path d="M0 0 L-14 -9 L-14 9 Z M0 0 L14 -9 L14 9 Z" fill="#e8507a"/><circle r="4.5" fill="#c23a62"/></g>`;
      case 'flor':
        return `<g transform="translate(30 32)">${[0, 72, 144, 216, 288].map((r) => `<ellipse rx="5" ry="8" transform="rotate(${r}) translate(0 -7)" fill="#ffd25e"/>`).join('')}<circle r="4.5" fill="#f08a3c"/></g>`;
      case 'chapeu':
        return `<g><ellipse cx="60" cy="31" rx="30" ry="5" fill="#3a3a52"/><path d="M42 31 Q44 10 60 10 Q76 10 78 31Z" fill="#3a3a52"/><rect x="43" y="24" width="34" height="5" fill="#e8507a"/></g>`;
      default:
        return '';
    }
  }

  // color: cor do pelo. Retorna string SVG.
  window.catSVG = function ({ color = '#f2a65a', acc = 'none', mood = 'normal', label = 'Gatinho' } = {}) {
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${label}" class="cat cat-${mood}">
      <ellipse cx="60" cy="108" rx="34" ry="5" fill="#000" opacity=".12"/>
      <g class="tail"><path d="M86 96 Q112 98 110 74 Q108 60 115 52" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/></g>
      <g class="ear ear-l"><path d="M20 54 L28 12 L55 34 Z" fill="${color}"/><path d="M27 44 L31 22 L46 35 Z" fill="#f6b3bf"/></g>
      <g class="ear ear-r"><path d="M100 54 L92 12 L65 34 Z" fill="${color}"/><path d="M93 44 L89 22 L74 35 Z" fill="#f6b3bf"/></g>
      <ellipse cx="60" cy="66" rx="43" ry="37" fill="${color}"/>
      <ellipse cx="60" cy="58" rx="30" ry="14" fill="#fff" opacity=".13"/>
      <ellipse cx="60" cy="82" rx="18" ry="11" fill="#fff" opacity=".55"/>
      <ellipse cx="33" cy="76" rx="7" ry="4" fill="#ff8fa3" opacity=".45"/>
      <ellipse cx="87" cy="76" rx="7" ry="4" fill="#ff8fa3" opacity=".45"/>
      <g class="eyes">${eyes(mood)}</g>
      <path d="M56 71 L64 71 L60 75 Z" fill="#e8708a"/>
      ${mouth(mood)}
      <g stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".55">
        <path d="M30 72 L12 69 M30 77 L13 80 M90 72 L108 69 M90 77 L107 80"/>
      </g>
      ${accessory(acc)}
    </svg>`;
  };

  /* Falas por tom. O acolhedor NUNCA culpa. */
  const FALAS = {
    debochado: {
      boasVindas: [
        'Bem-vinda ao seu app de finanças. Eu sou o gato que vai saber pra onde foi seu dinheiro. Todinho.',
        'Oi! A partir de hoje, nenhum gasto escapa de mim. Nem aquele de madrugada.'
      ],
      vazio: [
        'Zero lançamentos. Ou você virou monge, ou tá me escondendo coisa.',
        'Tô dormindo porque não tem nada pra eu julgar. Por enquanto.',
        'Silêncio total por aqui. Suspeito.'
      ],
      cutucar: [
        'Ei! Tava sonhando com um mês sem fatura.',
        'Cutucar o gato não paga conta, viu?',
        'Miau. Isso foi um "me deixa em paz" em gatês.',
        'Se cada cutucada valesse R$ 1, você já tinha reserva de emergência.'
      ],
      senhaErrada: ['Errou. Tô de olho.', 'Não é essa não, hein.'],
      pinCriado: ['Senha criada. Agora nem eu entro sem pedir licença.'],
      backup: ['Backup feito. Responsável demais, tô até emocionado.']
    },
    acolhedor: {
      boasVindas: [
        'Oi! Que bom ter você aqui. Vamos cuidar das contas juntinhas, no seu tempo.',
        'Seja bem-vinda! Aqui é o seu cantinho. O que você anota é só seu.'
      ],
      vazio: [
        'Tudo tranquilo por aqui. Quando quiser anotar algo, eu acordo.',
        'Estou descansando. Pode me chamar quando quiser.',
        'Nada anotado ainda, e tudo bem. Um passo de cada vez.'
      ],
      cutucar: [
        'Oi, oi! Estou aqui com você.',
        'Que carinho bom! Obrigado.',
        'Você está indo muito bem, sabia?',
        'Respira fundo. A gente resolve uma coisa de cada vez.'
      ],
      senhaErrada: ['Hmm, não foi essa. Tenta de novo com calma.', 'Quase! Tenta mais uma vez.'],
      pinCriado: ['Pronto! Agora seu cantinho tem cadeado.'],
      backup: ['Cópia guardada! Seus dados estão protegidos.']
    }
  };

  window.catFala = function (tone, situ, avoid) {
    const list = (FALAS[tone] || FALAS.acolhedor)[situ] || [''];
    if (list.length > 1 && avoid) {
      const others = list.filter((t) => t !== avoid);
      return others[Math.floor(Math.random() * others.length)];
    }
    return list[Math.floor(Math.random() * list.length)];
  };
})();
