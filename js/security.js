/* Senha (PIN) e código de recuperação.
   A senha nunca é salva: só um "hash" (impressão digital) com sal aleatório.
   Isso protege contra olhadinhas da família, NÃO é criptografia dos dados. */
(function () {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I/L pra não confundir

  function randBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Fallback simples se crypto.subtle não existir (ex.: página aberta sem https).
  function weakHash(str) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619);
      h2 = Math.imul(h2 + str.charCodeAt(i), 2654435761);
    }
    return 'w' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  window.Sec = {
    randHex(n) { return toHex(randBytes(n)); },
    uid() { return (crypto.randomUUID && crypto.randomUUID()) || toHex(randBytes(16)); },
    async hash(text, salt) {
      const data = new TextEncoder().encode(salt + ':' + text);
      if (crypto.subtle) return toHex(await crypto.subtle.digest('SHA-256', data));
      return weakHash(salt + ':' + text);
    },
    recoveryCode() {
      const b = randBytes(8);
      const s = [...b].map((x) => ALPHABET[x % ALPHABET.length]).join('');
      return s.slice(0, 4) + '-' + s.slice(4);
    },
    normalizeCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  };
})();
