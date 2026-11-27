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

**Próxima etapa (Fase 1, etapa 5):** "Finanças da Mãe" dentro do perfil Eu: área separada pra renda e contas dela que eu
administro e pago, sem mostrar nada do perfil privado dela.

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
