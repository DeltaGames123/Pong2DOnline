const WebSocket = require("ws");
const server = new WebSocket.Server({ port: 8080 });

console.log("Servidor WebSocket iniciando en puerto 8080");

// --- VARIABLES GLOBALES ---
let players = [];
let playersAwaiting = [];
let next_id = 1;

let ball = { x: 320, y: 240, vx: 220, vy: 180 };
const WIDTH = 640;
const HEIGHT = 480;
const FPS = 60;

// --- FUNCIONES AUXILIARES ---
function broadcast(obj) {
    const data = JSON.stringify(obj);
    for (const p of players) {
        p.send(data);
    }
    for (const pa of playersAwaiting) {
        data.type = "handleOtherPos"
        pa.send(data);
    }
}

function checkFullPlayers(id) {
    const players_buffer = players.filter((p) => p.id !== id);
    console.log(`Players: ${players}, ${players_buffer}: players_buffer`);
    if (players_buffer.length < 2) {
        console.log(`La sala no está llena, hay ${players_buffer.length} jugadores activos`);
        return false;
    } else {
        console.log(`La sala está llena, hay ${players_buffer.length} jugadores activos, no puedes entrar`);
        return true;
    }
}

function getNextPlayerAwaiting() {
    let times = [];
    const players_buffer = [];
    playersAwaiting.forEach((pw) => {
        times.push(pw.now);
        players_buffer.push(pw);
    });
    console.log(`Actual tiempo: ${times}`);
    times = times.sort();
    console.log(`Tiempo organizado: ${times}`);
    const time = times[0];
    let player_selected = null;
    players_buffer.forEach((pb) => {
        console.log(`jugador en buffer con now: ${pb.now}`);
        if (pb.now === time) {
            player_selected = pb;
        }
    });
    console.log(`Jugador escogido: ${player_selected}`);
    console.log(`Tiempo escogido: ${time}`);
}

// --- NUEVA CONEXIÓN ---
server.on("connection", (ws) => {

    const id = next_id++;
    ws.id = id;
    ws.y = HEIGHT / 2;
    players.push(ws);

    console.log(`Jugador ${id} conectado`);

    ws.send(JSON.stringify({ type: "welcome", id: id }));

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);
        switch (data.type) {
            case "move": 
                ws.y = data.y,
                ws.ping = data.time 
                ws.send(JSON.stringify({
                type: "update_ping",
                ping: ws.ping })); 
                break;
            case "check_players":
                ws.send(JSON.stringify({
                    type: "check_players_received",
                    full: checkFullPlayers(ws.id)
                }));
                break;
            case "add_playerAwaiting":
                const now = Date.now();
                ws.now = now;
                playersAwaiting.push(ws);
                ws.send(JSON.stringify({
                    type: "add_playerAccepted"
                }));
                break;
            case "next_player":
                getNextPlayerAwaiting();
        }
    });

    ws.on("close", () => {
        console.log(`Jugador ${id} desconectado`);
        players = players.filter((p) => p !== ws);
        // Resetear ID
        if (players.length === 0) {
            next_id++;
        }
    });
});

// --- BUCLE PRINCIPAL ---
setInterval(() => {
    const dt = 1 / FPS;

    if (players.length === 2) {
        // Actualizar bola
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Rebote arriba/abajo
        if (ball.y < 0 || ball.y > HEIGHT) ball.vy *= -1;

        // Colision con paletas
        for (let i = 0; i < 2; i++) {
            const paddleX = i === 0 ? 40 : WIDTH - 40;
            const paddleY = players[i].y ?? HEIGHT / 2;

            if (
                Math.abs(ball.x - paddleX) < 10 &&
                Math.abs(ball.y - paddleY) < 50
            ) {
                ball.vx *= -1;
                // pequeño ajuste de posicion para evitar rebote doble
                ball.x += (i === 0 ? 1 : -1) * 5;
            }
        }

        // reiniciar si sale del campo
        if (ball.x < 0 || ball.x > WIDTH) {
            ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 220 * (Math.random() < 0.5 ? 1 : -1), vy: 180 };
        }
    }

    // Enviar estado global 
    broadcast({
        type: "state",
        ball,
        players: players.map((p) => ({ id: p.id, y: p.y })),
    });
}, 1000 / FPS);