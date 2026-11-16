import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import type { Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  ChatChannel,
  ItNote,
  NoteCategory,
  OnlinePresenceUser,
  TeamChatMessage,
} from './src/types/cmms.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'team-collab.json');

interface TeamCollabStore {
  version: number;
  messages: TeamChatMessage[];
  notes: ItNote[];
}

const VALID_CHANNELS = new Set<ChatChannel>([
  'general-it',
  'branch-support',
  'maintenance-ops',
  'parts-procurement',
]);

const VALID_NOTE_CATEGORIES = new Set<NoteCategory>([
  'Handover',
  'Runbook',
  'Incident',
  'Maintenance',
  'Config',
]);

const SEED_TEAM_STORE: TeamCollabStore = {
  version: 1,
  messages: [
    {
      id: 'msg-seed-001',
      channel: 'general-it',
      sender: 'Mac',
      senderRole: 'IT Lead',
      content:
        'Morning team — Q4 BIS Main Tanza Server backup restore drill passed. Remember to log actual dates in Preventive Maint. once branch PM sheets are signed.',
      assetCode: '00510-01',
      branchLocation: 'Main',
      createdAt: '2026-11-15T08:15:00.000Z',
    },
    {
      id: 'msg-seed-002',
      channel: 'branch-support',
      sender: 'Francis',
      senderRole: 'IT Support',
      content:
        'Heading to Conchu Dispatch Bay 1 for HP M404dn fuser bushing inspection. AnyDesk relay on Conchu server is verified online.',
      assetCode: '00542-01',
      branchLocation: 'Conchu',
      createdAt: '2026-11-15T08:42:00.000Z',
    },
    {
      id: 'msg-seed-003',
      channel: 'maintenance-ops',
      sender: 'Vhon',
      senderRole: 'IT Support',
      content:
        'Conchu Core PoE Switch 24-Port cleaned and verified at 58W load. Camera D4 PoE boot reseated, monitoring packet loss.',
      assetCode: '00519-04',
      branchLocation: 'Conchu',
      createdAt: '2026-11-15T09:10:00.000Z',
    },
    {
      id: 'msg-seed-004',
      channel: 'parts-procurement',
      sender: 'Mac',
      senderRole: 'IT Lead',
      content:
        'Follow up with Jack on urgent 500GB NVMe SSDs and 12V 9Ah UPS batteries — Bacoor NVR UPS already retired.',
      assetCode: '00604-05',
      branchLocation: 'Bacoor',
      createdAt: '2026-11-15T09:28:00.000Z',
    },
  ],
  notes: [
    {
      id: 'note-seed-001',
      title: 'Q4 Shift Handover — Conchu & Amaya Priority Items',
      content:
        '1. Conchu Dispatch Laser Printer (00542-01): Fuser bushing noise reported during heavy waybill printing.\n2. Amaya Sales MFC-L3750CDW (00571-02): Marked DOWN awaiting DR263CL drum kit.\n3. Conchu CCTV D4 (192.168.110.14): Monitor PoE stability after RJ45 boot replacement.',
      category: 'Handover',
      branchLocation: 'Conchu',
      assetCode: '00542-01',
      author: 'Mac',
      pinned: true,
      createdAt: '2026-11-15T08:05:00.000Z',
      updatedAt: '2026-11-15T08:05:00.000Z',
    },
    {
      id: 'note-seed-002',
      title: 'BIS Main Tanza Server — AnyDesk & SQL Maintenance Runbook',
      content:
        'AnyDesk ID: 412889501. Before rebooting ML350 Gen10, confirm Accounting & Dispatch users are logged out of BIS ERP, check APC Smart-UPS 3000 battery capacity (>90%), and verify RAID-10 status in HPE Smart Storage Administrator.',
      category: 'Runbook',
      branchLocation: 'Main',
      assetCode: '00510-01',
      author: 'Mac',
      pinned: true,
      createdAt: '2026-11-14T16:20:00.000Z',
      updatedAt: '2026-11-14T16:20:00.000Z',
    },
    {
      id: 'note-seed-003',
      title: 'Bacoor NVR Rack UPS Battery Replacement Spec',
      content:
        'Decommissioned APC Back-UPS Pro 1500VA (00604-05) requires 2x 12V 9Ah SLA batteries (F2 terminals) for spare refurbishment. Coordinate turnover pickup with Main Warehouse.',
      category: 'Incident',
      branchLocation: 'Bacoor',
      assetCode: '00604-05',
      author: 'Vhon',
      pinned: false,
      createdAt: '2026-11-13T11:45:00.000Z',
      updatedAt: '2026-11-13T11:45:00.000Z',
    },
    {
      id: 'note-seed-004',
      title: 'Conchu CCTV Subnet Reservation Map',
      content:
        'Conchu NVR cameras use static 192.168.110.11 - 192.168.110.20 outside DHCP pool (.50-.200). PoE ports 1-8 on UniFi Switch 24 PoE (00519-04) are labeled D1-D8.',
      category: 'Config',
      branchLocation: 'Conchu',
      assetCode: '00519-04',
      author: 'Francis',
      pinned: false,
      createdAt: '2026-11-12T14:00:00.000Z',
      updatedAt: '2026-11-12T14:00:00.000Z',
    },
  ],
};

function ensureStore(): TeamCollabStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_TEAM_STORE, null, 2), 'utf8');
      return structuredClone(SEED_TEAM_STORE);
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TeamCollabStore>;
    return {
      version: 1,
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
        : structuredClone(SEED_TEAM_STORE.messages),
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
        : structuredClone(SEED_TEAM_STORE.notes),
    };
  } catch (err) {
    console.error('Failed to read team-collab.json, falling back to seed:', err);
    return structuredClone(SEED_TEAM_STORE);
  }
}

function saveStore(store: TeamCollabStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('Failed to persist team-collab.json:', err);
  }
}

function sanitizeChannel(ch: unknown): ChatChannel {
  if (typeof ch === 'string' && VALID_CHANNELS.has(ch as ChatChannel)) {
    return ch as ChatChannel;
  }
  return 'general-it';
}

function sanitizeCategory(cat: unknown): NoteCategory {
  if (typeof cat === 'string' && VALID_NOTE_CATEGORIES.has(cat as NoteCategory)) {
    return cat as NoteCategory;
  }
  return 'Handover';
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function startServer(): Promise<void> {
  const store = ensureStore();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/team' });

  const clients = new Map<WebSocket, OnlinePresenceUser>();

  const getOnlineUsers = (): OnlinePresenceUser[] => {
    const unique = new Map<string, OnlinePresenceUser>();
    for (const user of clients.values()) {
      unique.set(user.clientId, user);
    }
    return Array.from(unique.values());
  };

  const broadcast = (payload: unknown): void => {
    const serialized = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  };

  const broadcastPresence = (): void => {
    broadcast({
      type: 'presence:update',
      onlineUsers: getOnlineUsers(),
    });
  };

  wss.on('connection', (socket: WebSocket) => {
    const defaultClient: OnlinePresenceUser = {
      clientId: makeId('cli'),
      userName: 'IT Tech',
      role: 'TRISTELLAR IT',
    };
    clients.set(socket, defaultClient);

    // Send authoritative state immediately upon WebSocket connect
    socket.send(
      JSON.stringify({
        type: 'team:init',
        messages: store.messages,
        notes: store.notes,
        onlineUsers: getOnlineUsers(),
      })
    );

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const type = typeof msg.type === 'string' ? msg.type : '';

        if (type === 'presence:join') {
          const clientId =
            typeof msg.clientId === 'string' && msg.clientId.trim()
              ? msg.clientId.trim().slice(0, 64)
              : defaultClient.clientId;
          const userName =
            typeof msg.userName === 'string' && msg.userName.trim()
              ? msg.userName.trim().slice(0, 48)
              : 'IT Tech';
          const role =
            typeof msg.role === 'string' && msg.role.trim()
              ? msg.role.trim().slice(0, 48)
              : 'TRISTELLAR IT';
          clients.set(socket, { clientId, userName, role });
          broadcastPresence();
          return;
        }

        if (type === 'chat:send') {
          const incoming = (msg.message ?? msg) as Record<string, unknown>;
          const content =
            typeof incoming.content === 'string' ? incoming.content.trim() : '';
          if (!content) return;

          const id =
            typeof incoming.id === 'string' && incoming.id.trim()
              ? incoming.id.trim().slice(0, 64)
              : makeId('msg');

          // Idempotent create: skip if message ID already recorded
          if (store.messages.some((m) => m.id === id)) {
            return;
          }

          const created: TeamChatMessage = {
            id,
            channel: sanitizeChannel(incoming.channel),
            sender:
              typeof incoming.sender === 'string' && incoming.sender.trim()
                ? incoming.sender.trim().slice(0, 48)
                : clients.get(socket)?.userName || 'IT Tech',
            senderRole:
              typeof incoming.senderRole === 'string' && incoming.senderRole.trim()
                ? incoming.senderRole.trim().slice(0, 48)
                : clients.get(socket)?.role || 'TRISTELLAR IT',
            content: content.slice(0, 2000),
            assetCode:
              typeof incoming.assetCode === 'string' && incoming.assetCode.trim()
                ? incoming.assetCode.trim().slice(0, 48)
                : undefined,
            branchLocation:
              typeof incoming.branchLocation === 'string' &&
              incoming.branchLocation.trim()
                ? incoming.branchLocation.trim().slice(0, 48)
                : undefined,
            createdAt:
              typeof incoming.createdAt === 'string' && incoming.createdAt.trim()
                ? incoming.createdAt
                : new Date().toISOString(),
          };

          store.messages = [...store.messages, created].slice(-400);
          saveStore(store);
          broadcast({ type: 'chat:created', message: created });
          return;
        }

        if (type === 'chat:delete') {
          const id = typeof msg.id === 'string' ? msg.id.trim() : '';
          if (!id) return;
          const prevLen = store.messages.length;
          store.messages = store.messages.filter((m) => m.id !== id);
          if (store.messages.length !== prevLen) {
            saveStore(store);
            broadcast({ type: 'chat:deleted', id });
          }
          return;
        }

        if (type === 'note:upsert') {
          const incoming = (msg.note ?? msg) as Record<string, unknown>;
          const title = typeof incoming.title === 'string' ? incoming.title.trim() : '';
          const content =
            typeof incoming.content === 'string' ? incoming.content.trim() : '';
          if (!title && !content) return;

          const now = new Date().toISOString();
          const id =
            typeof incoming.id === 'string' && incoming.id.trim()
              ? incoming.id.trim().slice(0, 64)
              : makeId('note');

          const existing = store.notes.find((n) => n.id === id);
          const upserted: ItNote = {
            id,
            title: (title || 'Untitled IT Note').slice(0, 140),
            content: content.slice(0, 5000),
            category: sanitizeCategory(incoming.category),
            branchLocation:
              typeof incoming.branchLocation === 'string' &&
              incoming.branchLocation.trim()
                ? incoming.branchLocation.trim().slice(0, 48)
                : 'All Branches',
            assetCode:
              typeof incoming.assetCode === 'string' && incoming.assetCode.trim()
                ? incoming.assetCode.trim().slice(0, 48)
                : undefined,
            author:
              typeof incoming.author === 'string' && incoming.author.trim()
                ? incoming.author.trim().slice(0, 48)
                : existing?.author || clients.get(socket)?.userName || 'IT Tech',
            pinned: Boolean(incoming.pinned),
            createdAt: existing?.createdAt || (typeof incoming.createdAt === 'string' ? incoming.createdAt : now),
            updatedAt: now,
          };

          if (existing) {
            store.notes = store.notes.map((n) => (n.id === id ? upserted : n));
          } else {
            store.notes = [upserted, ...store.notes];
          }
          saveStore(store);
          broadcast({ type: 'note:upserted', note: upserted });
          return;
        }

        if (type === 'note:delete') {
          const id = typeof msg.id === 'string' ? msg.id.trim() : '';
          if (!id) return;
          const prevLen = store.notes.length;
          store.notes = store.notes.filter((n) => n.id !== id);
          if (store.notes.length !== prevLen) {
            saveStore(store);
            broadcast({ type: 'note:deleted', id });
          }
        }
      } catch (err) {
        console.error('Invalid WS payload:', err);
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      broadcastPresence();
    });
  });

  // REST Endpoints
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      onlineCount: getOnlineUsers().length,
      messagesCount: store.messages.length,
      notesCount: store.notes.length,
    });
  });

  app.get('/api/team/state', (_req: Request, res: Response) => {
    res.json({
      messages: store.messages,
      notes: store.notes,
      onlineUsers: getOnlineUsers(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`TRISTELLAR IT DEPT. CMMS server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
