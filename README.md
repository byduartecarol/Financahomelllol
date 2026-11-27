# Finanças da Casa (PWA)

App de finanças da casa (perfis "Mãe" e "Eu"), em português, salvo só no celular (IndexedDB).
Sem servidor, sem login de banco, sem conexão com banco. Backup por arquivo JSON.

## Onde paramos
**Versão 1.0.0 — Fase 3 completa:**
- **Gato investidor** (`investir`): simulador parado × poupança × renda fixa (% do CDI, IR regressivo) e 10 lições "Aprenda a investir". Só ensina, nunca recomenda.
  Selic da API pública do Banco Central (SGS série 432), com fonte e data no rodapé; sem internet usa a última guardada (padrão: 13,75%, Copom de 04/11/2026); aviso quando tem mais de 31 dias; dá pra digitar a taxa.
- Ajustes: botões de adicionar logo abaixo do total; dívida com banco (chips) e conta que paga (aparece na página da conta); dívida "já paga" aparece ✓ no checklist; fatura mostra nº de parcelas; parcelado no crédito sem cartão aparece no checklist; entradas do planejamento detalháveis (`items['in:<cat>']`).

**Fase 3, partes 2 e 3 — versão 0.10.0 (prontas):**
- **Caixinhas** (`goal` + movimentos `goalmv`): meta, prazo opcional (mês), quanto guardar por mês, trilha em SVG com o mascote andando (0/25/50/75/100%) e falas por etapa nos dois tons; guardar/tirar; concluídas 🏁; sugestão de reserva de emergência = 3× média dos gastos essenciais. Guardar não conta como gasto.
- **Vontade de comprar** (`wish`): anota, espera 24h, depois "Ainda quero" (abre o lançamento já preenchido e marca comprada ao salvar), "Desisti" (soma no poupado e pode ir pra uma caixinha) ou "esperar mais 24h". Aviso no Início quando passa 24h; lembrete opcional em .ics (sem servidor, sem notificação com app fechado).
- Backup/restaurar remapeia `goalId` e `wishId`.

**Ajustes 0.9.2 (prontos):**
- Aba **Mais** (no lugar de Ajustes na barra): todas as funções + busca sem acento + ajuda rápida (FAQ).
- Botão voltar do Android: reserva de 3 entradas criadas no toque; Ajustes → Mais → Início → Perfis → sai.
- Rosca do Resumo e linhas do Orçamento clicáveis: abrem o Extrato filtrado pela categoria (chip "✕ Todas").
- Planejamento detalhado: "detalhar em itens" por categoria de gasto (nome + valor); total = soma; sugere as contas fixas da categoria.
- Dívidas por tipo: Empréstimos/financiamentos, Contas parceladas (carnê, crediário), Acordos. Seção "Parcelados no cartão" só pra consulta (não soma).

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

**Fase 1 — Etapa 2 (pronta):**
- Carteira: cadastro manual de contas e cartões (só etiquetas; cartão guarda dia de fechamento e vencimento).
- Lançar gasto/receita (`js/lanc.js`): teclado em centavos + botões +10/+20/+50/+100, categoria,
  forma de pagamento (Pix, débito, crédito, dinheiro), conta/cartão, parcelas (crédito), essencial ou não
  (sugerido pela categoria), descrição e data (hoje/ontem/outra). Lembra a última forma de pagamento.
- Extrato do mês: entrou/saiu/sobrou, barra essencial × não essencial, filtro, editar e apagar.
- Tela inicial: "Saiu no mês", botões de lançar, últimos lançamentos.
- Mascote reage: dorme sem lançamentos no mês, fica feliz ao anotar, surpreso com gasto alto
  (R$ 300+ ou 25%+ do que entrou no mês, `Money.isBig`) e comemora receita.
- Registros no store `records`: `type:'wallet'` e `type:'tx'` (valores em centavos, data local AAAA-MM-DD).
  Compra parcelada fica guardada inteira, com `parcelas`. A divisão nas faturas é a etapa 3.

**Etapa 2.1 (pronta):**
- Botão "voltar" do Android navega dentro do app (só sai na tela de perfis). Formulário com mudança não salva pergunta antes de sair.
- Categorias da pessoa (`type:'cat'`: nome, emoji, essencial, gasto/receita). Criadas no lançar ou em Ajustes. Apagar uma em uso só arquiva, pro histórico manter o nome.
- Saldo do mês: "Sobrou" ou "Ficou negativo" (vermelho) no Início e no Extrato. O mascote fica preocupado quando um gasto faz o mês virar negativo (só se houver receita no mês).
- Carteira: tocar no cartão ou na conta mostra os lançamentos do mês nele. "Editar" fica no topo, e dá pra lançar direto nele.
- Extrato "Por forma de pagamento" (Pix, débito, crédito, dinheiro), tocando pra filtrar.

**Fase 1 — Etapa 3 (pronta):**
- Fatura do cartão (`lanc.js`, `Money.faturaOf`): a fatura é identificada pelo mês em que vence. Compra no dia do
  fechamento ou depois vai pra fatura seguinte. Parcelas são espalhadas nas faturas futuras, e a diferença de centavos fica na 1ª.
- "Já tinha coisa no cartão": `cardopen` (valor que já estava numa fatura) e `cardinst` (parcelamento em andamento:
  valor da parcela, parcela atual, total → `remaining` faturas a partir de `firstKey`).
- Fatura: status (aberta, fechada, vence amanhã/hoje, atrasada, paga), total, essencial × não essencial × sem etiqueta,
  itens, "Marquei como paga" (`fatpaid`, com comemoração). Pagar a fatura NÃO entra como gasto, pra não contar em dobro:
  o gasto já foi contado na compra.
- Início: "Faturas do cartão" com a próxima a pagar de cada cartão. Extrato: cada compra no crédito diz em qual fatura cai.
- Carteira: seção "Formas de pagamento" (Pix, Débito, Crédito, Dinheiro) com o total do mês, levando ao extrato filtrado.
- Frases do mascote por situação real (`moodOnEnter`): fatura atrasada > fatura vencendo (≤3 dias) > mês negativo >
  sem entrada anotada > mês apertado (sobra <10%) > muito não essencial (≥40%) > tudo bem. Cutucar é só brincadeira.
  O tom acolhedor é gentil e honesto: sem culpa, mas sugere "dar uma freada".

**Fase 1 — Etapa 4 (pronta):**
- Contas fixas (`bill`): fixa ou variável. Variável estima pela média dos últimos 3 meses com valor real (`billAvg`),
  e tem "Chegou a conta: salvar valor sem pagar". Conta nova cujo vencimento deste mês já passou pergunta se já foi paga.
- Checklist do mês (`dueList`): contas fixas + faturas que vencem no mês, por urgência (atrasada > hoje > em até 3 dias > aberta > paga).
  No mês atual também mostra pendências atrasadas dos 2 meses anteriores.
- "Paguei" cria um gasto no extrato (`tx.billId`) e marca `billpay.paidAt`. Desmarcar ou apagar o gasto desfaz o pagamento.
- Início: "Falta pagar" + contas do mês. Mascote: atrasada (triste/preocupado), vencendo, tudo pago (feliz).
- Lembretes: exporta .ics pro Google Agenda (2 eventos mensais por conta, às 9h: 3 dias antes e no dia; dias 29-31 viram
  "último dia do mês"). Notificação do próprio app com ele fechado não é confiável sem servidor, por isso a garantia é a agenda.
- Reação ao salvar gasto (`reaction`) olha o mês: essencial / não essencial / alto / apertado / virou negativo / já negativo /
  sem entrada. No debochado, gasto não essencial com o mês negativo deixa o mascote BRAVO.

**Fase 1 — Etapa 5 (pronta) — FASE 1 CONCLUÍDA:**
- Finanças administradas: o perfil dono liga em Ajustes um "caderno" por outro perfil (`profile.admFor`).
  Os registros ficam com `profileId = "adm-<id>"` (`ledger()` em app.js), totalmente separados do perfil privado da pessoa.
- Início/Extrato/Carteira/Contas mostram "Minhas | Da Mãe". No caderno administrado o tema fica lilás (`data-ledger="adm"`).
- O backup do perfil dono inclui os cadernos administrados. A restauração devolve cada registro ao seu caderno e
  remapeia ids e referências (carteira, conta, categoria) quando o backup vem de outro perfil.
- Correções: backup compartilhado como .txt (o Android não compartilha .json); quadro "📬 A conta chegou?" nas contas variáveis;
  botão do meio vira "＋ Conta" na tela de Contas; opção "Esconder este perfil neste celular".
- IMPORTANTE: cada celular tem os próprios dados (sem servidor). Os celulares NÃO sincronizam.

**Fase 2 — Parte 1 (pronta):**
- Perfis: "＋ Adicionar perfil" (nome, bicho, tom, letra) e "Apagar este perfil deste celular" (digitando APAGAR).
  Ao apagar o dono, outro perfil vira dono.
- Cadernos administrados independentes (`profile.admBooks = [{id, name}]`, ledger `adm-<id>`). Não dependem do outro perfil
  existir no celular. O antigo `admFor` é migrado automaticamente.
- Contas fixas com "Quem paga?": `payer` = eu | outro (`payerName`; só acompanha, "✓ Ela pagou" sem lançamento) | dividido
  (`share` %; só a minha parte entra no falta pagar, no extrato e no orçamento). "📅 Mandar lembretes pra <pessoa>" gera .ics
  só com as contas dela.
- Orçamento planejado × real (`type:'plan'`, `key`, `out{cat:c}`, `in{cat:c}`): vale do mês da chave em diante, até outro plano.
  Tela com Esperado × Real (entradas, gastos, sobra), barras por categoria (verde, laranja a partir de 80%, vermelho estourado),
  entradas (falta entrar / recebido). Atalhos: preencher com as contas fixas e copiar o real do mês passado. Card no Início.
- Mascote: quase no limite (80%) → preocupado; passou do limite → triste; ao entrar com categoria estourada → avisa.
  Gasto grande dentro do planejado não assusta.

**Fase 2 — Partes 2 e 3 (prontas):**
- `js/charts.js`: gráficos em SVG puro (rosca, barras agrupadas, barras empilhadas, linha com média), dica ao tocar
  (`data-tip`). Paleta categórica validada contra daltonismo e contraste nos dois temas (`--s1..--s8`) + cores de status
  (`--ok`, `--bad`, `--warn`), sempre com legenda e valores escritos.
- Extrato com abas "Lançamentos | Resumo e gráficos". O Resumo mostra entrou/saiu/sobrou, a variação × mês anterior,
  % essencial, o maior gasto, a rosca por categoria (top 7 + "Outras") com lista de valores, entradas × gastos (6 meses),
  o histórico das contas variáveis (valores reais + média) e as contas pagas em dia × com atraso × vencidas sem pagar (6 meses).
- Assinaturas (`type:'sub'`): mensal ou anual, dia (e mês) da cobrança, forma de pagamento/cartão, teste grátis (aviso a 3 dias
  e mascote preocupado), total por mês (anual ÷ 12) e por ano. "Lançar sozinho": cada cobrança vira um gasto uma única vez
  (`tx.subId` + `subKey`). Apagar esse gasto cria `subskip`, pra ele não voltar. Cancelar = `active:false` (o histórico fica).
  Ao cadastrar, se a cobrança deste mês já passou, o app pergunta se lança.

**Fase 2 — Parte 4 (pronta) — FASE 2 CONCLUÍDA:**
- Relatório mensal (`vRelatorio`) do caderno ativo: resumo, orçamento esperado × real, gastos por categoria, contas do mês com
  situação, assinaturas, dívidas e todos os lançamentos. "Imprimir / salvar PDF" (`window.print` + `@media print`) e
  "Mandar resumo" (texto curto pelo compartilhar do Android, ou copiado). No caderno administrado: "Finanças da Mãe ·
  Administradas por Eu. Relatório pra registro e transparência."

**Fase 3 — Parte 1 (pronta): dívidas**
- `type:'debt'`: parcela, total, já pagas, juros a.m. (opcional), saldo devedor (opcional), vencimento, credor, negociações
  (`negs`), `isNew` ("fiz agora" zera o contador), `startKey` (se a parcela do mês já foi paga ao cadastrar).
- Pagar a parcela gera um gasto na categoria "Dívidas e empréstimos" (`tx.debtId`, `debtN`) e comemora. A última parcela
  marca a dívida como quitada. Dá pra desfazer a última parcela.
- Parcelas das dívidas entram no checklist "Contas do mês" e no "falta pagar".
- Plano de quitação: "Menor primeiro" (bola de neve) ou "Maior juros primeiro" (avalanche), com dinheiro extra por mês
  (`payoffPlan`, aproximado e sem juros), mostrando a ordem, o foco e o mês previsto de quitação.
- "🏅 X dias sem dívida nova".

**Próximo (Fase 3 — partes 2 e 3):** caixinhas (meta, prazo, progresso) + trilha guiada pelo mascote; "vontade de comprar"
(anota e pergunta em 24h). **Parte 4:** gato investidor (taxa do Banco Central) + "Aprenda a investir". No fim: checklist pra mãe.

## Estrutura
```
index.html            casca do app
styles.css            visual (variáveis de tema e tamanho de letra no <html>)
manifest.webmanifest  instalação no Android
sw.js                 offline. AUMENTE a VERSION a cada publicação
js/db.js              IndexedDB (profiles, records)
js/security.js        hash de PIN e código de recuperação
js/pets.js            desenho dos mascotes e falas por tom
js/money.js           categorias, formas de pagamento, datas, centavos
js/lanc.js            carteira, lançar, extrato (etapa 2)
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
