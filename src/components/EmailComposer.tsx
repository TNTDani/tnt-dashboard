'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Send, BookOpen, Wifi, WifiOff, Sparkles, RefreshCw, Loader2, Eye, Pencil } from 'lucide-react';
import { TimelineEntry, FollowUp } from '@/lib/types';
import { EMAIL_TEMPLATES, applyTemplate } from '@/lib/emailTemplates';
import { db } from '@/lib/db';
import { buildHtmlEmail } from '@/lib/buildEmail';
import { v4 as uuidv4 } from 'uuid';

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  vars?: Record<string, string>;
  onSent: (entry: TimelineEntry) => void;
  // Client data for cold email generation
  clientContactName?: string;
  clientContactRole?: string;
  clientCompanyName?: string;
  clientWebsite?: string;
  // Follow-up tracking
  followUpConfig?: {
    contactType: 'candidate' | 'client';
    contactId: string;
    contactName: string;
    company: string;
  };
}

type Language = 'en' | 'nl';

export default function EmailComposer({
  isOpen,
  onClose,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  vars = {},
  onSent,
  clientContactName,
  clientContactRole,
  clientCompanyName,
  clientWebsite,
  followUpConfig,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [gmailToken, setGmailToken] = useState<Record<string, unknown> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Cold email generation state
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const canGenerateColdEmail = !!(clientContactName && clientCompanyName);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setSelectedTemplate('');
      setError('');
      setShowPreview(false);
      setShowLangPicker(false);
      setGenerating(false);
      setGenerationStatus('');
      setHasGenerated(false);
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

  const generateColdEmail = async (language: Language) => {
    setShowLangPicker(false);
    setGenerating(true);
    setError('');
    setGenerationStatus(`Researching ${clientCompanyName}...`);

    try {
      const res = await fetch('/api/generate-cold-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: clientContactName,
          contactRole: clientContactRole,
          companyName: clientCompanyName,
          website: clientWebsite,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setSubject(data.subject);
      setBody(data.body);
      setHasGenerated(true);
      setSelectedTemplate('');
    } catch (err) {
      setError(`Cold email generation failed: ${String(err)}`);
    } finally {
      setGenerating(false);
      setGenerationStatus('');
    }
  };

  const connectGmail = () => {
    window.open('/api/gmail/auth', '_blank', 'width=500,height=600');
  };

  const createFollowUp = async (emailTo: string, emailSubject: string) => {
    if (!followUpConfig) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 4);
    const followUp: FollowUp = {
      id: uuidv4(),
      contactType: followUpConfig.contactType,
      contactId: followUpConfig.contactId,
      contactName: followUpConfig.contactName,
      contactEmail: emailTo,
      company: followUpConfig.company,
      originalEmailSubject: emailSubject,
      lastContactDate: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const existing = await db.getFollowUps();
    db.saveFollowUps([...existing, followUp]);
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
      createFollowUp(to, subject);
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
    createFollowUp(to, subject);
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

        {/* Generate Cold Email button */}
        {canGenerateColdEmail && (
          <div className="mb-4 flex-shrink-0 relative">
            {!showLangPicker && !generating && (
              <button
                onClick={() => setShowLangPicker(true)}
                className="flex items-center gap-2 w-full justify-center bg-gradient-to-r from-[#7C3AED] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#7C3AED]/20"
              >
                <Sparkles size={15} />
                {hasGenerated ? 'Regenerate Cold Email' : 'Generate Cold Email'}
                {hasGenerated && <RefreshCw size={13} className="ml-0.5" />}
              </button>
            )}

            {/* Language picker */}
            {showLangPicker && !generating && (
              <div className="flex items-center gap-2 bg-[#0a1628] border border-[#7C3AED]/40 rounded-lg p-2">
                <Sparkles size={14} className="text-[#7C3AED] ml-1 flex-shrink-0" />
                <span className="text-[#94a3b8] text-xs mr-1">Language:</span>
                <button
                  onClick={() => generateColdEmail('en')}
                  className="flex-1 bg-[#7C3AED] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  English
                </button>
                <button
                  onClick={() => generateColdEmail('nl')}
                  className="flex-1 bg-[#1e3a5f] hover:bg-[#2a4f7a] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  Dutch
                </button>
                <button
                  onClick={() => setShowLangPicker(false)}
                  className="text-[#94a3b8] hover:text-white p-1 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Loading state */}
            {generating && (
              <div className="flex items-center gap-3 bg-[#0a1628] border border-[#7C3AED]/30 rounded-lg px-4 py-2.5">
                <Loader2 size={15} className="text-[#7C3AED] animate-spin flex-shrink-0" />
                <span className="text-[#94a3b8] text-sm">{generationStatus}</span>
              </div>
            )}
          </div>
        )}

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
            {/* Write / Preview tab bar */}
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#94a3b8] text-xs font-medium">Body</label>
              <div className="flex items-center gap-0.5 bg-[#0a1628] border border-[#1e3a5f] rounded-md p-0.5">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${!showPreview ? 'bg-[#7C3AED] text-white' : 'text-[#94a3b8] hover:text-white'}`}
                >
                  <Pencil size={11} /> Write
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${showPreview ? 'bg-[#7C3AED] text-white' : 'text-[#94a3b8] hover:text-white'}`}
                >
                  <Eye size={11} /> Preview
                </button>
              </div>
            </div>

            {!showPreview ? (
              <textarea
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a6fa5] focus:outline-none focus:border-[#7C3AED] resize-none transition-colors"
                rows={8}
                placeholder="Email body..."
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            ) : (
              <iframe
                srcDoc={buildHtmlEmail(body || '(No body yet)')}
                className="w-full border border-[#1e3a5f] rounded-lg bg-white"
                style={{ height: '320px' }}
                sandbox="allow-same-origin"
                title="Email preview"
              />
            )}
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
