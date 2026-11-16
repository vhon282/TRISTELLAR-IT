import type { ItNote, OnlinePresenceUser, TeamChatMessage } from '../types/cmms';

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
const OPERATOR_PREF_KEY = 'tristellar_team_operator_name';

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

export function loadSavedOperator(): string {
  try {
    return localStorage.getItem(OPERATOR_PREF_KEY) || 'Mac';
  } catch {
    return 'Mac';
  }
}

export function saveOperatorPreference(name: string): void {
  try {
    localStorage.setItem(OPERATOR_PREF_KEY, name);
  } catch {
    // ignore storage errors
  }
}

type EventListener = (event: TeamSocketEvent) => void;
type StatusListener = (connected: boolean) => void;

class TeamSocketClient {
  private ws: WebSocket | null = null;
  private eventListeners = new Set<EventListener>();
  private statusListeners = new Set<StatusListener>();
  private queue: string[] = [];
  private reconnectTimer: number | null = null;
  private retryAttempt = 0;
  private intentionalClose = false;
  private currentPresence: OnlinePresenceUser | null = null;
  private connected = false;

  connect(presence: OnlinePresenceUser): void {
    this.currentPresence = presence;
    this.intentionalClose = false;

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.announcePresence(presence);
      }
      return;
    }

    this.openSocket();
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
    } else {
      this.queue.push(serialized);
    }
  }

  announcePresence(presence: OnlinePresenceUser): void {
    this.currentPresence = presence;
    this.sendFrame({
      type: 'presence:join',
      ...presence,
    });
  }

  sendChatMessage(message: TeamChatMessage): void {
    this.sendFrame({ type: 'chat:send', message });
  }

  deleteChatMessage(id: string): void {
    this.sendFrame({ type: 'chat:delete', id });
  }

  upsertNote(note: ItNote): void {
    this.sendFrame({ type: 'note:upsert', note });
  }

  deleteNote(id: string): void {
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
    this.setConnected(false);
  }
}

export const teamSocket = new TeamSocketClient();
