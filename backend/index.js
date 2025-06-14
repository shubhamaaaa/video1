import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });
const clients = {};

wss.on('connection', function connection(ws) {
  ws.on('message', function message(data) {
    const msg = JSON.parse(data);
    const { type, payload, to } = msg;

    // Save client reference
    if (type === 'register') {
      clients[payload.userId] = ws;
    }

    // Forward signal
    if (to && clients[to]) {
      clients[to].send(JSON.stringify({ type, payload }));
    }
  });
});

console.log("WebSocket signaling server running on ws://localhost:3001");