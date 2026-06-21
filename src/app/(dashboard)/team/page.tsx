"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Copy, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type InviteStatus = "active" | "used" | "expired";

type InviteRow = {
  code: string;
  role: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_email: string | null;
  status: InviteStatus;
};

type MemberRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  owner:  { bg: "rgba(45,74,45,0.12)",    color: "#2D4A2D" },
  admin:  { bg: "rgba(245,158,11,0.10)",  color: "#b45309" },
  member: { bg: "rgba(20,33,26,0.06)",    color: "#5a6a60" },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_BADGE[role] ?? ROLE_BADGE.member;
  return (
    <span style={{ ...s, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, display: "inline-block" }}>
      {role}
    </span>
  );
}

const CARD = "bg-white rounded-xl mb-6 overflow-hidden border border-[rgba(20,33,26,0.08)]";
const TH   = "text-left text-[10px] font-semibold uppercase tracking-[0.1em] py-2.5 px-4";
const TD   = "px-4 py-3 text-sm";

export default function TeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [invites,        setInvites]        = useState<InviteRow[]>([]);
  const [members,        setMembers]        = useState<MemberRow[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [showGenForm, setShowGenForm] = useState(false);
  const [genRole,     setGenRole]     = useState<"member" | "admin">("member");
  const [genDays,     setGenDays]     = useState(14);
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState("");
  const [newCode,     setNewCode]     = useState<{ code: string; expiresAt: string } | null>(null);

  const [revoking,     setRevoking]     = useState<string | null>(null);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [historyOpen,  setHistoryOpen]  = useState(false);

  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [removing,     setRemoving]     = useState(false);
  const [removeError,  setRemoveError]  = useState("");
  const [toast,        setToast]        = useState("");

  const callerRole = session?.user?.role as string | undefined;
  const callerId   = session?.user?.id   as string | undefined;

  // Role gate — members get redirected; unauthenticated users too.
  useEffect(() => {
    if (status === "loading") return;
    if (!session || callerRole === "member" || !callerRole) router.replace("/");
  }, [session, status, callerRole, router]);

  const fetchInvites = useCallback(async () => {
    const res = await fetch("/api/invites");
    if (res.ok) setInvites(await res.json());
    setLoadingInvites(false);
  }, []);

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/team/members");
    if (res.ok) setMembers(await res.json());
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !callerRole || callerRole === "member") return;
    fetchInvites();
    fetchMembers();
  }, [status, callerRole, fetchInvites, fetchMembers]);

  const generate = async () => {
    setGenError("");
    setGenerating(true);
    setNewCode(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: genRole, expiresInDays: genDays }),
      });
      const json = await res.json();
      if (!res.ok) { setGenError(json.error ?? "Failed to generate code."); return; }
      setNewCode(json);
      fetchInvites();
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (code: string) => {
    setRevoking(code);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(code)}`, { method: "DELETE" });
      if (res.ok) setInvites(prev => prev.filter(i => i.code !== code));
    } finally {
      setRevoking(null);
    }
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError("");
    try {
      const res = await fetch(`/api/team/members/${encodeURIComponent(removeTarget.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setRemoveError(json.error ?? "Failed to remove member."); return; }
      setMembers(prev => prev.filter(m => m.id !== removeTarget.id));
      setRemoveTarget(null);
      setToast(`${removeTarget.name} has been removed.`);
      setTimeout(() => setToast(""), 4000);
    } finally {
      setRemoving(false);
    }
  };

  // Show nothing while redirecting or loading session.
  if (status === "loading" || !session || !callerRole || callerRole === "member") return null;

  const activeInvites  = invites.filter(i => i.status === "active");
  const historyInvites = invites.filter(i => i.status !== "active");

  const selectStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid rgba(20,33,26,0.15)",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 13,
    color: "#0f1711",
    outline: "none",
    minWidth: 130,
    fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: 820 }}>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
          style={{ background: "#2D4A2D", color: "#fff", maxWidth: 320 }}
        >
          <Check size={14} />
          {toast}
        </div>
      )}

      {/* ── Confirmation dialog ────────────────────────────────────────────── */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full"
            style={{ maxWidth: 400, margin: "0 16px", border: "1px solid rgba(20,33,26,0.1)" }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: "#0f1711" }}>
              Remove {removeTarget.name} from the team?
            </p>
            <p className="text-xs mb-5" style={{ color: "#8a9a90" }}>
              They&apos;ll lose access immediately. This cannot be undone.
            </p>
            {removeError && (
              <p className="text-xs mb-3" style={{ color: "#EF4444" }}>{removeError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmRemove}
                disabled={removing}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: "#EF4444", opacity: removing ? 0.7 : 1, flex: 1 }}
              >
                {removing && <Loader2 size={13} className="animate-spin" />}
                Remove
              </button>
              <button
                onClick={() => { setRemoveTarget(null); setRemoveError(""); }}
                disabled={removing}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "rgba(20,33,26,0.06)", color: "#5a6a60", flex: 1 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,33,26,0.10)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,33,26,0.06)"; }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite new members ─────────────────────────────────────────────── */}
      <div className={CARD}>
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: (showGenForm || newCode) ? "1px solid rgba(20,33,26,0.07)" : "none" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#0f1711" }}>Invite new members</p>
            <p className="text-xs mt-0.5" style={{ color: "#8a9a90" }}>Generate a single-use code to share with someone joining your agency.</p>
          </div>
          <button
            onClick={() => { setShowGenForm(v => !v); setNewCode(null); setGenError(""); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors flex-shrink-0 ml-4"
            style={{ background: "#2D4A2D" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
          >
            {showGenForm ? "Cancel" : "Generate invite code"}
          </button>
        </div>

        {showGenForm && (
          <div
            className="px-6 py-4 flex flex-wrap items-end gap-3"
            style={{
              borderBottom: newCode ? "1px solid rgba(20,33,26,0.07)" : "none",
              background: "rgba(20,33,26,0.015)",
            }}
          >
            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "#5a6a60" }}>Role</label>
              <select value={genRole} onChange={e => setGenRole(e.target.value as "member" | "admin")} style={selectStyle}>
                <option value="member">Member</option>
                {callerRole === "owner" && <option value="admin">Admin</option>}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "#5a6a60" }}>Expires in</label>
              <select value={genDays} onChange={e => setGenDays(Number(e.target.value))} style={selectStyle}>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#2D4A2D", opacity: generating ? 0.7 : 1 }}
            >
              {generating && <Loader2 size={13} className="animate-spin" />}
              Generate
            </button>
            {genError && <p className="w-full text-xs" style={{ color: "#EF4444" }}>{genError}</p>}
          </div>
        )}

        {newCode && (
          <div className="px-6 py-4">
            <p className="text-xs mb-2" style={{ color: "#5a6a60" }}>
              Share this code with the person you&apos;re inviting. It expires on{" "}
              <strong>
                {new Date(newCode.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </strong>.
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 px-3 py-2 rounded-lg text-sm select-all"
                style={{
                  fontFamily: "monospace",
                  background: "rgba(20,33,26,0.05)",
                  color: "#0f1711",
                  border: "1px solid rgba(20,33,26,0.1)",
                  letterSpacing: "0.04em",
                  wordBreak: "break-all",
                }}
              >
                {newCode.code}
              </code>
              <button
                onClick={() => copy(newCode.code, "__new__")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
                style={{
                  background: copiedId === "__new__" ? "rgba(45,74,45,0.08)" : "rgba(20,33,26,0.06)",
                  color: copiedId === "__new__" ? "#2D4A2D" : "#5a6a60",
                }}
              >
                {copiedId === "__new__" ? <Check size={12} /> : <Copy size={12} />}
                {copiedId === "__new__" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Outstanding invites ────────────────────────────────────────────── */}
      <div className={CARD}>
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(20,33,26,0.07)" }}>
          <p className="text-sm font-semibold" style={{ color: "#0f1711" }}>Outstanding invites</p>
        </div>

        {loadingInvites ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin" style={{ color: "#8a9a90" }} />
          </div>
        ) : activeInvites.length === 0 ? (
          <p className="px-6 py-8 text-sm" style={{ color: "#8a9a90" }}>No active invites.</p>
        ) : (
          <table className="w-full">
            <thead style={{ borderBottom: "1px solid rgba(20,33,26,0.06)" }}>
              <tr>
                <th className={TH} style={{ color: "#8a9a90" }}>Code</th>
                <th className={TH} style={{ color: "#8a9a90" }}>Role</th>
                <th className={TH} style={{ color: "#8a9a90" }}>Created by</th>
                <th className={TH} style={{ color: "#8a9a90" }}>Expires</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {activeInvites.map((inv, i) => {
                const daysLeft = inv.expires_at
                  ? Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <tr key={inv.code} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(20,33,26,0.05)" }}>
                    <td className={TD} style={{ color: "#2a3a30" }}>
                      <div className="flex items-center gap-2">
                        <code style={{ fontFamily: "monospace", fontSize: 12, color: "#5a6a60" }}>
                          {inv.code.slice(0, 8)}…
                        </code>
                        <button
                          onClick={() => copy(inv.code, inv.code)}
                          className="flex items-center justify-center w-5 h-5 rounded transition-colors"
                          style={{
                            background: "rgba(20,33,26,0.05)",
                            color: copiedId === inv.code ? "#2D4A2D" : "#8a9a90",
                          }}
                          title="Copy full code"
                        >
                          {copiedId === inv.code ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </div>
                    </td>
                    <td className={TD}><RoleBadge role={inv.role} /></td>
                    <td className={TD} style={{ color: "#8a9a90" }}>{inv.created_by}</td>
                    <td className={TD} style={{ color: daysLeft !== null && daysLeft <= 3 ? "#b45309" : "#8a9a90" }}>
                      {daysLeft !== null ? `${daysLeft}d` : "—"}
                    </td>
                    <td className={TD} style={{ textAlign: "right" }}>
                      <button
                        onClick={() => revoke(inv.code)}
                        disabled={revoking === inv.code}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ color: "#EF4444" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        {revoking === inv.code ? <Loader2 size={11} className="animate-spin inline" /> : "Revoke"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Used / expired ─────────────────────────────────────────────────── */}
      {(!loadingInvites && historyInvites.length > 0) && (
        <div className={CARD}>
          <button
            className="w-full px-6 py-4 flex items-center justify-between text-left"
            onClick={() => setHistoryOpen(v => !v)}
          >
            <p className="text-sm font-semibold" style={{ color: "#0f1711" }}>
              Used / expired{" "}
              <span className="font-normal text-xs ml-1" style={{ color: "#8a9a90" }}>
                ({historyInvites.length})
              </span>
            </p>
            {historyOpen
              ? <ChevronUp size={14} style={{ color: "#8a9a90" }} />
              : <ChevronDown size={14} style={{ color: "#8a9a90" }} />}
          </button>

          {historyOpen && (
            <table className="w-full" style={{ borderTop: "1px solid rgba(20,33,26,0.07)" }}>
              <thead style={{ borderBottom: "1px solid rgba(20,33,26,0.06)" }}>
                <tr>
                  <th className={TH} style={{ color: "#8a9a90" }}>Code</th>
                  <th className={TH} style={{ color: "#8a9a90" }}>Role</th>
                  <th className={TH} style={{ color: "#8a9a90" }}>Status</th>
                  <th className={TH} style={{ color: "#8a9a90" }}>Used by</th>
                  <th className={TH} style={{ color: "#8a9a90" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {historyInvites.map((inv, i) => (
                  <tr key={inv.code} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(20,33,26,0.05)" }}>
                    <td className={TD}>
                      <code style={{ fontFamily: "monospace", fontSize: 12, color: "#5a6a60" }}>
                        {inv.code.slice(0, 8)}…
                      </code>
                    </td>
                    <td className={TD}><RoleBadge role={inv.role} /></td>
                    <td className={TD}>
                      <span className="text-xs" style={{ color: inv.status === "used" ? "#22863a" : "#b45309" }}>
                        {inv.status}
                      </span>
                    </td>
                    <td className={TD} style={{ color: "#8a9a90" }}>{inv.used_by_email ?? "—"}</td>
                    <td className={TD} style={{ color: "#8a9a90" }}>
                      {inv.used_at
                        ? new Date(inv.used_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : inv.expires_at
                          ? new Date(inv.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Current members ────────────────────────────────────────────────── */}
      <div className={CARD}>
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(20,33,26,0.07)" }}>
          <p className="text-sm font-semibold" style={{ color: "#0f1711" }}>Current members</p>
        </div>

        {loadingMembers ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin" style={{ color: "#8a9a90" }} />
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ borderBottom: "1px solid rgba(20,33,26,0.06)" }}>
              <tr>
                <th className={TH} style={{ color: "#8a9a90" }}>Name</th>
                <th className={TH} style={{ color: "#8a9a90" }}>Email</th>
                <th className={TH} style={{ color: "#8a9a90" }}>Role</th>
                <th className={TH} style={{ color: "#8a9a90" }}>Joined</th>
                {callerRole === "owner" && <th className={TH} />}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const canRemove = callerRole === "owner" && m.role !== "owner" && m.id !== callerId;
                return (
                  <tr key={m.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(20,33,26,0.05)" }}>
                    <td className={TD} style={{ color: "#2a3a30" }}>{m.name}</td>
                    <td className={TD} style={{ color: "#8a9a90" }}>{m.email}</td>
                    <td className={TD}><RoleBadge role={m.role} /></td>
                    <td className={TD} style={{ color: "#8a9a90" }}>
                      {new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    {callerRole === "owner" && (
                      <td className={TD} style={{ textAlign: "right" }}>
                        {canRemove && (
                          <button
                            onClick={() => { setRemoveTarget(m); setRemoveError(""); }}
                            className="text-xs px-2 py-1 rounded transition-colors"
                            style={{ color: "#EF4444" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
