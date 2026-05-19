import WebSocket, { WebSocketServer } from 'ws';
import { wsArcjet } from '../arcjet.js';

const matchSubscribers = new Map();

const MAX_SUBSCRIPTIONS_PER_SOCKET = 200;

function isValidMatchId(matchId) {
  return Number.isInteger(matchId) && matchId > 0;
}

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    sendJson(client, payload);
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleMessage(socket, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch {
    sendJson(socket, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  if (message?.type === "subscribe") {
        const { matchId } = message;
        if (!isValidMatchId(matchId)) {
          sendJson(socket, { type: 'error', message: 'Invalid matchId' });
          return;
        }
        if (!socket.subscriptions.has(matchId) && socket.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_SOCKET) {
          sendJson(socket, { type: 'error', message: 'Subscription limit reached' });
          return;
        }
        subscribe(matchId, socket);
       socket.subscriptions.add(matchId);
        sendJson(socket, { type: 'subscribed', matchId });
    return;
  }

  if (message?.type === "unsubscribe") {
        const { matchId } = message;
        if (!isValidMatchId(matchId)) {
          sendJson(socket, { type: 'error', message: 'Invalid matchId' });
          return;
        }
        unsubscribe(matchId, socket);
        socket.subscriptions.delete(matchId);
      sendJson(socket, { type: 'unsubscribed', matchId });
    return;
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 1024,
  });

  wss.on('connection', async (socket, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? 'Rate limit exceeded'
            : 'Access denied';

          socket.close(code, reason);
          return;
        }
      } catch (e) {
        console.error('Ws connection error', e);
        socket.close(1011, 'Server security error');
        return;
      }
    }

    console.log('Client connected');

    socket.subscriptions = new Set();

    sendJson(socket, { type: 'welcome' });

    socket.on('message', (data) => {
      handleMessage(socket, data);
    });

    socket.on('error', () => {
      socket.terminate();
    });

    socket.on('close', () => {
      cleanupSubscriptions(socket);
    });
  });

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, {
      type: 'match_created',
      data: match,
    });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: 'commentary', data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
