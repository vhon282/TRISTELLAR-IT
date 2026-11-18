import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  ChatChannel,
  ItNote,
  NoteCategory,
  OnlinePresenceUser,
  TeamChatMessage,
} from '../types/cmms';
import { loadAuthSession } from './auth';
import { getSupabaseClient } from './supabaseClient';

export type TeamSocketEvent =
  | {
      type: 'team:init';
      messages: TeamChatMessage[];
      notes: ItNote[];
      onlineUsers?: OnlinePresenceUser[];
    }
  | { type: 'presence:update'; onlineUsers: OnlinePresenceUser[] }
  | { type: 'chat:created'; message: TeamChatMessage }
  | { type: 'chat:deleted'; id: string }
  | { type: 'note:upserted'; note: ItNote }
  | { type: 'note:deleted'; id: string };

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

function sanitizeChannel(val: unknown): ChatChannel {
  const s = String(val || '') as ChatChannel;
  return VALID_CHANNELS.has(s) ? s : 'general-it';
}

function sanitizeNoteCategory(val: unknown): NoteCategory {
  const s = String(val || '') as NoteCategory;
  return VALID_NOTE_CATEGORIES.has(s) ? s : 'Handover';
}

function mapRowToChatMessage(row: Record<string, unknown>): TeamChatMessage {
  return {
    id: String(row.id),
    channel: sanitizeChannel(row.channel),
    sender: String(row.sender || 'IT Support'),
    senderRole: row.sender_role ? String(row.sender_role) : undefined,
    content: String(row.content || ''),
    assetCode: row.asset_code ? String(row.asset_code) : undefined,
    branchLocation: row.branch_location ? String(row.branch_location) : undefined,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

function mapRowToItNote(row: Record<string, unknown>): ItNote {
  const now = new Date().toISOString();
  return {
    id: String(row.id),
    title: String(row.title || 'Untitled IT Note'),
    content: String(row.content || ''),
    category: sanitizeNoteCategory(row.category),
    branchLocation: String(row.branch_location || 'All Branches'),
    assetCode: row.asset_code ? String(row.asset_code) : undefined,
    author: String(row.author || 'IT Support'),
    pinned: Boolean(row.pinned),
    createdAt: row.created_at ? String(row.created_at) : now,
    updatedAt: row.updated_at ? String(row.updated_at) : now,
  };
}

export function mergeChatMessage(
  prev: TeamChatMessage[],
  incoming: TeamChatMessage
): TeamChatMessage[] {
  const next = prev.some((m) => m.id === incoming.id)
    ? prev.map((m) => (m.id === incoming.id ? incoming : m))
    : [...prev, incoming];
  return next
    .slice()
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .slice(-400);
}

export function mergeItNote(prev: ItNote[], incoming: ItNote): ItNote[] {
  const next = prev.some((n) => n.id === incoming.id)
    ? prev.map((n) => (n.id === incoming.id ? incoming : n))
    : [incoming, ...prev];
  return next.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

const CLIENT_ID_KEY = 'tristellar_team_client_id';
const LOCAL_COLLAB_KEY = 'tristellar_team_collab_cache_v1';
const TEAM_REALTIME_CHANNEL = 'tristellar-team-collab';

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

class TeamRealtimeClient {
  private channel: RealtimeChannel | null = null;
  private eventListeners = new Set<EventListener>();
  private statusListeners = new Set<StatusListener>();
  private currentPresence: OnlinePresenceUser | null = null;
  private connected = false;
  private subscribed = false;
  private generation = 0;

  connect(presence: OnlinePresenceUser): void {
    const bound = this.bindPresenceToAccount(presence);
    this.currentPresence = bound;

    if (this.channel && this.subscribed) {
      void this.trackOperatorPresence(bound);
      return;
    }

    if (this.channel) {
      return;
    }

    const gen = ++this.generation;
    void this.loadInitialState();

    try {
      const supabase = getSupabaseClient();
      const channel = supabase.channel(TEAM_REALTIME_CHANNEL, {
        config: {
          presence: {
            key: bound.clientId,
          },
        },
      });

      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_chat_messages' },
          (payload) => {
            if (gen !== this.generation) return;
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new as Record<string, unknown> | null;
              if (!row || !row.id) return;
              const message = mapRowToChatMessage(row);
              const cache = loadLocalTeamCache();
              saveLocalTeamCache({
                ...cache,
                messages: mergeChatMessage(cache.messages, message),
              });
              this.emitEvent({ type: 'chat:created', message });
            } else if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Record<string, unknown> | null;
              const id = oldRow?.id ? String(oldRow.id) : '';
              if (!id) return;
              const cache = loadLocalTeamCache();
              saveLocalTeamCache({
                ...cache,
                messages: cache.messages.filter((m) => m.id !== id),
              });
              this.emitEvent({ type: 'chat:deleted', id });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'it_notes' },
          (payload) => {
            if (gen !== this.generation) return;
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new as Record<string, unknown> | null;
              if (!row || !row.id) return;
              const note = mapRowToItNote(row);
              const cache = loadLocalTeamCache();
              saveLocalTeamCache({
                ...cache,
                notes: mergeItNote(cache.notes, note),
              });
              this.emitEvent({ type: 'note:upserted', note });
            } else if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Record<string, unknown> | null;
              const id = oldRow?.id ? String(oldRow.id) : '';
              if (!id) return;
              const cache = loadLocalTeamCache();
              saveLocalTeamCache({
                ...cache,
                notes: cache.notes.filter((n) => n.id !== id),
              });
              this.emitEvent({ type: 'note:deleted', id });
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          if (gen !== this.generation) return;
          const onlineUsers = this.extractPresenceUsers(channel);
          this.emitEvent({ type: 'presence:update', onlineUsers });
        })
        .subscribe((status) => {
          if (gen !== this.generation) return;
          if (status === 'SUBSCRIBED') {
            this.subscribed = true;
            this.setConnected(true);
            if (this.currentPresence) {
              void this.trackOperatorPresence(this.currentPresence);
            }
          } else if (
            status === 'CLOSED' ||
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            this.subscribed = false;
            this.setConnected(false);
          }
        });

      this.channel = channel;
    } catch (err) {
      console.error('Failed to connect to Supabase Realtime:', err);
      this.setConnected(false);
    }
  }

  async loadInitialState(): Promise<LocalCollabCache> {
    try {
      const supabase = getSupabaseClient();
      const [chatRes, noteRes] = await Promise.all([
        supabase
          .from('team_chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(400),
        supabase
          .from('it_notes')
          .select('*')
          .order('updated_at', { ascending: false }),
      ]);

      if (chatRes.error || noteRes.error) {
        throw chatRes.error || noteRes.error;
      }

      const messages = (chatRes.data ?? []).map((row) =>
        mapRowToChatMessage(row as Record<string, unknown>)
      );
      const notes = (noteRes.data ?? []).map((row) =>
        mapRowToItNote(row as Record<string, unknown>)
      );
      const result: LocalCollabCache = { messages, notes };
      saveLocalTeamCache(result);
      this.emitEvent({ type: 'team:init', messages, notes });
      return result;
    } catch (err) {
      console.error('Failed to load team chat/notes from Supabase:', err);
      const fallback = loadLocalTeamCache();
      this.emitEvent({
        type: 'team:init',
        messages: fallback.messages,
        notes: fallback.notes,
      });
      return fallback;
    }
  }

  private extractPresenceUsers(channel: RealtimeChannel): OnlinePresenceUser[] {
    const state = channel.presenceState<Record<string, unknown>>();
    const usersByClient = new Map<string, OnlinePresenceUser>();

    for (const [presenceKey, metas] of Object.entries(state)) {
      if (!Array.isArray(metas)) continue;
      for (const rawMeta of metas) {
        if (!rawMeta || typeof rawMeta !== 'object') continue;
        const meta = rawMeta as Record<string, unknown>;
        const operator = (
          meta.operator && typeof meta.operator === 'object' ? meta.operator : meta
        ) as Record<string, unknown>;
        const clientId = String(operator.clientId || presenceKey || '').trim();
        const userName = String(operator.userName || '').trim();
        const role = String(operator.role || 'IT Support').trim();
        if (!clientId || !userName) continue;
        usersByClient.set(clientId, { clientId, userName, role });
      }
    }

    return Array.from(usersByClient.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName)
    );
  }

  private async trackOperatorPresence(
    operator: OnlinePresenceUser
  ): Promise<void> {
    if (!this.channel || !this.subscribed) return;
    try {
      await this.channel.track({
        operator: {
          clientId: operator.clientId,
          userName: operator.userName,
          role: operator.role,
        },
        online_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to track operator presence:', err);
    }
  }

  private bindPresenceToAccount(
    presence: OnlinePresenceUser
  ): OnlinePresenceUser {
    const session = loadAuthSession();
    if (!session) return presence;
    return {
      ...presence,
      userName: session.displayName,
      role: session.role,
    };
  }

  private emitEvent(event: TeamSocketEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  private setConnected(val: boolean): void {
    if (this.connected === val) return;
    this.connected = val;
    this.statusListeners.forEach((cb) => cb(val));
  }

  announcePresence(presence: OnlinePresenceUser): void {
    const bound = this.bindPresenceToAccount(presence);
    this.currentPresence = bound;
    void this.trackOperatorPresence(bound);
  }

  sendChatMessage(message: TeamChatMessage): void {
    const session = loadAuthSession();
    const sender =
      session?.displayName || this.currentPresence?.userName || message.sender;
    const senderRole =
      session?.role || this.currentPresence?.role || message.senderRole;
    const boundMessage: TeamChatMessage = { ...message, sender, senderRole };

    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      messages: mergeChatMessage(cache.messages, boundMessage),
    });

    void (async () => {
      try {
        const { error } = await getSupabaseClient()
          .from('team_chat_messages')
          .upsert(
            {
              id: boundMessage.id,
              channel: boundMessage.channel,
              sender: boundMessage.sender,
              sender_role: boundMessage.senderRole || 'IT Support',
              content: boundMessage.content,
              asset_code: boundMessage.assetCode || null,
              branch_location: boundMessage.branchLocation || null,
              created_at: boundMessage.createdAt,
            },
            { onConflict: 'id' }
          );
        if (error) {
          console.error('Failed to persist team chat message:', error);
        }
      } catch (err) {
        console.error('Failed to persist team chat message:', err);
      }
    })();
  }

  deleteChatMessage(id: string): void {
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      messages: cache.messages.filter((m) => m.id !== id),
    });

    void (async () => {
      try {
        const { error } = await getSupabaseClient()
          .from('team_chat_messages')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('Failed to delete team chat message:', error);
        }
      } catch (err) {
        console.error('Failed to delete team chat message:', err);
      }
    })();
  }

  upsertNote(note: ItNote): void {
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      notes: mergeItNote(cache.notes, note),
    });

    void (async () => {
      try {
        const { error } = await getSupabaseClient()
          .from('it_notes')
          .upsert(
            {
              id: note.id,
              title: note.title,
              content: note.content,
              category: note.category,
              branch_location: note.branchLocation || 'All Branches',
              asset_code: note.assetCode || null,
              author: note.author,
              pinned: Boolean(note.pinned),
              created_at: note.createdAt,
              updated_at: note.updatedAt,
            },
            { onConflict: 'id' }
          );
        if (error) {
          console.error('Failed to persist IT note:', error);
        }
      } catch (err) {
        console.error('Failed to persist IT note:', err);
      }
    })();
  }

  deleteNote(id: string): void {
    const cache = loadLocalTeamCache();
    saveLocalTeamCache({
      ...cache,
      notes: cache.notes.filter((n) => n.id !== id),
    });

    void (async () => {
      try {
        const { error } = await getSupabaseClient()
          .from('it_notes')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('Failed to delete IT note:', error);
        }
      } catch (err) {
        console.error('Failed to delete IT note:', err);
      }
    })();
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
    this.generation += 1;
    this.subscribed = false;
    const ch = this.channel;
    this.channel = null;
    this.setConnected(false);

    if (ch) {
      void (async () => {
        try {
          await ch.untrack();
        } catch {
          // ignore untrack error if already disconnected
        }
        try {
          await getSupabaseClient().removeChannel(ch);
        } catch {
          // ignore channel cleanup error
        }
      })();
    }
  }
}

export const teamSocket = new TeamRealtimeClient();
