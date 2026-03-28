"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Inbox,
  Send,
  Star,
  RefreshCw,
  Pencil,
  Reply,
  X,
  ChevronRight,
  Mail,
  AlertCircle,
  UserCircle,
  Building2,
  Loader2,
  Paperclip,
  Download,
  FileText,
  Image,
  File,
} from "lucide-react";
import { storage } from "@/lib/storage";
import { CandidateProfile, Client } from "@/lib/types";
import { EMAIL_TEMPLATES, applyTemplate } from "@/lib/emailTemplates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailSummary {
  id: string;
  threadId: string;
  labelIds: string[];
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface EmailFull extends EmailSummary {
  text: string;
  html: string;
  attachments: Attachment[];
}

type Tab = "inbox" | "sent" | "starred";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  return { name: raw, email: raw };
}

function formatDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) {
    return d.toLocaleDateString("nl-NL", { weekday: "short" });
  }
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatFullDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Find a candidate or client matching an email address
function findProfile(
  email: string,
  candidates: CandidateProfile[],
  clients: Client[]
): { type: "candidate" | "client"; id: string; name: string } | null {
  const lower = email.toLowerCase();
  const candidate = candidates.find((c) => c.email?.toLowerCase() === lower);
  if (candidate)
    return {
      type: "candidate",
      id: candidate.id,
      name: `${candidate.firstName} ${candidate.lastName}`,
    };
  const client = clients.find((c) => c.contactEmail?.toLowerCase() === lower);
  if (client)
    return { type: "client", id: client.id, name: client.companyName };
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AvatarBubble({ name, unread }: { name: string; unread: boolean }) {
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        unread ? "bg-[#7C3AED] text-white" : "bg-[#1e3a5f] text-[#94a3b8]"
      }`}
    >
      {initials(name) || "?"}
    </div>
  );
}

function ProfileLink({
  profile,
}: {
  profile: { type: "candidate" | "client"; id: string; name: string };
}) {
  const href = profile.type === "candidate" ? `/candidates/${profile.id}` : `/clients/${profile.id}`;
  const Icon = profile.type === "candidate" ? UserCircle : Building2;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs bg-[#7C3AED]/20 text-[#a78bfa] hover:bg-[#7C3AED]/30 px-2.5 py-1 rounded-full transition-colors"
    >
      <Icon size={11} />
      {profile.name}
      <ChevronRight size={10} />
    </Link>
  );
}

// ─── Attachment helpers ───────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image size={14} className="text-blue-400" />;
  if (mimeType === 'application/pdf' || mimeType.includes('word') || mimeType.includes('document'))
    return <FileText size={14} className="text-red-400" />;
  return <File size={14} className="text-[#94a3b8]" />;
}

async function downloadAttachment(tokens: object, attachment: Attachment) {
  const res = await fetch('/api/gmail/attachment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokens,
      messageId: attachment.messageId,
      attachmentId: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    }),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Compose / Reply Modal ────────────────────────────────────────────────────

interface ComposeProps {
  tokens: object;
  defaultTo?: string;
  defaultSubject?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  onClose: () => void;
  onSent: () => void;
  candidates: CandidateProfile[];
  clients: Client[];
}

// Detect which {{variables}} remain unreplaced in a string
function unreplacedVars(text: string): string[] {
  return Array.from(new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));
}

function ComposeModal({
  tokens,
  defaultTo = "",
  defaultSubject = "",
  threadId,
  inReplyTo,
  references,
  onClose,
  onSent,
  candidates,
  clients,
}: ComposeProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const isReply = !!threadId;

  function buildVars(candidateId: string, clientId: string, role: string) {
    const candidate = candidates.find((c) => c.id === candidateId);
    const client = clients.find((c) => c.id === clientId);
    return {
      candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : "",
      clientName: client?.companyName ?? "",
      jobTitle: role,
      role,
      date: new Date().toLocaleDateString("nl-NL"),
    };
  }

  function applyTemplateLocal(id: string, candidateId = selectedCandidateId, clientId = selectedClientId, role = selectedRole) {
    setTemplate(id);
    if (!id) return;
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const applied = applyTemplate(tpl, buildVars(candidateId, clientId, role));
    setSubject(applied.subject);
    setBody(applied.body);
  }

  function handleContextChange(field: "candidate" | "client" | "role", value: string) {
    const newCandidate = field === "candidate" ? value : selectedCandidateId;
    const newClient = field === "client" ? value : selectedClientId;
    const newRole = field === "role" ? value : selectedRole;
    if (field === "candidate") setSelectedCandidateId(value);
    if (field === "client") setSelectedClientId(value);
    if (field === "role") setSelectedRole(value);
    if (template) applyTemplateLocal(template, newCandidate, newClient, newRole);
  }

  async function handleSend() {
    if (!to || !subject || !body) {
      setError("Please fill in To, Subject and Body.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const endpoint = isReply ? "/api/gmail/reply" : "/api/gmail/send";
      const payload = isReply
        ? { tokens, threadId, to, subject, body, inReplyTo, references }
        : { tokens, to, subject, body };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      onSent();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
          <h2 className="text-white font-semibold text-sm">
            {isReply ? "Reply" : "New Email"}
          </h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-3">
          {!isReply && (
            <>
              <div>
                <label className="block text-[#94a3b8] text-xs font-medium mb-1">Template</label>
                <select
                  value={template}
                  onChange={(e) => applyTemplateLocal(e.target.value)}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED]"
                >
                  <option value="">— select a template —</option>
                  {EMAIL_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Context variables — shown when a template is selected */}
              {template && (
                <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3 space-y-2">
                  <p className="text-[#4a6fa5] text-[11px] font-medium uppercase tracking-wide mb-2">Template variables</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[#94a3b8] text-[11px] mb-1">Candidate</label>
                      <select
                        value={selectedCandidateId}
                        onChange={(e) => handleContextChange("candidate", e.target.value)}
                        className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#7C3AED]"
                      >
                        <option value="">— none —</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#94a3b8] text-[11px] mb-1">Client</label>
                      <select
                        value={selectedClientId}
                        onChange={(e) => handleContextChange("client", e.target.value)}
                        className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#7C3AED]"
                      >
                        <option value="">— none —</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.companyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#94a3b8] text-[11px] mb-1">Role / Job title</label>
                      <input
                        type="text"
                        value={selectedRole}
                        onChange={(e) => handleContextChange("role", e.target.value)}
                        placeholder="e.g. Developer"
                        className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED]"
                      />
                    </div>
                  </div>
                  {/* Warn about remaining unfilled placeholders */}
                  {(() => {
                    const remaining = unreplacedVars(subject + " " + body);
                    if (!remaining.length) return null;
                    return (
                      <p className="text-amber-400 text-[11px] flex items-center gap-1 mt-1">
                        <AlertCircle size={11} />
                        Unfilled: {remaining.map((v) => `{{${v}}}`).join(", ")}
                      </p>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your message..."
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] resize-none font-mono leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#1e3a5f]">
          <p className="text-[#4a6fa5] text-xs">Sending from dani@truenorthtalent.nl</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-[#1e3a5f] text-[#94a3b8] hover:text-white hover:bg-[#2a4f7a] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 rounded-lg text-sm bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {sending && <Loader2 size={13} className="animate-spin" />}
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailPage() {
  const [tokens, setTokens] = useState<object | null>(null);
  const [tab, setTab] = useState<Tab>("inbox");
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailFull | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [error, setError] = useState("");
  const [compose, setCompose] = useState(false);
  const [replying, setReplying] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-OAuth modal state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectEmail, setConnectEmail] = useState("");

  // Load token and data from localStorage on mount
  useEffect(() => {
    const raw = storage.getGmailToken();
    if (raw) {
      try {
        setTokens(JSON.parse(raw));
      } catch {}
    }
    setCandidates(storage.getCandidateProfiles());
    setClients(storage.getClients());

    // Listen for gmail_connected message from OAuth popup
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "gmail_connected") {
        const t = storage.getGmailToken();
        if (t) {
          try { setTokens(JSON.parse(t)); } catch {}
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const fetchList = useCallback(
    async (tk: object, currentTab: Tab) => {
      setLoadingList(true);
      setError("");
      try {
        const res = await fetch("/api/gmail/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens: tk, tab: currentTab }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        setEmails(data.messages || []);
        setLastRefresh(new Date());
      } catch (e: any) {
        setError(e.message || "Failed to load emails.");
      } finally {
        setLoadingList(false);
      }
    },
    []
  );

  const fetchEmail = useCallback(async (tk: object, id: string) => {
    setLoadingEmail(true);
    try {
      const res = await fetch("/api/gmail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: tk, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSelectedEmail(data);
    } catch (e: any) {
      setError(e.message || "Failed to load email.");
    } finally {
      setLoadingEmail(false);
    }
  }, []);

  // Fetch list when tokens or tab change
  useEffect(() => {
    if (!tokens) return;
    setSelectedId(null);
    setSelectedEmail(null);
    fetchList(tokens, tab);
  }, [tokens, tab, fetchList]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!tokens) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchList(tokens, tab);
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tokens, tab, fetchList]);

  // Fetch full email when selection changes
  useEffect(() => {
    if (!tokens || !selectedId) return;
    fetchEmail(tokens, selectedId);
  }, [tokens, selectedId, fetchEmail]);

  function openConnectModal() {
    setConnectEmail("");
    setShowConnectModal(true);
  }

  function startOAuth() {
    if (!connectEmail.trim()) return;
    setShowConnectModal(false);
    const hint = encodeURIComponent(connectEmail.trim());
    const popup = window.open(
      `/api/gmail/auth?login_hint=${hint}`,
      "gmail-auth",
      "width=520,height=660"
    );
    if (!popup) return;
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        const raw = storage.getGmailToken();
        if (raw) {
          try { setTokens(JSON.parse(raw)); } catch {}
        }
      }
    }, 500);
  }

  function disconnectGmail() {
    storage.clearGmailToken();
    setTokens(null);
    setEmails([]);
    setSelectedId(null);
    setSelectedEmail(null);
  }

  // ── Not connected state ──────────────────────────────────────────────────────
  if (!tokens) {
    return (
      <>
        <div className="p-8 flex flex-col items-center justify-center min-h-[80vh]">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-10 text-center max-w-md w-full">
            <div className="w-14 h-14 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-5">
              <Mail size={24} className="text-[#7C3AED]" />
            </div>
            <h2 className="text-white font-bold text-lg mb-2">Connect Gmail</h2>
            <p className="text-[#94a3b8] text-sm mb-8 leading-relaxed">
              Connect your Gmail account to view your inbox, send emails and
              track communication directly from the dashboard.
            </p>
            <button
              onClick={openConnectModal}
              className="w-full bg-[#7C3AED] hover:bg-[#6d28d9] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Mail size={15} />
              Connect Gmail Account
            </button>
          </div>
        </div>

        {/* Pre-OAuth email modal */}
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl w-full max-w-sm shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                    <Mail size={13} className="text-[#7C3AED]" />
                  </div>
                  <h2 className="text-white font-semibold text-sm">Connect your Gmail</h2>
                </div>
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="text-[#94a3b8] hover:text-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5 space-y-4">
                <p className="text-[#94a3b8] text-sm leading-relaxed">
                  Enter the Gmail address you want to connect. Google will then
                  ask you to confirm the account and grant access.
                </p>
                <div>
                  <label className="block text-[#94a3b8] text-xs font-medium mb-1.5">
                    Gmail address
                  </label>
                  <input
                    type="email"
                    value={connectEmail}
                    onChange={(e) => setConnectEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && connectEmail.trim() && startOAuth()}
                    placeholder="dani@truenorthtalent.nl"
                    autoFocus
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED]"
                  />
                  <p className="text-[#4a6fa5] text-[11px] mt-1.5">
                    Google will always show the account picker so you can confirm
                    the right account is selected.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2 px-5 py-4 border-t border-[#1e3a5f]">
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#1e3a5f] text-[#94a3b8] hover:text-white hover:bg-[#2a4f7a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startOAuth}
                  disabled={!connectEmail.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#7C3AED] hover:bg-[#6d28d9] text-white font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Mail size={13} />
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "inbox", label: "Inbox", icon: <Inbox size={14} /> },
    { key: "sent", label: "Sent", icon: <Send size={14} /> },
    { key: "starred", label: "Starred", icon: <Star size={14} /> },
  ];

  // Selected email sender profile
  const senderProfile = selectedEmail
    ? findProfile(parseAddress(selectedEmail.from).email, candidates, clients)
    : null;

  return (
    <div className="flex flex-col -m-8 h-screen overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f] flex-shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold text-white leading-none">Inbox</h1>
            <p className="text-[#94a3b8] text-xs mt-0.5">dani@truenorthtalent.nl</p>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  tab === t.key
                    ? "bg-[#7C3AED] text-white"
                    : "text-[#94a3b8] hover:text-white"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[#4a6fa5] text-xs hidden lg:block">
              Updated {lastRefresh.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => tokens && fetchList(tokens, tab)}
            disabled={loadingList}
            className="p-2 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#1e3a5f] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loadingList ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setCompose(true)}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Pencil size={13} />
            Compose
          </button>
          <button
            onClick={disconnectGmail}
            className="px-3 py-2 rounded-lg text-xs text-[#94a3b8] hover:text-white bg-[#1e3a5f] hover:bg-[#2a4f7a] transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* ── Body: list + reader ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Email list */}
        <div
          className={`flex-shrink-0 border-r border-[#1e3a5f] overflow-y-auto ${
            selectedEmail ? "w-80 xl:w-96" : "flex-1"
          }`}
        >
          {error && (
            <div className="m-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {loadingList && emails.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-[#7C3AED]" />
            </div>
          )}

          {!loadingList && emails.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-[#4a6fa5]">
              <Inbox size={32} className="mb-3 opacity-50" />
              <p className="text-sm">No emails in {tab}</p>
            </div>
          )}

          {emails.map((email) => {
            const sender = parseAddress(tab === "sent" ? email.to : email.from);
            const profile = findProfile(sender.email, candidates, clients);
            const isSelected = selectedId === email.id;

            return (
              <button
                key={email.id}
                onClick={() => setSelectedId(email.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-[#1e3a5f]/50 transition-colors ${
                  isSelected
                    ? "bg-[#7C3AED]/10 border-l-2 border-l-[#7C3AED]"
                    : "hover:bg-[#1e3a5f]/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AvatarBubble name={sender.name || sender.email} unread={email.unread} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-sm truncate ${
                            email.unread ? "font-semibold text-white" : "text-[#94a3b8]"
                          }`}
                        >
                          {sender.name || sender.email}
                        </span>
                        {profile && (
                          <span className="text-[10px] bg-[#7C3AED]/20 text-[#a78bfa] px-1.5 py-0.5 rounded flex-shrink-0">
                            {profile.type === "candidate" ? "Candidate" : "Client"}
                          </span>
                        )}
                      </div>
                      <span className="text-[#4a6fa5] text-[11px] flex-shrink-0">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <p
                      className={`text-xs mb-1 truncate ${
                        email.unread ? "text-white" : "text-[#94a3b8]"
                      }`}
                    >
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-[11px] text-[#4a6fa5] truncate">{email.snippet}</p>
                  </div>
                  {email.unread && (
                    <div className="w-2 h-2 rounded-full bg-[#7C3AED] mt-1.5 flex-shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Reading panel */}
        {selectedId && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {loadingEmail ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 size={20} className="animate-spin text-[#7C3AED]" />
              </div>
            ) : selectedEmail ? (
              <>
                {/* Email header */}
                <div className="px-6 py-5 border-b border-[#1e3a5f] flex-shrink-0">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h2 className="text-white font-bold text-lg leading-snug">
                      {selectedEmail.subject || "(no subject)"}
                    </h2>
                    <button
                      onClick={() => { setSelectedId(null); setSelectedEmail(null); }}
                      className="text-[#94a3b8] hover:text-white transition-colors flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex items-start gap-3">
                    <AvatarBubble
                      name={parseAddress(selectedEmail.from).name || parseAddress(selectedEmail.from).email}
                      unread={false}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium">
                          {parseAddress(selectedEmail.from).name || parseAddress(selectedEmail.from).email}
                        </span>
                        <span className="text-[#4a6fa5] text-xs">
                          &lt;{parseAddress(selectedEmail.from).email}&gt;
                        </span>
                        {senderProfile && <ProfileLink profile={senderProfile} />}
                      </div>
                      <p className="text-[#4a6fa5] text-xs mt-0.5">
                        To: {selectedEmail.to}
                      </p>
                      <p className="text-[#4a6fa5] text-xs mt-0.5">
                        {formatFullDate(selectedEmail.date)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 px-6 py-6">
                  <div className="max-w-2xl">
                    {selectedEmail.html ? (
                      <iframe
                        srcDoc={selectedEmail.html}
                        sandbox="allow-same-origin"
                        className="w-full min-h-[400px] border-0 bg-white rounded-lg"
                        style={{ colorScheme: "light" }}
                        onLoad={(e) => {
                          const iframe = e.currentTarget;
                          iframe.style.height =
                            (iframe.contentDocument?.body?.scrollHeight || 400) + 32 + "px";
                        }}
                      />
                    ) : (
                      <pre className="text-[#94a3b8] text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {selectedEmail.text || selectedEmail.snippet || "(no content)"}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Attachments */}
                {selectedEmail.attachments?.length > 0 && (
                  <div className="px-6 py-4 border-t border-[#1e3a5f] flex-shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip size={13} className="text-[#94a3b8]" />
                      <span className="text-[#94a3b8] text-xs font-medium">
                        {selectedEmail.attachments.length} attachment{selectedEmail.attachments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((att) => (
                        <button
                          key={att.id}
                          onClick={() => tokens && downloadAttachment(tokens, att)}
                          className="flex items-center gap-2.5 bg-[#0a1628] hover:bg-[#1e3a5f] border border-[#1e3a5f] hover:border-[#7C3AED] rounded-lg px-3 py-2 transition-colors group"
                        >
                          <AttachmentIcon mimeType={att.mimeType} />
                          <div className="text-left">
                            <p className="text-white text-xs font-medium truncate max-w-[180px]">{att.filename}</p>
                            <p className="text-[#4a6fa5] text-[10px]">{formatBytes(att.size)}</p>
                          </div>
                          <Download size={12} className="text-[#4a6fa5] group-hover:text-[#7C3AED] transition-colors ml-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply bar */}
                <div className="px-6 py-4 border-t border-[#1e3a5f] flex-shrink-0">
                  <button
                    onClick={() => setReplying(true)}
                    className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Reply size={14} />
                    Reply
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Empty state when nothing selected */}
        {!selectedId && !loadingList && emails.length > 0 && (
          <div className="hidden xl:flex flex-1 items-center justify-center text-[#4a6fa5]">
            <div className="text-center">
              <Mail size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select an email to read</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Compose modal ─────────────────────────────────────────────────────── */}
      {compose && tokens && (
        <ComposeModal
          tokens={tokens}
          candidates={candidates}
          clients={clients}
          onClose={() => setCompose(false)}
          onSent={() => fetchList(tokens, tab)}
        />
      )}

      {/* ── Reply modal ───────────────────────────────────────────────────────── */}
      {replying && tokens && selectedEmail && (
        <ComposeModal
          tokens={tokens}
          candidates={candidates}
          clients={clients}
          defaultTo={parseAddress(selectedEmail.from).email}
          defaultSubject={selectedEmail.subject}
          threadId={selectedEmail.threadId}
          onClose={() => setReplying(false)}
          onSent={() => {
            setReplying(false);
            fetchList(tokens, tab);
          }}
        />
      )}
    </div>
  );
}
