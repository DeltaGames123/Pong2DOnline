const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

const server = new WebSocket.Server({ port: PORT });
console.log("Servidor WebSocket iniciado en puerto 8080");

// --- VARIABLES GLOBALES ---
let players = [];
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
}

// --- NUEVA CONEXIÓN ---
server.on("connection", (ws) => {
    if (players.length >= 2) {
        ws.send(JSON.stringify({ type: "full" }));
        ws.close();
        return;
    }

    const id = next_id++;
    ws.id = id;
    ws.y = HEIGHT / 2;
    players.push(ws);

    console.log(`Jugador ${id} conectado`);

    ws.send(JSON.stringify({ type: "welcome", id: id }));

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);
        if (data.type === "move") {
            ws.y = data.y;
        }
    });

    ws.on("close", () => {
        console.log(`Jugador ${id} desconectado`);
        players = players.filter((p) => p !== ws);
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

        // Colisión con paletas
        for (let i = 0; i < 2; i++) {
            const paddleX = i === 0 ? 40 : WIDTH - 40;
            const paddleY = players[i].y ?? HEIGHT / 2;
            
            if (
                Math.abs(ball.x - paddleX) < 10 &&
                Math.abs(ball.y - paddleY) < 50
            ) {
                ball.vx *= -1;
                // pequeño ajuste de posición para evitar rebote doble
                ball.x += (i === 0 ? 1 : -1) * 5;
            }
        }

        // Reiniciar si sale del campo
        if (ball.x < 0 || ball.x > WIDTH) {
            let target_id = 0;
            // Comprobar a quien añadirle los puntos
            if (ball.x < 0) {
                target_id = 0;
            } else if (ball.x > WIDTH) {
                target_id = 1;
            }

            let vy_random = Number(Math.random());

            switch (vy_random) {
                case 0:
                    vy_random = -1;
                    break;
                case 1:
                    vy_random = 1;
                    break;
            }

            ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 220 * (Math.random() < 0.5 ? 1 : -1), vy: 180 * vy_random };
            broadcast({
                type: "add_score",
                score: 150,
                id: target_id
            });
        }
    }

    // Enviar estado global
    broadcast({
        type: "state",
        ball,
        players: players.map((p) => ({ id: p.id, y: p.y }))
    });
}, 1000 / FPS);