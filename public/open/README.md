# Open: visual da Mini App (Telegram)

Página estática com uma esfera de ~5–7 mil partículas douradas sobre fundo preto, reativa ao áudio, com rosto expressivo, relógio, clima, notícias, textos, formas 3D, cores e efeitos. Arquivos: `index.html` (tudo inline) + `three.min.js` (Three.js r149 local, sem CDN). Só caminhos relativos, então funciona direto no **GitHub Pages** (`https://<user>.github.io/<repo>/`).

Toda função existe de 3 jeitos: **JS** (`window.openX` / `Open.x`), **postMessage** e **parâmetro de URL** (query `?a=b` ou hash `#a=b`; use `encodeURIComponent`).

## Tabela de comandos

| O quê | JS | postMessage | URL |
|---|---|---|---|
| Estado | `openState('idle'\|'listening'\|'thinking'\|'speaking'\|'face')` | `{type:'state', state}` | `?state=` |
| Rosto + expressão | `openFace('happy')` | `{type:'face', expr}` | `?show=face&expr=happy` |
| Falar áudio | `openSpeak(url, text?)` | `{type:'speak', audio, text?, expr?}` | `?audio=<mp3>&text=` |
| Falar texto (TTS pt-BR) | `openSay(text)` | `{type:'speak', text}` / `{type:'say', text}` | `?text=` / `#text=` |
| Só legenda | `openSay(text,{speak:false})`, `openCaption(text, ms)` | `{type:'say', text, speak:false}`, `{type:'caption', text, ms}` | n/a |
| Parar | `openStop()` | `{type:'stop'}` | n/a |
| **Relógio** HH:MM + data | `openShow('clock')` | `{type:'show', name:'clock'}` | `?show=clock` |
| **Data** (dia grande + mês) | `openShow('date')` | `{type:'show', name:'date'}` | `?show=date` |
| **Clima** (Open-Meteo) | `openShow('weather', {lat, lon, geo})` | `{type:'show', name:'weather', lat, lon}` | `?show=weather&lat=&lon=` |
| **Notícia** (painel holográfico) | `openShow('news', {title, text, image, ms})` | `{type:'show', name:'news', title, text, image, ms}` | `?show=news&title=&body=&image=&ms=` |
| **Logo** THE KAUEZIN | `openShow('logo')` | `{type:'show', name:'logo'}` | `?show=logo` |
| **Texto** (2 linhas, ~12 chars) | `openShow('text', {text:'OI KAUE'})` | `{type:'show', name:'text', text}` | `?show=text&label=OI%20KAUE` |
| **Forma** | `openShow('shape', {shape:'heart'})` ou `openShow('heart')` | `{type:'show', name:'shape', shape}` | `?show=shape&shape=heart` ou `?show=heart` |
| **Timer** | `openShow('timer', {seconds:30})` | `{type:'show', name:'timer', seconds}` | `?show=timer&seconds=30` |
| Voltar à esfera | `openShow('none')` | `{type:'show', name:'none'}` | n/a |
| **Cor** | `openColor('gold'\|'blue'\|'red'\|'green'\|'purple'\|'white'\|'rainbow'\|'#ff8800')` | `{type:'color', color}` | `?color=blue` |
| **Efeito** | `openFx('explode'\|'implode'\|'shockwave'\|'sparkle'\|'fireworks')` | `{type:'fx', fx}` | `?fx=fireworks` |
| Toque simulado | `openTap(x01, y01)` | `{type:'tap', x, y}` | n/a |
| **Showcase** (passa por tudo) | `openShowcase()` / `openShowcase(false)` | `{type:'showcase', on}` | `?showcase=1` (`&speed=2` acelera) |
| Demo de estados + rosto | n/a | n/a | `?demo=1` |
| Sessão | `openParams.sid` | n/a | `?sid=` (ou `start_param` do Telegram) |
| **Perguntar ao Jarvis** | `openAsk(text)` | `{type:'ask', text}` | `?transport=http&base=` / `?transport=ntfy&topic=` |

Formas: `heart`, `star`, `ring`, `cube` (aramado), `dna`, `galaxy`, `planet` (com anéis), `wave`, `vr` (óculos VR), `bolt`, `infinity`, `skull`. Trocar de forma faz um pequeno "estouro" e as partículas se reorganizam suavemente.
Qualquer `openShow` aceita `ms` para voltar sozinho à esfera depois desse tempo. `openState(...)` (exceto `speaking`) e `openFace` também saem do show. Estando num show, falar não sai dele.
**Obs.:** com `?show=text` ou `?show=news`, o texto vem de `label` / `body` (o `text` só serve de fallback e, nesse caso, **não** é falado).

Leitura: `Open.current` (estado), `Open.shown` (show ativo), `Open.expr`, `Open.levels`, `openParams`.
Eventos no `window`: `open:state`, `open:face`, `open:show`, `open:color`, `open:weather`, `open:tap`, `open:timer` (fim do timer), `open:ended` (fim da fala). Dentro de um iframe, `open:ended` e `open:timer` também vão para o parent via `postMessage`.

## Conversa com o Jarvis (barra inferior)
Barra fixa embaixo com **histórico** (balão, liga/desliga a transcrição semitransparente das últimas trocas), **campo de texto** (Enter ou o botão enviar mandam, sem fechar a página) e **microfone** (reconhecimento de voz do navegador, `pt-BR`: **segurar** = push-to-talk, **tocar** = liga/desliga). Enquanto grava, a esfera fica em `listening` e mostra a transcrição ao vivo como legenda.

Fluxo: texto do usuário → estado `thinking` → transporte → resposta `{text, expr}` → o rosto faz a expressão e fala o texto (TTS pt-BR + legenda) → volta para `idle`.
Erros e timeout (60 s) aparecem em pt-BR na legenda e no histórico, com rosto `sad`.
Sem transporte configurado, a barra mostra **"conversa ainda não conectada"** e o envio fica desabilitado. Se o navegador não tem reconhecimento de voz (ex.: WebView do Telegram no iOS), o microfone some e fica só o texto.
No Telegram, a barra respeita a safe area e o `chat_id` vem de `Telegram.WebApp.initDataUnsafe.user.id` (quando existir).
A barra fica escondida em `?demo=1` e `?showcase=1` (force com `&chat=1`). `?chat=0` esconde sempre.

### `sid` de cada mensagem
Cada mensagem tem um **`sid` novo**: `<sid base>-<contador>-<4 chars aleatórios>`, ex.: `kaue-3-x7q2`. O `sid base` é o `?sid=` (se vier), senão um id aleatório por abertura da página. **O bot deve devolver exatamente o mesmo `sid` que recebeu.**

### Configuração (URL/hash; nenhum segredo fica no código)
| Parâmetro | Valor |
|---|---|
| `transport` | `http` ou `ntfy` |
| `base` | (http) URL base do bot, sem barra final. Ex.: `https://meu-bot.exemplo.com/open` |
| `topic` | (ntfy) tópico **secreto e aleatório**, ex.: 24+ caracteres |
| `server` | (ntfy) opcional, padrão `https://ntfy.sh` |
| `sid` | opcional, base dos `sid` |

Ex.: `index.html?transport=ntfy&topic=k8Qe...&sid=kaue` ou `index.html?transport=http&base=https%3A%2F%2Fmeu-bot.exemplo.com%2Fopen`.

### Contrato (a): `transport=http`
1. **Pergunta**: `POST {base}/ask`, `Content-Type: application/json`
   ```json
   {"sid":"kaue-3-x7q2","text":"qual a previsão de hoje?","chat_id":12345,"init_data":"query_id=...&user=...&hash=..."}
   ```
   `chat_id` e `init_data` só vão quando existem (dentro do Telegram). `init_data` é o `Telegram.WebApp.initData` cru: **valide o hash com o token do bot** antes de confiar no `chat_id`.
   Resposta esperada: **`202`** (qualquer 2xx serve). Corpo é ignorado.
2. **Resposta**: a página faz `GET {base}/answer?sid=kaue-3-x7q2` **a cada 1,5 s** até 60 s:
   ```json
   {"status":"pending"}
   {"status":"done","text":"Hoje faz 24° e sol em São Paulo.","expr":"happy"}
   {"status":"error","text":"Mensagem de erro opcional em pt-BR"}
   ```
   `404` também conta como `pending`. `expr` é opcional (`neutral`, `happy`, `angry`, `sad`, `surprised`, `suspicious`, `wink`; padrão `neutral`).
3. **CORS** obrigatório (a página está em outro domínio): responder `OPTIONS` com `Access-Control-Allow-Origin: *` (ou o domínio do Pages), `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, e mandar `Access-Control-Allow-Origin` também no POST e no GET. Precisa ser **HTTPS** (o Pages é HTTPS).

### Relay oficial: `open-relay` (Cloudflare Worker)
Implementa o **contrato (a) http** no meio do caminho entre a página e o bot: **`https://open-relay.kauezin.workers.dev`**

**Link da Mini App** (parâmetros no `?`, não no `#`, por causa do hash do Telegram):
```
https://kauebbrolivera-maker.github.io/caps/open/?transport=http&base=https%3A%2F%2Fopen-relay.kauezin.workers.dev&sid=<sid>
```
(dá para juntar `&show=face&expr=happy`, `&text=...` etc.)

Endpoints:
| Quem | Método e rota | Corpo / resposta |
|---|---|---|
| página (público, CORS só para `https://kauebbrolivera-maker.github.io`) | `POST /ask` | `{sid, text, chat_id?, init_data?}` → `202 {ok:true, sid}`. `400` validação (`sid` 1–80 chars `[A-Za-z0-9_.:-]`, `text` ≤ 2000), `409` sid repetido, `429` mais de 30 asks/min por IP (IPv6 por /64) |
| página (público) | `GET /answer?sid=` | `{status:'pending'}` / `{status:'done', text, expr}` / `{status:'error', text}`, ou `404 {status:'unknown'}` |
| bot (header `X-Open-Key`) | `GET /pending` | `{asks:[{sid, chat_id, text, init_data?, created, redelivery}]}`. Sem a chave ou chave errada → `401` |
| bot (header `X-Open-Key`) | `POST /answer` | `{sid, text, expr}` ou `{sid, status:'error', text}` → `200 {ok:true}`. `404` sid desconhecido/expirado, `409` já respondido |

- **Entrega com "lease" de 60 s:** cada ask pendente é devolvido por `/pending` uma vez e fica "tomado" por 60 s. Se o bot não responder nesse prazo, ele volta no próximo `/pending` com `redelivery:true` (sobrevive a um crash do bot). Depois de respondido, nunca mais aparece. O bot deve fazer polling de `/pending` a cada ~1–2 s.
- **Expiração:** tudo some 10 min depois do ask.
- **Chave:** o `X-Open-Key` é um segredo do Worker (`OPEN_RELAY_KEY`). Não fica neste repositório nem na página.
- **`init_data`:** chega cru. O bot deve validar o hash com o token do bot antes de confiar no `chat_id`.

### Contrato (b): `transport=ntfy`
1. **Pergunta**: a página faz `POST {server}/{topic}-ask` com o corpo **texto puro** contendo o JSON:
   ```json
   {"sid":"kaue-3-x7q2","text":"qual a previsão de hoje?","chat_id":12345}
   ```
   O bot assina esse tópico (ex.: `GET {server}/{topic}-ask/json`, stream de uma linha JSON por evento). Em cada evento com `"event":"message"`, o campo **`message`** é a **string** do JSON acima, então faça `JSON.parse(evento.message)`.
2. **Resposta**: o bot publica `POST {server}/{topic}-ans` com o corpo (texto puro) igual a:
   ```json
   {"sid":"kaue-3-x7q2","text":"Hoje faz 24° e sol.","expr":"happy"}
   ```
   (erro: `{"sid":"...","status":"error","text":"..."}`). **Não** publique na URL raiz do servidor nem use o formato "publish as JSON" do ntfy: o JSON tem que ir como **corpo** do POST no tópico.
3. A página escuta `EventSource {server}/{topic}-ans/sse`. O ntfy entrega cada mensagem como `data: {"id":..,"time":..,"event":"message","topic":"...-ans","message":"<seu JSON como string>"}`. A página filtra `event==="message"`, faz `JSON.parse(message)` e casa pelo `sid`. Eventos `open`/`keepalive` são ignorados.
4. Limite: corpos acima de ~4 KB viram anexo no ntfy. A página tenta baixar o anexo e ler o JSON, mas mantenha a resposta curta.

### Transporte próprio (JS)
`Open.setTransport(async ({sid, text, chat_id}) => ({text, expr}))` troca o transporte. `openAsk(text)` / `postMessage({type:'ask', text})` enviam uma pergunta. Eventos: `open:ask` (detail = mensagem) e `open:answer`.

## Detalhes
- **Relógio:** 24 h ao vivo (atualiza na virada do minuto), com data em pt-BR embaixo ("segunda, 19 de outubro").
- **Clima:** usa `?lat=&lon=` / opções, senão geolocalização do navegador (timeout de 5 s), senão São Paulo (-23.55, -46.63). Mostra temperatura "24°", ícone (sol, lua à noite, nuvem, chuva, raio) e condição em pt-BR. Cache de 10 min (localStorage). Sem rede, aparece "--° sem conexão".
- **Notícia:** painel dourado com borda fina, scanlines, leve inclinação 3D e flicker na entrada. Some após `ms` (padrão 9000, `0` = fica). A esfera vira um redemoinho atrás.
- **Logo:** "THE / KAUEZIN" com um brilho que varre o texto.
- **Timer:** pulsa nos últimos 10 s e explode no zero (dispara `open:timer`).
- **Toque:** um toque gera onda/estouro no ponto tocado; arrastar gira a cena (volta sozinho depois).

## Rosto e expressões
`neutral`, `happy`, `angry`, `sad`, `surprised`, `suspicious`, `wink`, com transições suaves, piscar automático a cada 3–6 s, olhar passeando e lip-sync durante a fala, em qualquer expressão.
**Uma expressão por resposta:** o bot pode escolher a expressão de cada resposta (ex.: pelo sentimento do texto):
`index.html?show=face&expr=happy&sid=abc#text=Claro%2C%20posso%20ajudar!` ou `postMessage({type:'speak', text, audio, expr})`.

## Abrir pelo bot
`?text=` / `#text=` é a resposta. Sem `audio`, ela é falada com `speechSynthesis` (pt-BR, com voz pt-BR quando houver) e a reação é simulada pelos eventos `onstart/onboundary/onend`. Com `audio=<mp3 público>`, toca o áudio e a esfera reage via `AnalyserNode`. `sid` fica em `openParams.sid`.
**Toque obrigatório:** navegadores mobile e a WebView do Telegram bloqueiam som sem gesto, então aparece o botão **TOCAR**.

## Telegram
Carrega `telegram-web-app.js` (async), chama `ready()` e `expand()` e pinta header/fundo/bottom bar de preto (checando versão). Fora do Telegram, ignora.

## Limitações
- **ntfy.sh é público:** quem souber o tópico lê as perguntas e pode injetar respostas. Use um tópico longo e aleatório, ou um servidor ntfy próprio com autenticação. Há limite diário de mensagens por IP no ntfy.sh (veja os limites atuais).
- **Telegram e o hash:** o Telegram coloca os próprios dados no hash da URL (`#tgWebAppData=...`) e alguns clientes podem sobrescrever um hash seu. Dentro do Telegram, prefira **query** (`?transport=...&topic=...`). Isso também vale para `#text=`.
- O reconhecimento de voz depende do navegador (Chrome/Android usa o serviço do Google, online). WebViews sem suporte escondem o microfone.
- No modo http, o polling consome uma requisição a cada 1,5 s enquanto espera.
- O mp3 precisa de CORS (`Access-Control-Allow-Origin`) para o analisador. Sem isso toca normalmente, mas a reação é simulada.
- O TTS não passa pelo analisador (reação simulada). Voz pt-BR depende do aparelho.
- Geolocalização na WebView do Telegram pode pedir permissão ou falhar (cai em São Paulo). Prefira mandar `lat/lon` pelo bot.
- Textos de partículas ficam legíveis até ~12 caracteres por linha. A data/condição usa letra menor e fica mais "pontilhada".
- Não há checagem de origem no postMessage.

