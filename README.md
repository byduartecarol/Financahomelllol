# Finanças da Casa (PWA)

App de finanças da casa (perfis "Mãe" e "Eu"), em português, salvo só no celular (IndexedDB).
Sem servidor, sem login de banco, sem conexão com banco. Backup por arquivo JSON.

## Onde paramos
**Fase 1 — Etapa 1 (pronta):**
- Perfis estilo Netflix (Mãe e Eu), dados separados por `profileId`.
- Senha (PIN 4–6 números) opcional por perfil, guardada só em hash SHA-256 com sal.
- Código de recuperação (mostrado uma vez) + "Apagar dados e recomeçar" se perder tudo.
- Perfil dono (Eu) reseta a senha de outro perfil. A pessoa é avisada no próximo login.
  O dono precisa ter senha pra usar isso.
- Bloqueio automático depois de 2 min com o app em segundo plano (se o perfil tiver senha).
- 5 senhas erradas → espera 30 s.
- Ajustes por perfil: letra P/M/G/GG, claro/escuro, botões grandes, tom do gato,
  cor e acessório do gato, nome do perfil.
- Mascotes originais em SVG (`js/pets.js`): 4 gatos (laranja, preto, branco, cinza) e 3 cães
  (Lhasa Apso de pelo liso, Yorkshire, Lulu caramelo). Carinha nos avatares e corpo inteiro na tela inicial,
  com caminha opcional e acessórios (óculos, laço, flor, chapéu, roupinha, coleira).
- Humores: normal, feliz, preocupado, triste, surpreso, dormindo, bravo.
- Vida própria (etapa 1.1): respira, pisca, abana o rabo; sozinho se espreguiça, lambe a pata ou olha
  pros lados (cães se chacoalham). No toque, acena ou rola. Dormindo, acorda quando é tocado.
  Comemoração com pulo e confete (`celebrate()` em app.js).
- Bravo: só no tom debochado, depois de 6 cutucadas em 4 s. O gato estufa, mostra as garras e solta HSSS!,
  o cão late (AU! AU!). Ele fica emburrado por 9 s. O tom acolhedor NUNCA fica bravo.
- Aviso automático quando o Chrome está no modo "Site para computador".
- Tela inicial: fala do gato, navegação entre meses, "Falta pagar" (ainda R$ 0) e lembrete de backup.
- Backup por perfil: salvar (.json), enviar pelo compartilhar do Android (quando suportado) e restaurar.
  O backup não leva a senha.
- PWA: manifest, ícones, service worker (funciona offline).

**Próxima etapa sugerida (Fase 1, etapa 2):** cadastro manual de contas e cartões (etiquetas)
e lançamento de gastos e receitas com teclado rápido (+10, +20, +50, +100) e as 3 etiquetas.
Os registros vão no store `records` com `profileId` e `type`.

## Estrutura
```
index.html            casca do app
styles.css            visual (variáveis de tema e tamanho de letra no <html>)
manifest.webmanifest  instalação no Android
sw.js                 offline. AUMENTE a VERSION a cada publicação
js/db.js              IndexedDB (profiles, records)
js/security.js        hash de PIN e código de recuperação
js/pets.js            desenho dos mascotes e falas por tom
js/app.js             telas e ações
icons/                ícones PNG
```

## Como testar no celular Android
O app precisa de um endereço **https** pra ser instalado. O jeito grátis é o GitHub Pages:
1. Crie uma conta em github.com e um repositório novo e público (ex.: `financas-casa`).
2. "Add file" → "Upload files" → envie todos os arquivos e pastas deste projeto
   (`index.html` precisa ficar na raiz do repositório).
3. Settings → Pages → Source: "Deploy from a branch" → branch `main`, pasta `/ (root)` → Save.
4. Depois de 1 ou 2 minutos, abra `https://SEU-USUARIO.github.io/financas-casa/` no Chrome do Android.
5. Menu ⋮ → "Instalar app" (ou "Adicionar à tela inicial").

Atualizar: envie os arquivos novos pro repositório (aumente a `VERSION` no `sw.js`),
depois feche e abra o app duas vezes.

Os dados ficam no celular, não no GitHub. O GitHub só guarda o código do app.
