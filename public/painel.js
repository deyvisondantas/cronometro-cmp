let socket = null;
let timerState = null;
let serverOffset = 0;

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const connectionEl = document.getElementById("connection");
const connectionText = document.getElementById("connectionText");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const STATUS_LABELS = {
  idle: "AGUARDANDO",
  running: "EM ANDAMENTO",
  paused: "PAUSADO",
  stopped: "PARADO",
  finished: "FINALIZADO"
};

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":");
}

function getRemaining() {
  if (!timerState) return 0;

  if (timerState.status === "running" && timerState.endAt) {
    const correctedNow = Date.now() + serverOffset;
    return Math.max(0, timerState.endAt - correctedNow);
  }

  return Math.max(0, timerState.remainingMs || 0);
}

function render() {
  if (!timerState) return;

  const remaining = getRemaining();

  timerEl.textContent = formatTime(remaining);
  statusEl.textContent = STATUS_LABELS[timerState.status] || "AGUARDANDO";

  document.body.dataset.status = timerState.status;

  if (timerState.status === "running" && remaining <= 0) {
    timerState.status = "finished";
    timerState.remainingMs = 0;
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.addEventListener("open", () => {
    connectionEl.classList.add("online");
    connectionText.textContent = "CONECTADO";
    socket.send(JSON.stringify({ type: "get_state" }));
  });

  socket.addEventListener("message", (event) => {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("Mensagem não-JSON recebida do servidor:", event.data);
      return;
    }

    if (message.type === "state") {
      const receivedAt = Date.now();
      serverOffset = message.state.serverNow - receivedAt;
      timerState = message.state;
      render();
    }
  });

  socket.addEventListener("close", () => {
    connectionEl.classList.remove("online");
    connectionText.textContent = "DESCONECTADO";
    setTimeout(connect, 1500);
  });

  socket.addEventListener("error", () => {
    connectionEl.classList.remove("online");
    connectionText.textContent = "ERRO DE CONEXÃO";
  });
}

setInterval(render, 100);
connect();

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      fullscreenBtn.textContent = "⛶ SAIR DA TELA CHEIA";
    } else {
      await document.exitFullscreen();
      fullscreenBtn.textContent = "⛶ TELA CHEIA";
    }
  } catch (err) {
    console.error(err);
  }
});

document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.textContent =
    document.fullscreenElement
      ? "⛶ SAIR DA TELA CHEIA"
      : "⛶ TELA CHEIA";
});
