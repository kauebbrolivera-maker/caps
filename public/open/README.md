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

Formas: `heart`, `star`, `ring`, `cube` (aramado), `dna`, `galaxy`, `planet` (com anéis), `wave`, `vr` (óculos VR), `bolt`, `infinity`, `skull`. Trocar de forma faz um pequeno "estouro" e as partículas se reorganizam suavemente.
Qualquer `openShow` aceita `ms` para voltar sozinho à esfera depois desse tempo. `openState(...)` (exceto `speaking`) e `openFace` também saem do show. Estando num show, falar não sai dele.
**Obs.:** com `?show=text` ou `?show=news`, o texto vem de `label` / `body` (o `text` só serve de fallback e, nesse caso, **não** é falado).

Leitura: `Open.current` (estado), `Open.shown` (show ativo), `Open.expr`, `Open.levels`, `openParams`.
Eventos no `window`: `open:state`, `open:face`, `open:show`, `open:color`, `open:weather`, `open:tap`, `open:timer` (fim do timer), `open:ended` (fim da fala). Dentro de um iframe, `open:ended` e `open:timer` também vão para o parent via `postMessage`.

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
- O mp3 precisa de CORS (`Access-Control-Allow-Origin`) para o analisador. Sem isso toca normalmente, mas a reação é simulada.
- O TTS não passa pelo analisador (reação simulada). Voz pt-BR depende do aparelho.
- Geolocalização na WebView do Telegram pode pedir permissão ou falhar (cai em São Paulo). Prefira mandar `lat/lon` pelo bot.
- Textos de partículas ficam legíveis até ~12 caracteres por linha. A data/condição usa letra menor e fica mais "pontilhada".
- Não há checagem de origem no postMessage.

