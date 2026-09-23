const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalBlock } = require('mineflayer-pathfinder').goals;
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Bot State Object
let botState = {
  connected: false,
  coords: { x: 0, y: 0, z: 0 },
  uptimeStart: null,
  reconnectAttempts: 0
};

let bot = null;
let isReconnecting = false;

// Config Details
const config = {
  server: {
    host: 'brill.aternos.host',
    port: 25565, // আপনার সার্ভার পোর্ট থাকলে তা দিন
    username: 'Korols_Daroan',
    version: false // অটো-ডিটেক্ট করতে false রাখুন অথবা নির্দিষ্ট ভার্সন দিন
  }
};

function createBot() {
  if (isReconnecting) return;
  isReconnecting = true;

  console.log('[Bot] Connecting to Minecraft server...');

  bot = mineflayer.createBot({
    host: config.server.host,
    port: config.server.port,
    username: config.server.username,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);

  // Connection success
  bot.on('spawn', () => {
    botState.connected = true;
    botState.reconnectAttempts = 0;
    if (!botState.uptimeStart) {
      botState.uptimeStart = Date.now();
    }
    isReconnecting = false;

    console.log(`[Bot] [+] Successfully spawned on server as ${bot.username}`);

    // Broadcast status to web dashboard
    broadcastStatus();
  });

  // Track coordinates movement
  bot.on('move', () => {
    if (bot.entity) {
      botState.coords = {
        x: Math.round(bot.entity.position.x),
        y: Math.round(bot.entity.position.y),
        z: Math.round(bot.entity.position.z)
      };
      broadcastStatus();
    }
  });

  // Handle Disconnect
  bot.on('end', (reason) => {
    botState.connected = false;
    console.log(`[Bot] [-] Disconnected. Reason: ${reason}`);
    broadcastStatus();

    // Auto reconnect logic
    setTimeout(() => {
      isReconnecting = false;
      botState.reconnectAttempts++;
      createBot();
    }, 5000);
  });

  // Handle Errors
  bot.on('error', (err) => {
    console.error('[Bot] Error:', err.message);
  });
}

// Helper function to send data via Socket.IO
function broadcastStatus() {
  const uptime = botState.uptimeStart
    ? Math.floor((Date.now() - botState.uptimeStart) / 1000)
    : 0;

  io.emit('bot_status', {
    connected: botState.connected,
    coords: botState.coords,
    uptime: uptime,
    server: config.server.host
  });
}

// Serve Static Files for Dashboard
app.use(express.static('public'));

// Socket.IO Connection for Web Dashboard
io.on('connection', (socket) => {
  console.log('[Web] Dashboard client connected');
  broadcastStatus(); // Send immediate status on client connect
});

// Start Web Server & Bot
server.listen(PORT, () => {
  console.log(`[Web Server] Running on port ${PORT}`);
  createBot();
});
