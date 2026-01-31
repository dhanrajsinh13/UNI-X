# Real-Time Messaging System - Complete Flow Guide

This document explains the complete working flow of the real-time messaging system using Socket.IO.

## Architecture Overview

```
┌─────────────────┐     WebSocket      ┌──────────────────┐      REST API    ┌─────────────┐
│   Frontend      │◄──────────────────►│  Socket Server   │◄────────────────►│  MongoDB    │
│  (Next.js)      │                    │  (Node.js)       │                  │             │
└─────────────────┘                    └──────────────────┘                  └─────────────┘
```

## Files Involved

| File | Purpose |
|------|---------|
| `socket-server/server.js` | Backend Socket.IO server |
| `contexts/SocketContext.tsx` | Frontend socket connection & state |
| `components/Messages.tsx` | Chat UI component |
| `pages/api/messages/index.ts` | REST API for message persistence |

---

## 1. Connection Flow

### User Login → Socket Connect

```
1. User logs in → receives JWT token
2. Frontend SocketContext initializes connection
3. Socket server validates JWT
4. User joins personal room: user-{userId}
5. Server tracks user as online
```

**Code locations:**
- `SocketContext.tsx` lines 79-216: Connection logic
- `server.js` lines 85-126: JWT validation middleware
- `server.js` lines 128-150: Connection handler with online tracking

---

## 2. Sending Messages

### Message Flow Diagram

```
User A types message
        │
        ▼
┌─────────────────────────────────────┐
│ 1. Create optimistic message        │
│    status: 'sending' (⏳)           │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 2. Emit 'send-message' to server    │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 3. Server saves to MongoDB via API  │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 4. Server emits 'message-ack'       │
│    status: 'sent' (✓)               │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 5. If recipient online, emit        │
│    'message-delivered' (✓✓)         │
└─────────────────────────────────────┘
```

**Code locations:**
- `Messages.tsx` lines 277-313: handleSendMessage()
- `server.js` lines 178-265: send-message handler

---

## 3. Receiving Messages

```
Server broadcasts 'new-message'
        │
        ▼
┌─────────────────────────────────────┐
│ 1. Frontend receives message        │
│    via onNewMessage handler         │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 2. Deduplicate (by id & clientId)   │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 3. Emit 'message-received' to       │
│    confirm delivery                 │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 4. Auto-scroll to new message       │
└─────────────────────────────────────┘
```

**Code locations:**
- `Messages.tsx` lines 98-133: New message handler with delivery confirmation

---

## 4. Message Status Indicators

| Status | Icon | Meaning |
|--------|------|---------|
| sending | ⏳ | Message is being sent |
| sent | ✓ | Server saved the message |
| delivered | ✓✓ | Recipient received the message |
| read | ✓✓ (blue) | Recipient read the message |

**Code locations:**
- `Messages.tsx` lines 395-420: Status indicator rendering

---

## 5. Read Receipts

```
Recipient opens conversation
        │
        ▼
┌─────────────────────────────────────┐
│ 1. Frontend detects unread messages │
│    from the other user              │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 2. Emit 'mark-messages-read' with   │
│    messageIds after 500ms delay     │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 3. Server broadcasts 'messages-read'│
│    to sender                        │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 4. Sender's UI updates status       │
│    to 'read' (✓✓ blue)              │
└─────────────────────────────────────┘
```

**Code locations:**
- `Messages.tsx` lines 79-95: Mark messages as read on view
- `server.js` lines 295-325: mark-messages-read handler

---

## 6. Typing Indicators

```
User starts typing
        │
        ▼
┌─────────────────────────────────────┐
│ 1. Emit 'typing-start' to server    │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 2. Server broadcasts to conversation│
│    room 'user-typing'               │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 3. Recipient sees typing indicator  │
│    (animated dots)                  │
└─────────────────────────────────────┘
        │
        ▼ (2 seconds of no typing)
┌─────────────────────────────────────┐
│ 4. Emit 'typing-stop' automatically │
└─────────────────────────────────────┘
```

**Code locations:**
- `Messages.tsx` lines 330-355: handleTyping()
- `Messages.tsx` lines 435-446: Typing indicator UI

---

## 7. Online/Offline Status

The server tracks online users in a Map:

```javascript
// Map<userId, Set<socketId>>
const onlineUsers = new Map();
```

**Benefits:**
- Supports multiple devices per user
- Only marks offline when ALL sockets disconnect
- Provides `/online-users` endpoint for fetching status

---

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| Connection failed | Shows "Connection lost" message, auto-reconnect |
| Token expired | Triggers logout, shows alert |
| Message send failed | Removes optimistic message, shows error |
| Server unreachable | Disables input, shows warning |

---

## Testing

### Local Testing

1. Start socket server:
   ```bash
   cd socket-server
   npm start
   ```

2. Start Next.js app:
   ```bash
   npm run dev
   ```

3. Open `socket-server/test.html` in browser with a valid JWT token

### Test Checklist

- [ ] Connection shows "Connected" status
- [ ] Send message shows ⏳ → ✓ → ✓✓
- [ ] Recipient receives message in real-time
- [ ] Typing indicator appears when typing
- [ ] Read receipts show ✓✓ (blue) when viewed

---

## Socket Events Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `send-message` | `{receiverId, messageText, clientId}` | Send new message |
| `join-conversation` | `conversationId` | Join chat room |
| `leave-conversation` | `conversationId` | Leave chat room |
| `typing-start` | `{conversationId, userId, userName}` | Start typing |
| `typing-stop` | `{conversationId, userId}` | Stop typing |
| `mark-messages-read` | `{conversationId, messageIds, senderId}` | Mark as read |
| `message-received` | `{messageId, senderId}` | Confirm delivery |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `new-message` | Message object | New message received |
| `message-ack` | `{clientId, messageId, status}` | Message saved |
| `message-delivered` | `{messageId, deliveredTo, deliveredAt}` | Delivery confirmed |
| `messages-read` | `{messageIds, readBy, readAt}` | Read receipt |
| `user-typing` | `{userId, userName}` | User is typing |
| `user-stopped-typing` | `{userId}` | User stopped typing |
| `user-status-change` | `{userId, status, lastSeen}` | Online/offline |
