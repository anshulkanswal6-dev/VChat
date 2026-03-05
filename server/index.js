const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// ── Security Headers ──
app.use(helmet());

// ── CORS Configuration ──
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'https://vchat-beige.vercel.app'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || ALLOWED_ORIGINS.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true,
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// ── Input Validation Helpers ──
const MAX_NAME_LENGTH = 30;
const MAX_ROOM_ID_LENGTH = 50;
const MAX_EMOJI_LENGTH = 8;
const MAX_USER_ID_LENGTH = 64;
const MAX_ROOMS = 500;
const MAX_USERS_PER_ROOM = 100;

function sanitizeString(str, maxLen) {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, maxLen).replace(/[<>"'&]/g, '');
}

function isValidRoomId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,50}$/.test(id);
}

// ── Rate Limiting ──
const connectionTracker = new Map(); // ip -> { count, lastReset }
const RATE_LIMIT_WINDOW = 60000;  // 1 minute
const MAX_CONNECTIONS_PER_WINDOW = 15;

function isRateLimited(ip) {
    const now = Date.now();
    const record = connectionTracker.get(ip);

    if (!record || now - record.lastReset > RATE_LIMIT_WINDOW) {
        connectionTracker.set(ip, { count: 1, lastReset: now });
        return false;
    }

    record.count++;
    if (record.count > MAX_CONNECTIONS_PER_WINDOW) {
        return true;
    }
    return false;
}

// Clean up rate limiter periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of connectionTracker.entries()) {
        if (now - record.lastReset > RATE_LIMIT_WINDOW * 2) {
            connectionTracker.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW * 2);

/* 
  rooms: roomId -> { 
    type, hostUserId, hostSocketId,
    users: { socketId: { name, userId, emoji, color } },
    pending: { socketId: { name, userId, emoji } }
  }
*/
const rooms = new Map();

const COLORS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e879f9', '#22d3ee', '#a3e635', '#fb923c',
];

function pickColor(existingUsers) {
    const usedColors = Object.values(existingUsers).map(u => u.color);
    const available = COLORS.filter(c => !usedColors.includes(c));
    if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// ── Socket.IO Rate Limiting Middleware ──
io.use((socket, next) => {
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    if (isRateLimited(clientIp)) {
        return next(new Error('Rate limit exceeded. Please try again later.'));
    }
    next();
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, name, type = 'public', userId, emoji = '😎' }) => {
        // ── Validate all inputs ──
        if (!isValidRoomId(roomId)) {
            socket.emit('error-message', 'Invalid room ID.');
            return;
        }

        name = sanitizeString(name, MAX_NAME_LENGTH);
        emoji = sanitizeString(emoji, MAX_EMOJI_LENGTH);
        userId = sanitizeString(userId, MAX_USER_ID_LENGTH);

        if (!name) {
            socket.emit('error-message', 'Name is required.');
            return;
        }
        if (!userId) {
            socket.emit('error-message', 'User ID is required.');
            return;
        }
        if (!['public', 'private'].includes(type)) {
            type = 'public';
        }

        let room = rooms.get(roomId);

        if (!room) {
            // Limit total rooms to prevent DoS
            if (rooms.size >= MAX_ROOMS) {
                socket.emit('error-message', 'Server is at capacity. Please try again later.');
                return;
            }

            room = {
                type: type,
                hostUserId: userId,
                hostSocketId: socket.id,
                users: {},
                pending: {}
            };
            rooms.set(roomId, room);
            console.log(`Room ${roomId} created (${type}) by host ${name}`);
        }

        // Limit users per room
        if (Object.keys(room.users).length >= MAX_USERS_PER_ROOM) {
            socket.emit('error-message', 'Room is full.');
            return;
        }

        if (room.users[socket.id]) return;

        const isHost = (userId === room.hostUserId);
        if (isHost) {
            room.hostSocketId = socket.id;
        }

        if (room.type === 'private' && !isHost) {
            room.pending[socket.id] = { name, userId, emoji };
            console.log(`User ${name} requesting to join private room ${roomId}`);

            if (room.hostSocketId) {
                io.to(room.hostSocketId).emit('join-request', { socketId: socket.id, name, emoji });
            }
            socket.emit('waiting-for-approval');
        } else {
            addUserToRoom(socket, roomId, name, userId, emoji);
        }
    });

    function addUserToRoom(socket, roomId, name, userId, emoji) {
        const room = rooms.get(roomId);
        if (!room) return;

        const color = pickColor(room.users);
        room.users[socket.id] = { name, userId, emoji, color };
        socket.join(roomId);

        const isHost = (room.hostSocketId === socket.id);
        console.log(`${name} joined room ${roomId} (isHost=${isHost})`);

        socket.to(roomId).emit('user-joined', { socketId: socket.id, name, emoji, color });

        const usersInRoom = Object.entries(room.users)
            .filter(([id]) => id !== socket.id)
            .map(([id, u]) => ({ socketId: id, name: u.name, emoji: u.emoji, color: u.color }));

        const pendingList = Object.entries(room.pending)
            .map(([id, u]) => ({ socketId: id, name: u.name, emoji: u.emoji }));

        socket.emit('room-ready', {
            users: usersInRoom,
            isHost,
            pending: pendingList,
            roomType: room.type,
            myColor: color
        });
    }

    socket.on('approve-request', ({ roomId, socketId }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;

        const pendingUser = room.pending[socketId];
        if (pendingUser) {
            delete room.pending[socketId];
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
                addUserToRoom(targetSocket, roomId, pendingUser.name, pendingUser.userId, pendingUser.emoji);
            }
        }
    });

    socket.on('decline-request', ({ roomId, socketId }) => {
        if (!isValidRoomId(roomId)) return;
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;

        delete room.pending[socketId];
        io.to(socketId).emit('join-declined');
    });

    socket.on('offer', ({ target, offer, name, emoji, color }) => {
        if (typeof target !== 'string') return;
        io.to(target).emit('offer', { from: socket.id, offer, name: sanitizeString(name, MAX_NAME_LENGTH), emoji: sanitizeString(emoji, MAX_EMOJI_LENGTH), color });
    });

    socket.on('answer', ({ target, answer }) => {
        if (typeof target !== 'string') return;
        io.to(target).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
        if (typeof target !== 'string') return;
        io.to(target).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on('toggle-mute', ({ isMuted }) => {
        if (typeof isMuted !== 'boolean') return;
        const roomsToBroadcast = Array.from(socket.rooms).filter(r => r !== socket.id);
        roomsToBroadcast.forEach(roomId => {
            socket.to(roomId).emit('user-toggled-mute', { socketId: socket.id, isMuted });
        });
    });

    socket.on('toggle-speaking', ({ isSpeaking }) => {
        if (typeof isSpeaking !== 'boolean') return;
        const roomsToBroadcast = Array.from(socket.rooms).filter(r => r !== socket.id);
        roomsToBroadcast.forEach(roomId => {
            socket.to(roomId).emit('user-toggled-speaking', { socketId: socket.id, isSpeaking });
        });
    });

    socket.on('kick-user', ({ roomId, socketId }) => {
        if (!isValidRoomId(roomId) || typeof socketId !== 'string') return;
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;

        io.to(socketId).emit('kicked');
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
            targetSocket.leave(roomId);
            handleUserLeaving(targetSocket, roomId);
        }
    });

    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            if (roomId !== socket.id) {
                handleUserLeaving(socket, roomId);
            }
        }
    });

    function handleUserLeaving(socket, roomId) {
        const room = rooms.get(roomId);
        if (!room) return;

        if (room.users[socket.id]) {
            delete room.users[socket.id];
            socket.to(roomId).emit('user-left', socket.id);
        }

        if (room.pending[socket.id]) {
            delete room.pending[socket.id];
        }

        const userCount = Object.keys(room.users).length;
        const pendingCount = Object.keys(room.pending).length;

        if (userCount === 0 && pendingCount === 0) {
            rooms.delete(roomId);
        } else if (room.hostSocketId === socket.id) {
            const nextHostId = Object.keys(room.users)[0];
            if (nextHostId) {
                room.hostSocketId = nextHostId;
                room.hostUserId = room.users[nextHostId].userId;
                io.to(nextHostId).emit('became-host');
                Object.entries(room.pending).forEach(([pendingId, u]) => {
                    io.to(nextHostId).emit('join-request', { socketId: pendingId, name: u.name, emoji: u.emoji });
                });
            } else {
                Object.keys(room.pending).forEach((pendingId) => {
                    io.to(pendingId).emit('room-closed');
                });
                rooms.delete(roomId);
            }
        }
    }
});

// ── Health endpoint ──
app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`VChat signaling server running on port ${PORT}`);
});
