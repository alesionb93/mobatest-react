# Agente local do Maestro — Veiser Test

Esse agente é o que faz o botão **"Executar automatizado"**, dentro de uma
execução no Veiser Test, rodar de verdade um teste do Maestro na sua máquina.
Ele roda separado do site — não é hospedado, não vai pra Vercel, fica só no
seu computador.

## Por que isso existe

O navegador não tem permissão de rodar comandos no seu computador (trava de
segurança de qualquer navegador). Esse agente é um programinha Node que roda
fora do navegador, então não tem essa trava — ele escuta numa porta local
(`http://127.0.0.1:4545`) que o Veiser Test consegue chamar.

## Como configurar (só uma vez)

1. Copie `config.example.json` para `config.json`
2. Edite o `"baseFolder"` com o caminho raiz dos seus `.yaml` do Maestro
3. Precisa ter o [Node.js](https://nodejs.org) e o [Maestro CLI](https://maestro.mobile.dev) já instalados e funcionando no terminal (`maestro --version` deve responder)

## Como usar (toda vez que for testar)

**Opção rápida:** dê duplo clique em `start-agent.bat`. Ele já entra na pasta certa e roda o agente — não precisa abrir terminal nem digitar nada.

**Opção manual:**
1. Abra um terminal nesta pasta (`maestro-agent/`)
2. Rode: `node agent.js`
3. Deixe a janela aberta e use o botão "Executar automatizado" no Veiser Test

Se aparecer a mensagem "Não consegui conectar ao executor local" no Veiser Test,
é porque essa janela do terminal não está aberta/rodando.

## Iniciar sozinho ao ligar o computador (opcional)

Se quiser que o agente já esteja rodando assim que você fizer login no Windows,
sem precisar lembrar de abrir nada:

1. Pressione `Win + R`, digite `shell:startup` e aperte Enter (abre a pasta de
   inicialização do Windows).
2. Copie um atalho de um dos dois arquivos abaixo pra essa pasta:
   - `start-agent.bat` → abre uma janela de terminal visível com os logs do
     agente (mais fácil de acompanhar se algo der errado).
   - `start-agent-hidden.vbs` → roda em segundo plano, sem abrir nenhuma
     janela (mais discreto, mas você não vê os logs se algo falhar).

A partir daí, todo login já deixa o agente pronto — só usar o Veiser Test normalmente.

## Escolher o teste de uma lista (em vez de digitar o caminho)

O agente expõe uma rota (`/list-scripts`) que lê os arquivos `.yaml` de
verdade na sua pasta e devolve a lista pro Veiser Test. Com o agente rodando,
o campo "Script Maestro" no caso de teste já vira uma busca — digite o nome
e escolha, sem precisar saber o caminho de cor. Se preferir, ainda dá pra
digitar manualmente clicando em "Digitar manualmente".

Por padrão ele procura dentro de uma subpasta chamada `flows` (se existir).
Pra mudar isso, adicione `"scriptsRoot": "outra-pasta"` no seu `config.json`.

## Espelho do dispositivo (scrcpy) já posicionado

Se você usa o [scrcpy](https://github.com/Genymobile/scrcpy) pra ver a tela
do celular enquanto testa, o botão **"Abrir espelho do dispositivo"** (ao
lado de "Executar automatizado", e também dentro do modal de execução em
lote) já abre a janela dele **posicionada do lado do navegador**, sem
precisar arrastar na mão.

**Pré-requisitos:**
- Ter o `scrcpy` instalado e no PATH (`scrcpy --version` precisa funcionar
  no terminal). Se preferir, aponte o caminho completo em
  `"scrcpy": { "path": "C:\\caminho\\scrcpy.exe" }` no `config.json`.
- Dispositivo já conectado (`adb devices` mostrando ele).

**Posição da janela:** por padrão, o agente detecta automaticamente onde
está a janela do navegador (a que você clicou o botão) e abre o scrcpy
logo do lado dela — funciona mesmo com vários monitores, sem precisar
calibrar números manualmente. Isso só funciona no Windows.

Se quiser desligar essa detecção automática e usar sempre uma posição fixa,
coloque `"autoPosition": false` no bloco `"scrcpy"` do seu `config.json` —
aí sim `windowX`/`windowY` (posição) e `windowWidth`/`windowHeight`
(tamanho) valem como estão. Com a detecção automática ligada, apenas o
tamanho (`windowWidth`/`windowHeight`) e o espaçamento (`gap`, em pixels)
são usados.

**Ajustar a posição/tamanho da janela:** edite o bloco `"scrcpy"` no seu
`config.json` — `windowX`/`windowY` é a posição na tela (em pixels, a
partir do canto superior esquerdo do seu monitor) e `windowWidth`/
`windowHeight` é o tamanho. Os valores padrão assumem uma tela larga com o
navegador ocupando a esquerda — ajuste conforme sua resolução e onde a
janela do navegador fica.

## Teste demorando demais / travando

Por padrão, o agente espera até **10 minutos** por teste antes de desistir e
interromper à força. Se algum dos seus fluxos costuma levar mais que isso
(ou se quiser um limite mais curto), ajuste `"timeoutMs"` no seu
`config.json` (em milissegundos — ex: `900000` para 15 minutos).

Quando um teste é interrompido por estourar esse limite, o Veiser Test mostra
um aviso específico no lugar do log (em vez de aparecer em branco) — é sinal
de que o app travou numa tela, ficou esperando algo que nunca apareceu, ou o
dispositivo desconectou no meio do teste.

## Publicou o Veiser Test fora do localhost?

Edite o `"allowedOrigin"` no `config.json` pra URL real do site (ex:
`https://mobatest-react.vercel.app`), senão o navegador bloqueia a chamada por
CORS.
