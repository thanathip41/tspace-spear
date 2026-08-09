# WebSocket - tspace-spear

## What is WebSocket?

WebSocket provides **real-time, two-way communication** between server and clients. Unlike HTTP (request → response), WebSocket keeps the connection open for instant messaging.

Use cases:
- Chat applications
- Live notifications
- Real-time dashboards
- Collaborative editing
- Live sports/gaming updates

---

## Quick Start

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  .ws(() => {
    return {
      // Client connects
      connection: (ws) => {
        console.log('Client connected');
      },
      
      // Receive message from client
      message: (ws, data) => {
        const message = data.toString();
        ws.send(`Echo: ${message}`);  // Send back
      },
      
      // Client disconnects
      close: (ws, code, reason) => {
        console.log('Client disconnected');
      },
      
      // Error occurred
      error: (ws, error) => {
        console.error('WebSocket error:', error);
      }
    };
  });

app.listen(8000);
```

---

## WebSocket Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `connection` | `(ws)` | Called when client connects |
| `message` | `(ws, data)` | Called when receiving message |
| `close` | `(ws, code, reason)` | Called when client disconnects |
| `error` | `(ws, error)` | Called on error |

---

## Chat Example with User Tracking

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  .ws(() => {
    const clients = new Map<string, any>();  // Track users

    return {
      connection: (ws) => {
        console.log('Client connected');
      },

      message: (ws, data) => {
        const message = JSON.parse(data.toString());

        // Register user with ID
        if (message.type === 'register') {
          ws.userId = message.userId;
          clients.set(message.userId, ws);
          
          ws.send(JSON.stringify({
            type: 'system',
            message: `Registered as ${message.userId}`
          }));
          return;
        }

        // Send chat message to specific user
        if (message.type === 'chat') {
          const targetUser = clients.get(message.to);
          
          if (!targetUser) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'User not online'
            }));
            return;
          }

          // Send to target user
          targetUser.send(JSON.stringify({
            type: 'chat',
            from: ws.userId,
            text: message.text
          }));
          return;
        }
      },

      close: (ws) => {
        if (ws.userId) {
          clients.delete(ws.userId);
        }
        console.log('Client disconnected');
      },

      error: (ws, error) => {
        console.error('WebSocket error:', error);
      }
    };
  });

app.listen(8000);
```

---

## Broadcast to All Clients

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  .ws(() => {
    const clients = new Set();

    return {
      connection: (ws) => {
        clients.add(ws);
        broadcast('System: New user joined', clients);
      },

      message: (ws, data) => {
        const message = data.toString();
        broadcast(`User: ${message}`, clients);
      },

      close: (ws) => {
        clients.delete(ws);
        broadcast('System: User left', clients);
      }
    };
  });

// Helper function to send to all clients
function broadcast(message: string, clients: Set<any>) {
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN state
      client.send(message);
    }
  }
}

app.listen(8000);
```

---

## Broadcast from HTTP Endpoint

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  // HTTP endpoint to trigger broadcast
  .post('/broadcast', ({ body, res }) => {
    broadcastMessage(body.message);
    return res.json({ sent: true });
  })
  .ws(() => {
    const clients = new Set();

    return {
      connection: (ws) => {
        clients.add(ws);
      },
      message: (ws, data) => {
        ws.send(data);  // Echo
      },
      close: (ws) => {
        clients.delete(ws);
      }
    };
  });

// Global broadcast function
let broadcastMessage: (msg: string) => void;

app.listen(8000, ({ server }) => {
  // Access WebSocket server after startup
  const wss = (server as any).wss;
  
  broadcastMessage = (msg: string) => {
    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'broadcast',
          message: msg
        }));
      }
    });
  };
});
```

---

## Chat Rooms

```typescript
import Spear from "tspace-spear";

type Room = Map<string, any>;
const rooms = new Map<string, Room>();

const app = new Spear()
  .ws(() => {
    return {
      connection: (ws) => {
        console.log('Client connected');
      },

      message: (ws, data) => {
        const message = JSON.parse(data.toString());

        // Join a room
        if (message.type === 'join') {
          const roomId = message.roomId;
          
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          
          const room = rooms.get(roomId)!;
          ws.roomId = roomId;
          room.set(ws.userId || ws._id, ws);
          
          ws.send(JSON.stringify({
            type: 'joined',
            roomId: roomId
          }));
          return;
        }

        // Send message to room
        if (message.type === 'room-message') {
          const room = rooms.get(ws.roomId);
          if (room) {
            room.forEach((client) => {
              if (client !== ws) {
                client.send(JSON.stringify({
                  type: 'room-message',
                  from: ws.userId,
                  text: message.text
                }));
              }
            });
          }
          return;
        }

        // Leave room
        if (message.type === 'leave') {
          const room = rooms.get(ws.roomId);
          if (room) {
            room.delete(ws.userId || ws._id);
          }
          ws.roomId = null;
          return;
        }
      },

      close: (ws) => {
        // Remove from all rooms
        rooms.forEach((room) => {
          room.delete(ws.userId || ws._id);
        });
      }
    };
  });

app.listen(8000);
```

---

## WebSocket with Authentication

```typescript
import Spear, { type T } from "tspace-spear";

const app = new Spear()
  // Middleware to add user from token
  .use((ctx, next) => {
    if (ctx.req.url?.includes('/ws')) {
      const token = new URLSearchParams(ctx.req.url.split('?')[1]).get('token');
      if (token) {
        // Verify token (pseudo-code)
        ctx.user = { id: 1, name: 'John' };
      }
    }
    return next();
  })
  .ws(() => {
    const users = new Map();

    return {
      connection: (ws, req) => {
        // Get user from request
        const user = (req as any).user;
        if (user) {
          ws.user = user;
          users.set(user.id, ws);
          console.log(`User ${user.name} connected`);
        }
      },

      message: (ws, data) => {
        const message = JSON.parse(data.toString());
        
        // Send to specific user
        if (message.to) {
          const targetUser = users.get(message.to);
          if (targetUser) {
            targetUser.send(JSON.stringify({
              from: ws.user.name,
              text: message.text
            }));
          }
        }
      },

      close: (ws) => {
        if (ws.user) {
          users.delete(ws.user.id);
        }
      }
    };
  });

app.listen(8000);
```

---

## With uWebSockets.js Adapter

```typescript
import Spear from "tspace-spear";
import uWS from "uWebSockets.js";

const app = new Spear({ adapter: uWS })
  .ws(() => {
    return {
      connection: (ws) => {
        console.log('Client connected (uWS)');
      },

      message: (ws, message, isBinary) => {
        const data = Buffer.from(message).toString();
        ws.send(`Echo: ${data}`);
      },

      close: (ws, code, message) => {
        console.log('Client disconnected (uWS)');
      }
    };
  });

app.listen(8000);
```

---

## Complete Chat Room with HTML Client

### Server

```typescript
import Spear from "tspace-spear";

const app = new Spear()
  // Serve HTML chat page
  .get('/chat', (ctx) => {
    return ctx.res.html(`
      <!DOCTYPE html>
      <html>
      <head><title>Chat Room</title></head>
      <body>
        <h1>Chat Room</h1>
        <div id="messages"></div>
        <input id="message" placeholder="Type message..." />
        <button onclick="send()">Send</button>
        <script>
          const ws = new WebSocket('ws://localhost:8000');
          const messages = document.getElementById('messages');
          
          ws.onmessage = (e) => {
            const msg = document.createElement('div');
            msg.textContent = e.data;
            messages.appendChild(msg);
          };
          
          function send() {
            const input = document.getElementById('message');
            ws.send(input.value);
            input.value = '';
          }
        </script>
      </body>
      </html>
    `);
  })
  .ws(() => {
    const clients = new Set();

    return {
      connection: (ws) => {
        clients.add(ws);
        broadcast('System: New user joined', clients);
      },
      message: (ws, data) => {
        broadcast(`User: ${data.toString()}`, clients);
      },
      close: (ws) => {
        clients.delete(ws);
        broadcast('System: User left', clients);
      }
    };
  });

function broadcast(message: string, clients: Set<any>) {
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

app.listen(8000);
```

---

## WebSocket Client (Browser)

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Client</title>
</head>
<body>
  <h1>WebSocket Chat</h1>
  <div id="status">Disconnected</div>
  <div id="messages"></div>
  <input id="message" placeholder="Type message..." />
  <button onclick="send()">Send</button>

  <script>
    const ws = new WebSocket('ws://localhost:8000');
    const status = document.getElementById('status');
    const messages = document.getElementById('messages');
    const input = document.getElementById('message');

    // Connection opened
    ws.onopen = () => {
      status.textContent = 'Connected';
      status.style.color = 'green';
    };

    // Connection closed
    ws.onclose = () => {
      status.textContent = 'Disconnected';
      status.style.color = 'red';
    };

    // Receive message
    ws.onmessage = (e) => {
      const msg = document.createElement('div');
      msg.textContent = e.data;
      messages.appendChild(msg);
    };

    // Error
    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
    };

    // Send message
    function send() {
      ws.send(input.value);
      input.value = '';
    }

    // Send on Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') send();
    });
  </script>
</body>
</html>
```

---

## Use with ApiClient (HTTP + WS)

```typescript
import { ApiClient } from "tspace-spear/client";

// HTTP client for REST API
const http = new ApiClient('http://localhost:8000');

// WebSocket for real-time
const ws = new WebSocket('ws://localhost:8000');

// Send message via WebSocket
ws.send(JSON.stringify({
  type: 'chat',
  to: 'user123',
  text: 'Hello!'
}));

// Receive messages
ws.onmessage = (e) => {
  const message = JSON.parse(e.data);
  console.log('Received:', message);
};

// Use HTTP for auth, WebSocket for chat
async function loginAndChat() {
  // Login via HTTP
  const res = await http.post('/login', {
    body: { email: 'test@example.com', password: 'secret' }
  });
  
  if (res.ok) {
    const token = res.data.token;
    // Connect WebSocket with token
    const ws = new WebSocket(`ws://localhost:8000?token=${token}`);
  }
}
```

---

## WebSocket Properties Reference

| Property | Description |
|----------|-------------|
| `ws.send(data)` | Send message to client |
| `ws.userId` | Custom property (you define) |
| `ws.user` | Custom property (you define) |
| `ws.roomId` | Custom property (you define) |
| `ws.readyState` | Connection state (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED) |

---

## Common Patterns

### Store Client Data

```typescript
.ws(() => ({
  connection: (ws) => {
    ws.userId = 'abc123';  // Store any data
    ws.rooms = [];         // Store arrays
  }
}))
```

### Send JSON Messages

```typescript
message: (ws, data) => {
  const msg = JSON.parse(data.toString());
  ws.send(JSON.stringify({
    type: 'response',
    data: msg
  }));
}
```

### Handle Binary Data

```typescript
message: (ws, data, isBinary) => {
  if (isBinary) {
    // Handle binary data
    const buffer = data as ArrayBuffer;
  } else {
    // Handle text
    const text = data.toString();
  }
}
```

---

## Quick Reference

```typescript
app.ws(() => ({
  connection: (ws) => { /* connected */ },
  message: (ws, data) => { /* received */ },
  close: (ws, code, reason) => { /* disconnected */ },
  error: (ws, error) => { /* error */ }
}));
```

---

## Common Mistakes

### ❌ Wrong: Not parsing JSON

```typescript
message: (ws, data) => {
  ws.send(data);  // Sending raw data
}
```

### ✅ Correct: Parse and stringify

```typescript
message: (ws, data) => {
  const msg = JSON.parse(data.toString());
  ws.send(JSON.stringify({ response: msg }));
}
```

### ❌ Wrong: Not checking connection state

```typescript
broadcast: (msg) => {
  clients.forEach(c => c.send(msg));  // May fail if closed
}
```

### ✅ Correct: Check readyState

```typescript
broadcast: (msg) => {
  clients.forEach(c => {
    if (c.readyState === 1) {  // OPEN
      c.send(msg);
    }
  });
}
```

### ❌ Wrong: Not cleaning up on disconnect

```typescript
close: (ws) => {
  // Forgot to remove from clients map
}
```

### ✅ Correct: Clean up

```typescript
close: (ws) => {
  if (ws.userId) {
    clients.delete(ws.userId);  // Remove from tracking
  }
}