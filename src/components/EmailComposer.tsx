'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Send, BookOpen, Wifi, WifiOff } from 'lucide-react';
import { TimelineEntry } from '@/lib/types';
import { EMAIL_TEMPLATES, applyTemplate } from '@/lib/emailTemplates';
import { v4 as uuidv4 } from 'uuid';

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  vars?: Record<string, string>;
  onSent: (entry: TimelineEntry) => void;
}

export default function EmailComposer({
  isOpen,
  onClose,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  vars = {},
  onSent,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [gmailToken, setGmailToken] = useState<Record<string, unknown> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setSelectedTemplate('');
      setError('');
      // Check for Gmail token
      try {
        const tokenStr = localStorage.getItem('tnt_gmail_token');
        if (tokenStr) {
          setGmailToken(JSON.parse(tokenStr));
        } else {
          setGmailToken(null);
        }
      } catch {
        setGmailToken(null);
      }
    }
  }, [isOpen, defaultTo, defaultSubject, defaultBody]);

  // Listen for gmail_connected message from popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'gmail_connected') {
        try {
          const tokenStr = localStorage.getItem('tnt_gmail_token');
          if (tokenStr) setGmailToken(JSON.parse(tokenStr));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const tmpl = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    const applied = applyTemplate(tmpl, vars);
    setSubject(applied.subject);
    setBody(applied.body);
  };

  const connectGmail = () => {
    window.open('/api/gmail/auth', '_blank', 'width=500,height=600');
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!gmailToken) {
      setError('Gmail not connected. Please connect first.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: gmailToken, to, subject, body }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send email');
      }
      const entry: TimelineEntry = {
        id: uuidv4(),
        type: 'email_sent',
        content: `Email sent to ${to}\nSubject: ${subject}\n\n${body}`,
        createdAt: new Date().toISOString(),
        metadata: { to, subject },
      };
      onSent(entry);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  };

  const handleLogOnly = () => {
    if (!to.trim() || !subject.trim()) {
      setError('Please fill in To and Subject fields.');
      return;
    }
    const entry: TimelineEntry = {
      id: uuidv4(),
      type: 'email_sent',
      content: `Email logged (not sent via Gmail) to ${to}\nSubject: ${subject}\n\n${body}`,
      createdAt: new Date().toISOString(),
      metadata: { to, subject, method: 'logged_only' },
    };
    onSent(entry);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#7C3AED20] flex items-center justify-center">
              <Mail size={16} className="text-[#7C3AED]" />
            </div>
            <h2 className="text-white font-semibold">Compose Email</h2>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Gmail status */}
        <div className="mb-4 flex items-center justify-between bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            {gmailToken ? (
              <>
                <Wifi size={14} className="text-[#10b981]" />
                <span className="text-[#10b981] text-xs font-medium">Gmail connected</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-[#94a3b8]" />
                <span className="text-[#94a3b8] text-xs">Gmail not connected</span>
              </>
            )}
          </div>
          {!gmailToken && (
            <button
              onClick={connectGmail}
              className="text-xs text-[#7C3AED] hover:text-[#6d28d9] font-medium transition-colors"
            >
              Connect Gmail →
            </button>
          )}
        </div>

        {/* Template selector */}
        <div className="mb-4 flex-shrink-0">
          <label className="block text-[#94a3b8] text-xs font-medium mb-1">
            <BookOpen size={12} className="inline mr-1" />
            Template
          </label>
          <select
            className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
            value={selectedTemplate}
            onChange={e => handleTemplateSelect(e.target.value)}
          >
            <option value="">— Select a template —</option>
            {EMAIL_TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Form fields */}
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">To *</label>
            <input
              type="email"
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
              placeholder="recipient@example.com"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Subject *</label>
            <input
              type="text"
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] transition-colors"
              placeholder="Email subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[#94a3b8] text-xs font-medium mb-1">Body</label>
            <textarea
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] resize-none transition-colors"
              rows={8}
              placeholder="Email body..."
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4 flex-shrink-0 pt-4 border-t border-[#1e3a5f]">
          <button
            onClick={handleSend}
            disabled={sending || !gmailToken}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Send size={14} />
            {sending ? 'Sending...' : 'Send via Gmail'}
          </button>
          <button
            onClick={handleLogOnly}
            disabled={sending}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Log Only
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            className="ml-auto text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
