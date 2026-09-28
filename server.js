const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const APP_VERSION = "1.0.2";
const DATA_FILE = path.join(__dirname, "timer-state.json");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

const DEFAULT_STATE = {
  status: "idle",          // idle | running | paused | stopped | finished
  durationMs: 0,
  remainingMs: 0,
  startedAt: null,
  endAt: null,
  updatedAt: Date.now()
};

function loadState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ...DEFAULT_STATE };
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { ...DEFAULT_STATE, ...saved };
  } catch (err) {
    console.error("Erro ao carregar estado:", err);
    return { ...DEFAULT_STATE };
  }
}

let state = loadState();

function saveState() {
  // O timer-state.json é montado pelo Docker Compose como bind mount.
  // Não usamos renameSync() aqui, porque renomear um arquivo temporário
  // sobre um arquivo montado pode falhar dentro do container.
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

function currentRemainingMs() {
  if (state.status !== "running" || !state.endAt) {
    return Math.max(0, state.remainingMs);
  }
  return Math.max(0, state.endAt - Date.now());
}

function normalizeState() {
  const remaining = currentRemainingMs();

  if (state.status === "running" && remaining <= 0) {
    state.status = "finished";
    state.remainingMs = 0;
    state.endAt = null;
    state.updatedAt = Date.now();
    saveState();
  } else if (state.status === "running") {
    state.remainingMs = remaining;
  }
}

function publicState() {
  normalizeState();

  return {
    status: state.status,
    durationMs: state.durationMs,
    remainingMs: currentRemainingMs(),
    startedAt: state.startedAt,
    endAt: state.endAt,
    serverNow: Date.now()
  };
}

function broadcast() {
  const message = JSON.stringify({
    type: "state",
    state: publicState()
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function sendState(ws) {
  ws.send(JSON.stringify({
    type: "state",
    state: publicState()
  }));
}

function setState(newValues) {
  state = {
    ...state,
    ...newValues,
    updatedAt: Date.now()
  };
  saveState();
  broadcast();
}

function setTime(hours, minutes, seconds) {
  const h = Math.max(0, Number(hours) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  const s = Math.max(0, Number(seconds) || 0);

  const durationMs =
    (h * 60 * 60 + m * 60 + s) * 1000;

  setState({
    status: "idle",
    durationMs,
    remainingMs: durationMs,
    startedAt: null,
    endAt: null
  });
}

function startTimer() {
  normalizeState();

  if (state.remainingMs <= 0) return;

  const now = Date.now();

  setState({
    status: "running",
    startedAt: state.startedAt || now,
    endAt: now + state.remainingMs
  });
}

function pauseTimer() {
  normalizeState();

  if (state.status !== "running") return;

  const remaining = currentRemainingMs();

  setState({
    status: remaining > 0 ? "paused" : "finished",
    remainingMs: remaining,
    endAt: null
  });
}

function continueTimer() {
  normalizeState();

  if (state.status !== "paused" || state.remainingMs <= 0) return;

  const now = Date.now();

  setState({
    status: "running",
    endAt: now + state.remainingMs
  });
}

function stopTimer() {
  normalizeState();

  if (state.status === "running") {
    state.remainingMs = currentRemainingMs();
  }

  setState({
    status: "stopped",
    endAt: null
  });
}

function resetTimer() {
  setState({
    status: "idle",
    remainingMs: state.durationMs,
    startedAt: null,
    endAt: null
  });
}

wss.on("connection", (ws) => {
  console.log("Cliente WebSocket conectado.");
  sendState(ws);

  ws.on("message", (raw, isBinary) => {
    // O navegador normalmente envia texto, mas o ws pode entregar
    // Buffer/Uint8Array dependendo do cliente. Em vez de rejeitar a
    // mensagem por ser binária, convertemos para texto e tentamos JSON.
    let text = "";

    try {
      if (typeof raw === "string") {
        text = raw.trim();
      } else if (Buffer.isBuffer(raw)) {
        text = raw.toString("utf8").trim();
      } else if (raw instanceof ArrayBuffer) {
        text = Buffer.from(raw).toString("utf8").trim();
      } else if (ArrayBuffer.isView(raw)) {
        text = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString("utf8").trim();
      } else {
        text = String(raw).trim();
      }
    } catch (err) {
      console.error("Erro ao ler mensagem WebSocket:", err);
      ws.send(JSON.stringify({
        type: "error",
        message: "Não foi possível ler a mensagem recebida."
      }));
      return;
    }

    if (!text) {
      console.warn("Mensagem vazia ignorada.");
      return;
    }

    let message;

    try {
      message = JSON.parse(text);
    } catch (err) {
      console.error("JSON inválido recebido:", JSON.stringify(text));
      ws.send(JSON.stringify({
        type: "error",
        message: "Mensagem inválida: envie um comando em formato JSON."
      }));
      return;
    }

    if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.type !== "string") {
      ws.send(JSON.stringify({
        type: "error",
        message: "Comando inválido: informe o campo 'type'."
      }));
      return;
    }

    try {
      switch (message.type) {
        case "get_state":
          sendState(ws);
          break;

        case "set_time":
          setTime(message.hours, message.minutes, message.seconds);
          break;

        case "start":
          startTimer();
          break;

        case "pause":
          pauseTimer();
          break;

        case "continue":
          continueTimer();
          break;

        case "stop":
          stopTimer();
          break;

        case "reset":
          resetTimer();
          break;

        default:
          ws.send(JSON.stringify({
            type: "error",
            message: `Comando desconhecido: ${message.type}`
          }));
      }
    } catch (err) {
      console.error("Erro ao processar comando:", err);
      ws.send(JSON.stringify({
        type: "error",
        message: "Não foi possível processar o comando.",
        detail: err && err.message ? err.message : String(err)
      }));
    }
  });

  ws.on("close", () => {
    console.log("Cliente WebSocket desconectado.");
  });
});

// Mantém o estado persistido e detecta finalização mesmo sem clientes.
setInterval(() => {
  if (state.status === "running") {
    const remaining = currentRemainingMs();

    if (remaining <= 0) {
      state.status = "finished";
      state.remainingMs = 0;
      state.endAt = null;
      state.updatedAt = Date.now();
      saveState();
      broadcast();
    }
  }
}, 250);

app.get("/", (req, res) => {
  res.redirect("/painel.html");
});

app.get("/api/status", (req, res) => {
  res.json({
    version: APP_VERSION,
    ...publicState()
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "cronometro-cmp", version: APP_VERSION });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Cronômetro CMP v${APP_VERSION} iniciado na porta ${PORT}`);
  console.log(`Painel:   http://IP-DO-SERVIDOR:${PORT}/painel.html`);
  console.log(`Controle: http://IP-DO-SERVIDOR:${PORT}/controle.html`);
});
