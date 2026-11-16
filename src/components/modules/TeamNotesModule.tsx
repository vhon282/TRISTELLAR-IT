import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Hash,
  Send,
  StickyNote,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Pencil,
  Download,
  BookmarkPlus,
  MessageSquareText,
  Users,
  Tag,
  MapPin,
  Wifi,
  WifiOff,
  Check,
} from 'lucide-react';
import {
  Asset,
  ChatChannel,
  ItNote,
  NoteCategory,
  OnlinePresenceUser,
  TeamChatMessage,
} from '../../types/cmms';
import { BRANCHES, TECHNICIANS } from '../../data/seedData';
import { exportToCsv, generateUid } from '../../utils/csv';
import { Modal } from '../ui/Modal';

interface TeamNotesModuleProps {
  messages: TeamChatMessage[];
  notes: ItNote[];
  onlineUsers: OnlinePresenceUser[];
  wsConnected: boolean;
  assets: Asset[];
  operatorName: string;
  onChangeOperatorName: (name: string) => void;
  onSendMessage: (msg: TeamChatMessage) => void;
  onDeleteMessage: (id: string) => void;
  onUpsertNote: (note: ItNote) => void;
  onDeleteNote: (id: string) => void;
  onJumpToAsset: (assetCodeOrBranch: string) => void;
  onJumpToMaintenance: (assetCode: string) => void;
}

const CHANNELS: { id: ChatChannel; label: string; description: string }[] = [
  {
    id: 'general-it',
    label: 'general-it',
    description: 'Daily IT shift coordination & urgent alerts',
  },
  {
    id: 'branch-support',
    label: 'branch-support',
    description: 'Branch POS, network, CCTV & AnyDesk dispatch',
  },
  {
    id: 'maintenance-ops',
    label: 'maintenance-ops',
    description: 'Quarterly PM schedules & checklists',
  },
  {
    id: 'parts-procurement',
    label: 'parts-procurement',
    description: 'Spare parts stock, Jack requests & turnovers',
  },
];

const NOTE_CATEGORIES: NoteCategory[] = [
  'Handover',
  'Runbook',
  'Incident',
  'Maintenance',
  'Config',
];

const CATEGORY_STYLES: Record<NoteCategory, string> = {
  Handover:
    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  Runbook:
    'bg-stone-200 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700',
  Incident:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
  Maintenance:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  Config:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
};

const OPERATOR_PRESETS = [...TECHNICIANS, 'IT Admin'] as const;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOperatorRole(name: string): string {
  if (name === 'Mac') return 'IT Lead';
  if (name === 'Francis') return 'IT Support';
  if (name === 'Vhon') return 'IT Support';
  if (name === 'IT Admin') return 'Administrator';
  return 'IT Technician';
}

export const TeamNotesModule: React.FC<TeamNotesModuleProps> = ({
  messages,
  notes,
  onlineUsers,
  wsConnected,
  assets,
  operatorName,
  onChangeOperatorName,
  onSendMessage,
  onDeleteMessage,
  onUpsertNote,
  onDeleteNote,
  onJumpToAsset,
  onJumpToMaintenance,
}) => {
  const [mobilePane, setMobilePane] = useState<'chat' | 'notes'>('chat');
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('general-it');
  const [customOperatorMode, setCustomOperatorMode] = useState(
    !OPERATOR_PRESETS.includes(operatorName as (typeof OPERATOR_PRESETS)[number])
  );
  const [customOperatorInput, setCustomOperatorInput] = useState(operatorName);

  // Chat composer state
  const [draftMessage, setDraftMessage] = useState('');
  const [chatAssetCode, setChatAssetCode] = useState('');
  const [chatBranch, setChatBranch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Notes filter & modal state
  const [noteSearch, setNoteSearch] = useState('');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<'ALL' | NoteCategory>('ALL');
  const [noteBranchFilter, setNoteBranchFilter] = useState<string>('ALL');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ItNote | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('Handover');
  const [noteBranch, setNoteBranch] = useState<string>('All Branches');
  const [noteAssetCode, setNoteAssetCode] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePinned, setNotePinned] = useState(false);

  const channelMessages = useMemo(
    () => messages.filter((m) => m.channel === activeChannel),
    [messages, activeChannel]
  );

  const channelCounts = useMemo(() => {
    const counts: Record<ChatChannel, number> = {
      'general-it': 0,
      'branch-support': 0,
      'maintenance-ops': 0,
      'parts-procurement': 0,
    };
    for (const m of messages) {
      if (counts[m.channel] !== undefined) counts[m.channel] += 1;
    }
    return counts;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [channelMessages.length, activeChannel]);

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (noteCategoryFilter !== 'ALL' && n.category !== noteCategoryFilter) {
          return false;
        }
        if (noteBranchFilter !== 'ALL' && n.branchLocation !== noteBranchFilter) {
          return false;
        }
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.author.toLowerCase().includes(q) ||
          (n.assetCode && n.assetCode.toLowerCase().includes(q)) ||
          n.branchLocation.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, noteSearch, noteCategoryFilter, noteBranchFilter]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = draftMessage.trim();
    if (!content) return;

    const msg: TeamChatMessage = {
      id: generateUid('msg'),
      channel: activeChannel,
      sender: operatorName.trim() || 'IT Tech',
      senderRole: getOperatorRole(operatorName.trim() || 'IT Tech'),
      content,
      assetCode: chatAssetCode || undefined,
      branchLocation: chatBranch || undefined,
      createdAt: new Date().toISOString(),
    };
    onSendMessage(msg);
    setDraftMessage('');
  };

  const openNewNoteModal = (prefill?: {
    title?: string;
    content?: string;
    category?: NoteCategory;
    branchLocation?: string;
    assetCode?: string;
  }) => {
    setEditingNote(null);
    setNoteTitle(prefill?.title ?? '');
    setNoteCategory(prefill?.category ?? 'Handover');
    setNoteBranch(prefill?.branchLocation || 'All Branches');
    setNoteAssetCode(prefill?.assetCode ?? '');
    setNoteContent(prefill?.content ?? '');
    setNotePinned(false);
    setNoteModalOpen(true);
  };

  const openEditNoteModal = (note: ItNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteCategory(note.category);
    setNoteBranch(note.branchLocation || 'All Branches');
    setNoteAssetCode(note.assetCode || '');
    setNoteContent(note.content);
    setNotePinned(note.pinned);
    setNoteModalOpen(true);
  };

  const handlePromoteChatToNote = (msg: TeamChatMessage) => {
    const channelCategory: Record<ChatChannel, NoteCategory> = {
      'general-it': 'Handover',
      'branch-support': 'Incident',
      'maintenance-ops': 'Maintenance',
      'parts-procurement': 'Handover',
    };
    openNewNoteModal({
      title: `Chat Log (${msg.sender} · #${msg.channel})`,
      content: msg.content,
      category: channelCategory[msg.channel],
      branchLocation: msg.branchLocation || 'All Branches',
      assetCode: msg.assetCode || '',
    });
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const note: ItNote = {
      id: editingNote ? editingNote.id : generateUid('note'),
      title: noteTitle.trim() || 'Untitled IT Note',
      content: noteContent.trim(),
      category: noteCategory,
      branchLocation: noteBranch || 'All Branches',
      assetCode: noteAssetCode.trim() || undefined,
      author: editingNote?.author || operatorName.trim() || 'IT Tech',
      pinned: notePinned,
      createdAt: editingNote?.createdAt || now,
      updatedAt: now,
    };
    onUpsertNote(note);
    setNoteModalOpen(false);
  };

  const handleTogglePin = (note: ItNote) => {
    onUpsertNote({
      ...note,
      pinned: !note.pinned,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleExportNotes = () => {
    exportToCsv(
      `tristellar-it-notes-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        { key: 'branchLocation', label: 'Branch Location' },
        { key: 'assetCode', label: 'Asset Code' },
        { key: 'author', label: 'Author' },
        { key: 'pinned', label: 'Pinned', format: (r) => (r.pinned ? 'Yes' : 'No') },
        { key: 'content', label: 'Content' },
        { key: 'updatedAt', label: 'Last Updated' },
      ],
      filteredNotes
    );
  };

  const activeChannelMeta =
    CHANNELS.find((c) => c.id === activeChannel) || CHANNELS[0];

  return (
    <div className="space-y-4">
      {/* Header & Operator Presence Bar */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-display font-bold text-stone-900 dark:text-stone-100">
              Team Chat &amp; Shared IT Notes
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${
                wsConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {wsConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {wsConnected ? 'Live Sync Active' : 'Reconnecting'}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Real-time IT support channels, shift handovers, and pinned branch runbooks across TRISTELLAR IT DEPT.
          </p>
        </div>

        {/* Active Operator Switcher + Online Presence */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 whitespace-nowrap">
              Posting as:
            </span>
            {!customOperatorMode ? (
              <select
                value={
                  OPERATOR_PRESETS.includes(
                    operatorName as (typeof OPERATOR_PRESETS)[number]
                  )
                    ? operatorName
                    : 'custom'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setCustomOperatorMode(true);
                    setCustomOperatorInput(operatorName);
                  } else {
                    onChangeOperatorName(val);
                  }
                }}
                aria-label="Select active IT operator"
                className="text-xs font-semibold bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
              >
                {OPERATOR_PRESETS.map((op) => (
                  <option
                    key={op}
                    value={op}
                    className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    {op}
                  </option>
                ))}
                <option
                  value="custom"
                  className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                >
                  Custom Name...
                </option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customOperatorInput}
                  onChange={(e) => setCustomOperatorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customOperatorInput.trim()) {
                      onChangeOperatorName(customOperatorInput.trim());
                      setCustomOperatorMode(false);
                    }
                  }}
                  placeholder="Your name"
                  className="w-24 text-xs px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customOperatorInput.trim()) {
                      onChangeOperatorName(customOperatorInput.trim());
                    }
                    setCustomOperatorMode(false);
                  }}
                  aria-label="Apply custom operator name"
                  className="p-1 rounded bg-orange-600 text-white hover:bg-orange-700"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Online Technicians */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400 mr-0.5 whitespace-nowrap">
              <Users className="w-3.5 h-3.5" />
              Online ({onlineUsers.length}):
            </span>
            {onlineUsers.map((u) => (
              <span
                key={u.clientId}
                title={u.role}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 whitespace-nowrap"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {u.userName}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile View Switcher */}
      <div className="flex lg:hidden bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setMobilePane('chat')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            mobilePane === 'chat'
              ? 'bg-orange-600 text-white'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          Team Chat ({messages.length})
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('notes')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            mobilePane === 'notes'
              ? 'bg-orange-600 text-white'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <StickyNote className="w-3.5 h-3.5" />
          IT Notes ({notes.length})
        </button>
      </div>

      {/* Dual-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT PANE: TEAM CHAT */}
        <section
          className={`lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl flex flex-col overflow-hidden h-[660px] ${
            mobilePane === 'chat' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Channel Tabs */}
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {CHANNELS.map((ch) => {
                const active = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannel(ch.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                      active
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Hash className="w-3 h-3" />
                    <span>{ch.label}</span>
                    <span
                      className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                        active
                          ? 'bg-orange-700 text-orange-50'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                      }`}
                    >
                      {channelCounts[ch.id]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              #{activeChannelMeta.label} — {activeChannelMeta.description}
            </p>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {channelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-stone-400 dark:text-stone-500">
                <MessageSquareText className="w-8 h-8 mb-2 opacity-60" />
                <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
                  No messages in #{activeChannel} yet
                </p>
                <p className="text-[11px] mt-0.5">
                  Send an update below to start collaborating with the IT team.
                </p>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isSelf =
                  msg.sender.toLowerCase() === operatorName.trim().toLowerCase();
                return (
                  <div
                    key={msg.id}
                    className={`group rounded-xl border p-3 transition-colors ${
                      isSelf
                        ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/80 dark:border-orange-900/50'
                        : 'bg-stone-50/70 dark:bg-stone-950/50 border-stone-200/80 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-orange-600 text-white font-display font-bold text-[10px] shrink-0">
                          {msg.sender.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {msg.sender}
                        </span>
                        {msg.senderRole && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium">
                            {msg.senderRole}
                          </span>
                        )}
                        <span className="font-mono tabular-nums text-[10px] text-stone-400 dark:text-stone-500">
                          {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePromoteChatToNote(msg)}
                          title="Save message as IT Note"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800 whitespace-nowrap"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          <span className="hidden sm:inline">Save Note</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          title="Delete message"
                          aria-label="Delete message"
                          className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-stone-800 dark:text-stone-200 mt-2 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>

                    {(msg.assetCode || msg.branchLocation) && (
                      <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2 border-t border-stone-200/60 dark:border-stone-800/70">
                        {msg.branchLocation && (
                          <button
                            type="button"
                            onClick={() => onJumpToAsset(msg.branchLocation!)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            {msg.branchLocation}
                          </button>
                        )}
                        {msg.assetCode && (
                          <button
                            type="button"
                            onClick={() => onJumpToMaintenance(msg.assetCode!)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-100/70 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {msg.assetCode}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSendChat}
            className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={chatBranch}
                onChange={(e) => setChatBranch(e.target.value)}
                aria-label="Tag branch location"
                className="text-[11px] px-2.5 py-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="">Tag Branch (Optional)</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                value={chatAssetCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setChatAssetCode(code);
                  if (code && !chatBranch) {
                    const matched = assets.find((a) => a.assetCode === code);
                    if (matched) setChatBranch(matched.branchLocation);
                  }
                }}
                aria-label="Tag asset code"
                className="text-[11px] px-2.5 py-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 max-w-[240px]"
              >
                <option value="">Tag Asset (Optional)</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.assetCode}>
                    {a.assetCode} — {a.equipmentName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder={`Message #${activeChannel} as ${operatorName}... (Enter to send)`}
                className="flex-1 resize-none text-xs px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <button
                type="submit"
                disabled={!draftMessage.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </form>
        </section>

        {/* RIGHT PANE: SHARED IT NOTES */}
        <section
          className={`lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl flex flex-col overflow-hidden h-[660px] ${
            mobilePane === 'notes' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Notes Header & Toolbar */}
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <h2 className="text-sm font-display font-bold text-stone-900 dark:text-stone-100">
                  Shared IT Notes
                </h2>
                <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  {filteredNotes.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExportNotes}
                  title="Export filtered notes to CSV"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => openNewNoteModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Note
                </button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="relative sm:col-span-6">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="Search notes, asset code..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              <select
                value={noteCategoryFilter}
                onChange={(e) =>
                  setNoteCategoryFilter(e.target.value as 'ALL' | NoteCategory)
                }
                aria-label="Filter notes by category"
                className="sm:col-span-3 text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none"
              >
                <option value="ALL">All Types</option>
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={noteBranchFilter}
                onChange={(e) => setNoteBranchFilter(e.target.value)}
                aria-label="Filter notes by branch"
                className="sm:col-span-3 text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none"
              >
                <option value="ALL">All Branches</option>
                <option value="All Branches">Global</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {filteredNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-stone-400 dark:text-stone-500">
                <StickyNote className="w-8 h-8 mb-2 opacity-60" />
                <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
                  No matching IT notes found
                </p>
                <p className="text-[11px] mt-0.5">
                  Create a handover note, branch config memo, or incident runbook.
                </p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <article
                  key={note.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    note.pinned
                      ? 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/70'
                      : 'bg-white dark:bg-stone-950/40 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${
                          CATEGORY_STYLES[note.category]
                        }`}
                      >
                        {note.category}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 whitespace-nowrap">
                        <MapPin className="w-2.5 h-2.5" />
                        {note.branchLocation}
                      </span>
                      {note.assetCode && (
                        <button
                          type="button"
                          onClick={() => onJumpToMaintenance(note.assetCode!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-100/80 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 hover:underline whitespace-nowrap"
                        >
                          {note.assetCode}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(note)}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                        className={`p-1 rounded transition-colors ${
                          note.pinned
                            ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/50'
                            : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        {note.pinned ? (
                          <Pin className="w-3.5 h-3.5" />
                        ) : (
                          <PinOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditNoteModal(note)}
                        title="Edit note"
                        aria-label="Edit note"
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        title="Delete note"
                        aria-label="Delete note"
                        className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-2">
                    {note.title}
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-stone-200/60 dark:border-stone-800/70 text-[10px] text-stone-400 dark:text-stone-500">
                    <span>By {note.author}</span>
                    <span className="font-mono tabular-nums">
                      Updated {formatTimestamp(note.updatedAt)}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Add / Edit IT Note Modal */}
      <Modal
        isOpen={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        title={editingNote ? 'Edit Shared IT Note' : 'New Shared IT Note'}
        subtitle="Shared across all connected TRISTELLAR IT DEPT. operators in real time."
        maxWidthClass="max-w-xl"
      >
        <form id="it-note-form" onSubmit={handleSaveNote} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Note Title
            </label>
            <input
              type="text"
              required
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g., Conchu Router Failover Steps or Shift Handover"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Category
              </label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as NoteCategory)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Branch Location
              </label>
              <select
                value={noteBranch}
                onChange={(e) => setNoteBranch(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="All Branches">All Branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Asset Code (Optional)
              </label>
              <select
                value={noteAssetCode}
                onChange={(e) => setNoteAssetCode(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="">None</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.assetCode}>
                    {a.assetCode} — {a.equipmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Details / Procedure
            </label>
            <textarea
              required
              rows={5}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write operational steps, IP details, incident findings, or technician handover instructions..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notePinned}
              onChange={(e) => setNotePinned(e.target.checked)}
              className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
            />
            Pin this note to the top of Shared IT Notes
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setNoteModalOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700"
            >
              {editingNote ? 'Save Changes' : 'Publish Note'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
