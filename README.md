# Cronômetro CMP

Cronômetro institucional sincronizado em tempo real para uso em sessões da Câmara Municipal de Parnamirim/RN.

## Recursos

- Painel separado do controle.
- WebSocket em tempo real.
- Servidor como fonte central do tempo.
- Cálculo baseado em timestamps.
- Reconexão automática.
- Recuperação do estado após atualizar a página.
- Tela cheia no painel.
- Docker e Docker Compose.
- Interface responsiva.

## Estrutura

```text
cronometro-cmp/
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── timer-state.json
└── public/
    ├── painel.html
    ├── controle.html
    ├── painel.js
    ├── controle.js
    ├── style.css
    └── logo.png
```

## Executar com Node.js

Requisitos: Node.js 18+.

```bash
npm install
npm start
```

O servidor ficará disponível na porta 3000.

Painel:

```text
http://IP-DO-SERVIDOR:3000/painel.html
```

Controle:

```text
http://IP-DO-SERVIDOR:3000/controle.html
```

## Executar com Docker Compose

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Parar:

```bash
docker compose down
```

## Descobrir o IP no Linux

```bash
hostname -I
```

Exemplo:

```text
192.168.1.100
```

Nesse caso:

```text
http://192.168.1.100:3000/painel.html
http://192.168.1.100:3000/controle.html
```

## Arquitetura

O controle envia comandos ao servidor por WebSocket.

O servidor mantém:

- estado;
- duração;
- tempo restante;
- horário de início;
- horário final.

O painel recebe o estado do servidor e exibe o cronômetro.

A contagem não depende de um `setInterval()` do navegador. O navegador utiliza o timestamp fornecido pelo servidor para determinar o tempo restante na apresentação visual.

## Estados

- `idle`: aguardando
- `running`: em andamento
- `paused`: pausado
- `stopped`: parado
- `finished`: finalizado


## Correção da persistência e comunicação WebSocket

A versão 1.0.2 corrige também a persistência do estado no Docker. O arquivo `timer-state.json` é montado como bind mount e, por isso, o servidor não usa `renameSync()` para substituí-lo. Isso evita o erro genérico “Não foi possível processar o comando” ao iniciar, pausar, parar, zerar ou definir o tempo.

A versão 1.0.2 também melhora o tratamento das mensagens recebidas pelo WebSocket. O servidor aceita mensagens texto e Buffer/ArrayBuffer, valida o JSON e retorna erros descritivos sem encerrar a conexão.

Após substituir o projeto, recrie a imagem Docker para garantir que o container não continue usando uma versão anterior:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Para verificar a versão em execução, acesse `/api/health`. A resposta deve indicar `version: 1.0.2`.
