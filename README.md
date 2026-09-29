# ⏱️ Cronômetro CMP

Cronômetro institucional sincronizado em tempo real para uso em sessões da **Câmara Municipal de Parnamirim/RN**.

O sistema possui uma tela de **controle** para operação do cronômetro e uma tela de **painel público**, que pode ser exibida em TV, telão ou outro computador da rede.

## 📌 Versão atual

**1.0.6**

## ✨ Recursos

- Controle do cronômetro em uma página separada do painel público.
- Sincronização em tempo real por WebSocket.
- Servidor como fonte central do tempo.
- Contagem baseada em timestamps, reduzindo a dependência do relógio do navegador.
- Atualização automática do painel quando o estado do cronômetro muda.
- Reconexão automática do WebSocket.
- Recuperação do estado após atualizar a página.
- Tela de controle responsiva.
- Painel público próprio para exibição em TV/telão.
- Possibilidade de **definir/substituir** o tempo atual.
- O tempo definido é **salvo automaticamente** ao alterar os campos, sem necessidade de clicar em “Aplicar tempo”.
- Possibilidade de **adicionar tempo** ao tempo que já está em andamento, sem reiniciar o cronômetro.
- Estados de aguardando, em andamento, pausado, parado e finalizado.
- Persistência do estado em `timer-state.json`.
- Endpoint `/api/health` para verificar se o servidor está ativo e qual versão está em execução.
- Execução com Node.js ou Docker/Docker Compose.

## ➕ Adicionar tempo

A tela de controle possui a seção **Adicionar tempo**.

É possível informar:

- Horas;
- Minutos;
- Segundos.

Ao clicar em **ADICIONAR TEMPO**, o valor informado é somado ao tempo restante.

### Exemplo

Se o cronômetro estiver em:

```text
00:02:43
```

e for adicionado:

```text
00:01:30
```

o novo tempo será:

```text
00:04:13
```

Quando o cronômetro estiver em andamento, a adição é feita sem pausar ou reiniciar a contagem.

## 🎛️ Operações do controle

### Definir tempo

Substitui o tempo atual pelo valor informado nos campos de horas, minutos e segundos. O salvamento é automático: ao alterar os campos, o novo tempo é enviado ao servidor após uma breve pausa na digitação. Não é necessário clicar em um botão de aplicação.

### Adicionar tempo

Soma horas, minutos e segundos ao tempo restante atual.

### Iniciar

Inicia a contagem do tempo configurado.

### Pausar

Interrompe temporariamente a contagem, preservando o tempo restante.

### Continuar

Retoma a contagem a partir do tempo restante.

### Parar

Interrompe a contagem e mantém o estado parado.

### Zerar

Zera o cronômetro e retorna ao estado inicial.

## 📁 Estrutura do projeto

```text
cronometro-cmp/
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── timer-state.json
├── README.md
└── public/
    ├── painel.html
    ├── controle.html
    ├── painel.js
    ├── controle.js
    ├── style.css
    └── logo.png
```

## 🌐 Endereços

Com o servidor executando na máquina local:

### Painel público

```text
http://localhost:3000/painel.html
```

### Controle

```text
http://localhost:3000/controle.html
```

Em outro computador da mesma rede, substitua `localhost` pelo IP do computador que está executando o servidor.

Exemplo:

```text
http://192.168.1.100:3000/painel.html
http://192.168.1.100:3000/controle.html
```

## ▶️ Executar com Node.js

Requisito: **Node.js 18 ou superior**.

Instale as dependências:

```bash
npm install
```

Inicie o servidor:

```bash
npm start
```

O servidor ficará disponível na porta `3000`.

## 🐳 Executar com Docker Compose

Para criar a imagem e iniciar o sistema:

```bash
docker compose up -d --build
```

Ver os logs:

```bash
docker compose logs -f
```

Parar os containers:

```bash
docker compose down
```

### Recriar completamente a imagem

Quando houver alteração no código e for necessário garantir que o container não esteja usando uma imagem anterior:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🔎 Verificar a versão em execução

A aplicação possui um endpoint de saúde:

```text
http://localhost:3000/api/health
```

Na versão 1.0.4, a resposta esperada é semelhante a:

```json
{
  "ok": true,
  "app": "cronometro-cmp",
  "version": "1.0.4"
}
```

Esse endereço é útil para confirmar se o servidor está realmente executando a versão instalada.

## 🌐 Descobrir o IP no Linux

Execute:

```bash
hostname -I
```

Exemplo:

```text
192.168.1.100
```

Nesse caso, os endereços serão:

```text
http://192.168.1.100:3000/painel.html
http://192.168.1.100:3000/controle.html
```

## 🏗️ Arquitetura

O **controle** envia comandos para o servidor por WebSocket.

O servidor mantém o estado central do cronômetro, incluindo:

- estado atual;
- duração configurada;
- tempo restante;
- horário de início;
- horário final.

O **painel público** recebe as atualizações do servidor e apresenta o tempo ao usuário.

A contagem não depende de um `setInterval()` como fonte de verdade. O servidor utiliza timestamps para determinar o tempo restante, enquanto o navegador é responsável pela atualização visual do contador.

## 🔄 Estados do cronômetro

| Estado | Descrição |
|---|---|
| `idle` | Aguardando configuração ou início |
| `running` | Cronômetro em andamento |
| `paused` | Contagem pausada |
| `stopped` | Cronômetro parado |
| `finished` | Tempo encerrado |

## 💾 Persistência

O estado do cronômetro é armazenado em:

```text
timer-state.json
```

Na execução com Docker, esse arquivo é utilizado como volume para que o estado possa ser preservado fora do filesystem efêmero do container.

A versão 1.0.4 evita a substituição do arquivo por `renameSync()` quando ele está montado como bind mount. Isso corrige problemas de persistência e evita o erro genérico **“Não foi possível processar o comando.”** em operações do cronômetro.

## 🔌 WebSocket

O servidor aceita mensagens WebSocket em formato JSON.

O tratamento das mensagens foi reforçado para aceitar mensagens de texto e dados recebidos como `Buffer`/`ArrayBuffer`, validar o JSON e retornar mensagens de erro mais claras sem encerrar desnecessariamente a conexão.

## 🛠️ Tecnologias

- **Node.js**
- **Express**
- **WebSocket (`ws`)**
- **HTML5**
- **CSS3**
- **JavaScript**
- **Docker**
- **Docker Compose**

## 🏛️ Uso institucional

Projeto desenvolvido para apoiar o controle e a exibição de cronômetros durante sessões e atividades da **Câmara Municipal de Parnamirim/RN**.


## Atualização 1.0.6

- A área **Definir tempo** ganhou maior destaque visual.
- O tempo configurado continua sendo salvo automaticamente.
- Os campos de horas, minutos e segundos não são mais sobrescritos pelo estado recebido do servidor enquanto o operador está digitando.
- A confirmação pode ser feita normalmente com `Enter` ou ao alterar o campo.
