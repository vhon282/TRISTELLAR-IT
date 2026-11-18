import type { ItNote, OnlinePresenceUser, TeamChatMessage } from '../types/cmms';
import { loadAuthSession } from './auth';

export type TeamSocketEvent =
  | {
      type: 'team:init';
      messages: TeamChatMessage[];
      notes: ItNote[];
      onlineUsers: OnlinePresenceUser[];
    }
  | { type: 'presence:update'; onlineUsers: OnlinePresenceUser[] }
  | { type: 'chat:created'; message: TeamChatMessage }
  | { type: 'chat:deleted'; id: string }
  | { type: 'note:upserted'; note: ItNote }
  | { type: 'note:deleted'; id: string };

export function mergeChatMessage(
  prev: TeamChatMessage[],
  incoming: TeamChatMessage
): TeamChatMessage[] {
  if (prev.some((m) => m.id === incoming.id)) {
    return prev.map((m) => (m.id === incoming.id ? incoming : m));
  }
  return [...prev, incoming].slice(-400);
}

export function mergeItNote(prev: ItNote[], incoming: ItNote): ItNote[] {
  if (prev.some((n) => n.id === incoming.id)) {
    return prev.map((n) => (n.id === incoming.id ? incoming : n));
  }
  return [incoming, ...prev];
}

const CLIENT_ID_KEY = 'tristellar_team_client_id';
const LOCAL_COLLAB_KEY = 'tristellar_team_collab_cache_v1';
const BROADCAST_CHANNEL_NAME = 'tristellar_team_collab_bc_v1';

interface LocalCollabCache {
  messages: TeamChatMessage[];
  notes: ItNote[];
}

export const SEED_FALLBACK_CACHE: LocalCollabCache = {
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

export function loadLocalTeamCache(): LocalCollabCache {
  try {
    const raw = window.localStorage.getItem(LOCAL_COLLAB_KEY);
    if (!raw) return structuredClone(SEED_FALLBACK_CACHE);
    const parsed = JSON.parse(raw) as Partial<LocalCollabCache>;
    return {
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
        : structuredClone(SEED_FALLBACK_CACHE.messages),
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
        : structuredClone(SEED_FALLBACK_CACHE.notes),
    };
  } catch {
    return structuredClone(SEED_FALLBACK_CACHE);
  }
}

export function saveLocalTeamCache(cache: LocalCollabCache): void {
  try {
    window.localStorage.setItem(LOCAL_COLLAB_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

export function getOrCreateClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const created = `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return `op-${Date.now().toString(36)}`;
  }
}

type EventListener = (event: TeamSocketEvent) => void;
type StatusListener = (connected: boolean) => void;

class TeamSocketClient {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private eventListeners = new Set<EventListener>();
  private statusListeners = new Set<StatusListener>();
  private queue: string[] = [];
  private reconnectTimer: number | null = null;
  private retryAttempt = 0;
  private intentionalClose = false;
  private currentPresence: OnlinePresenceUser | null = null;
  private connected = false;
  private serverReachedOnce = false;

  connect(presence: OnlinePresenceUser): void {
    this.currentPresence = this.bindPresenceToAccount(presence);
    this.intentionalClose = false;
    this.retryAttempt = 0;
    this.initBroadcastChannel();

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.announcePresence(this.currentPresence);
      }
      return;
    }

    this.openSocket();
  }

  private initBroadcastChannel(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }
    if (this.bc) return;
    try {
      this.bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.bc.onmessage = (evt) => {
        if (this.connected) return;
        const data = evt.data as TeamSocketEvent | undefined;
        if (!data || typeof data.type !== 'string') return;
        this.eventListeners.forEach((cb) => cb(data));
      };
    } catch {
      this.bc = null;
    }
  }

  private bindPresenceToAccount(presence: OnlinePresenceUser): OnlinePresenceUser {
    const session = loadAuthSession();
    if (!session) return presence;
    return {
      ...presence,
      userName: session.displayName,
      role: session.role,
    };
  }

  private openSocket(): void {
    if (typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/team`;

    try {
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.retryAttempt = 0;
        this.serverReachedOnce = true;
        this.setConnected(true);
        if (this.currentPresence) {
          socket.send(
            JSON.stringify({
              type: 'presence:join',
              ...this.currentPresence,
            })
          );
        }
        while (this.queue.length > 0 && socket.readyState === WebSocket.OPEN) {
          const payload = this.queue.shift();
          if (payload) socket.send(payload);
        }
      };

      socket.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(String(evt.data)) as TeamSocketEvent;
          if (parsed.type === 'team:init') {
            saveLocalTeamCache({
              messages: parsed.messages,
              notes: parsed.notes,
            });
          }
          this.eventListeners.forEach((cb) => cb(parsed));
        } catch {
          // ignore malformed server frame
        }
      };

      socket.onclose = () => {
        this.ws = null;
        this.setConnected(false);
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      socket.onerror = () => {
        // onclose will handle backoff reconnect
      };
    } catch {
      this.setConnected(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    // If hosted on a static origin without a WS server, cap retry attempts after 3 tries
    if (!this.serverReachedOnce && this.retryAttempt >= 3) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(1.6, this.retryAttempt), 15000);
    this.retryAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) {
        this.openSocket();
      }
    }, delay);
  }

  private setConnected(val: boolean): void {
    if (this.connected === val) return;
    this.connected = val;
    this.statusListeners.forEach((cb) => cb(val));
  }

  private sendFrame(payload: unknown): void {
    const serialized = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
    } else if (this.serverReachedOnce || this.retryAttempt < 3) {
      this.queue.push(serialized);
    }
  }

  private postLocalBroadcast(event: TeamSocketEvent): void {
    if (this.bc && !this.connected) {
      try {
        this.bc.postMessage(event);
      } catch {
        // ignore channel errors
      }
    }
  }

  announcePresence(presence: OnlinePresenceUser): void {
    this.currentPresence = this.bindPresenceToAccount(presence);
    this.sendFrame({
      type: 'presence:join',
      ...this.currentPresence,
    });
  }

  sendChatMessage(message: TeamChatMessage): void {
    const session = loadAuthSession();
    const sender = session?.displayName || this.currentPresence?.userName || message.sender;
    const senderRole =
      session?.role || this.currentPresence?.role || message.senderRole;
    const boundMessage: TeamChatMessage = { ...message, sender, senderRole };
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      messages: mergeChatMessage(cache.messages, boundMessage),
    });
    this.postLocalBroadcast({ type: 'chat:created', message: boundMessage });
    this.sendFrame({
      type: 'chat:send',
      message: boundMessage,
    });
  }

  deleteChatMessage(id: string): void {
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      messages: cache.messages.filter((m) => m.id !== id),
    });
    this.postLocalBroadcast({ type: 'chat:deleted', id });
    this.sendFrame({ type: 'chat:delete', id });
  }

  upsertNote(note: ItNote): void {
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      notes: mergeItNote(cache.notes, note),
    });
    this.postLocalBroadcast({ type: 'note:upserted', note });
    this.sendFrame({ type: 'note:upsert', note });
  }

  deleteNote(id: string): void {
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      notes: cache.notes.filter((n) => n.id !== id),
    });
    this.postLocalBroadcast({ type: 'note:deleted', id });
    this.sendFrame({ type: 'note:delete', id });
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.connected);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    this.setConnected(false);
  }
}

export const teamSocket = new TeamSocketClient();
