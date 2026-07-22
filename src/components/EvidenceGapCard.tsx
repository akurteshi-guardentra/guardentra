import React, { useState } from 'react';
import { 
  AlertCircle,
  FileQuestion,
  Mail,
  Check,
  Send,
  X,
  XCircle,
  FileCheck
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MissingEvidence } from '../services/EvidenceReviewService';

interface EvidenceGapCardProps {
  gaps: MissingEvidence[];
  vendorName: string;
  onSendOutreach?: (subject: string, body: string) => void;
}

export function EvidenceGapCard({
  gaps,
  vendorName,
  onSendOutreach
}: EvidenceGapCardProps) {
  const [activeDraft, setActiveDraft] = useState<MissingEvidence | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Low':
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };

  const initOutreachDraft = (gap: MissingEvidence) => {
    const subject = `Urgent Attestation Needed: ${gap.evidenceName} - ${vendorName}`;
    const body = `Hi Team,\n\nDuring our automated security compliance and policy attestation reviews on Guardentra, we identified a missing evidence item belonging to your profile:\n\n- Evidence Category: ${gap.evidenceName}\n- Policy Alignment Reason: ${gap.reason}\n- Current Risk Urgency: ${gap.priority.toUpperCase()}\n\nPlease upload or attest this document directly in your locker at your earliest convenience to maintain an active, verified GRC trust score status.\n\nBest regards,\nGuardentra Trust Operations Team`;
    
    setDraftSubject(subject);
    setDraftBody(body);
    setSendSuccess(false);
    setActiveDraft(gap);
  };

  const handleSendEmail = () => {
    if (onSendOutreach) {
      onSendOutreach(draftSubject, draftBody);
    }
    setSendSuccess(true);
    setTimeout(() => {
      setActiveDraft(null);
      setSendSuccess(false);
    }, 1800);
  };

  return (
    <div id="evidence-gap-card" className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 space-y-4 relative">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
            <FileQuestion className="h-4 w-4 text-amber-400 shrink-0" />
            Missing Evidence & Profile Gaps
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Critical compliance reports or control attestations absent from the vendor profile.</p>
        </div>
        <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-mono">
          {gaps.length} Gaps Found
        </Badge>
      </div>

      {gaps.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-2">
          <FileCheck className="h-5 w-5 text-emerald-400" />
          <span>All expected evidence and policies are uploaded in this locker.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gaps.map((item, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-4">
                  <h5 className="text-xs font-bold text-white leading-normal">
                    {item.evidenceName}
                  </h5>
                  <span className={`text-[8px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded shrink-0 ${getPriorityBadge(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {item.reason}
                </p>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-white/5 mt-3 justify-end">
                <Button
                  onClick={() => initOutreachDraft(item)}
                  variant="outline"
                  className="h-7 text-[9px] font-bold uppercase tracking-wider border-white/5 hover:border-indigo-500/20 text-indigo-400 hover:text-indigo-300 bg-white/[0.01] cursor-pointer"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Initiate Outreach
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outreach Email Modal Overlay */}
      {activeDraft && (
        <div className="absolute inset-0 bg-slate-950/95 rounded-2xl p-6 flex flex-col justify-between z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start border-b border-white/5 pb-3">
            <div>
              <h5 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-indigo-400" />
                Draft Outreach Email
              </h5>
              <p className="text-[10px] text-slate-400">Requesting: {activeDraft.evidenceName}</p>
            </div>
            <button 
              onClick={() => setActiveDraft(null)} 
              className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {sendSuccess ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-10">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full animate-bounce">
                <Check className="h-6 w-6" />
              </div>
              <h6 className="text-xs font-bold text-white">Outreach Email Transmitted</h6>
              <p className="text-[10px] text-slate-400">Task logged under Remediation Outboxes.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-3 py-3 overflow-hidden flex flex-col">
              <div className="space-y-1 shrink-0">
                <label className="text-[9px] text-slate-500 uppercase font-mono block">Subject Line</label>
                <input 
                  type="text" 
                  value={draftSubject} 
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500" 
                />
              </div>
              <div className="flex-1 min-h-0 flex flex-col space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono block">Email Body</label>
                <textarea 
                  value={draftBody} 
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="flex-1 w-full bg-slate-900 border border-white/5 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-sans overflow-y-auto"
                />
              </div>
            </div>
          )}

          {!sendSuccess && (
            <div className="flex gap-2 border-t border-white/5 pt-3 justify-end items-center shrink-0">
              <Button
                onClick={() => setActiveDraft(null)}
                variant="ghost"
                className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-white cursor-pointer select-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                className="h-8 px-4 text-[10px] uppercase font-bold tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer select-none"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Transmit Outreach
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
