import React from 'react';
import { 
  FileText, 
  Calendar, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Sparkles, 
  ArrowDownToLine, 
  Bookmark, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { EvidenceReviewResult } from '../services/EvidenceReviewService';

interface EvidenceSummaryCardProps {
  result: EvidenceReviewResult;
  documentType: string;
  fileName: string;
  vendorName: string;
  scannedAt?: string;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
}

export function EvidenceSummaryCard({
  result,
  documentType,
  fileName,
  vendorName,
  scannedAt = new Date().toLocaleDateString(),
  onSave,
  isSaved = false,
  isSaving = false
}: EvidenceSummaryCardProps) {
  const { executiveSummary, complianceSignal, expirationDate, keyFindings, detectedRisks } = result;

  // Render correct gradient border and backdrop glow depending on compliance
  const getComplianceStyle = () => {
    switch (complianceSignal) {
      case 'Compliant':
        return {
          border: 'border-emerald-500/20 hover:border-emerald-500/30 shadow-[0_0_20px_-3px_rgba(16,185,129,0.15)]',
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          desc: 'Document meets security policies and framework criteria.',
          icon: ShieldCheck
        };
      case 'Partial':
        return {
          border: 'border-amber-500/20 hover:border-amber-500/30 shadow-[0_0_20px_-3px_rgba(245,158,11,0.15)]',
          text: 'text-amber-400',
          bg: 'bg-amber-500/10',
          desc: 'Document fulfills core directives but contains non-critical gaps.',
          icon: HelpCircle
        };
      case 'Non-Compliant':
      default:
        return {
          border: 'border-rose-500/20 hover:border-rose-500/30 shadow-[0_0_20px_-3px_rgba(239,68,68,0.15)]',
          text: 'text-rose-400',
          bg: 'bg-rose-500/10',
          desc: 'Critical security policies violated or crucial certifications missing.',
          icon: ShieldAlert
        };
    }
  };

  const style = getComplianceStyle();
  const IconComponent = style.icon;

  const getSeverityCount = (severity: string) => {
    return keyFindings.filter(f => f.severity === severity).length;
  };

  return (
    <div id="evidence-summary-card" className={`p-6 rounded-2xl bg-slate-950/40 border transition-all duration-300 ${style.border}`}>
      {/* Header with Title & Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${style.bg} ${style.text}`}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">
                {documentType} GRC Assessment
              </span>
              <Sparkles className="h-3 w-3 text-indigo-400 animate-pulse" />
            </div>
            <h4 className="text-sm font-bold text-white mt-0.5 line-clamp-1">{fileName}</h4>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {onSave && (
            <Button
              onClick={onSave}
              disabled={isSaved || isSaving}
              variant="outline"
              className={`h-8 px-3 text-[10px] uppercase font-bold tracking-wider cursor-pointer select-none transition-all ${
                isSaved 
                  ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' 
                  : 'border-white/5 hover:border-indigo-500/30 text-slate-300 hover:text-white'
              }`}
            >
              {isSaving ? (
                <>Saving Report...</>
              ) : isSaved ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Saved to Locker
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5 mr-1" />
                  Save to History
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Compliance Signal Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
        {/* Signal Panel */}
        <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col justify-between">
          <div>
            <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider font-mono">Compliance Signal</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${style.bg} ${style.text} border-transparent text-xs font-bold font-mono px-2 py-0.5 rounded-md`}>
                {complianceSignal.toUpperCase()}
              </Badge>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {style.desc}
          </p>
        </div>

        {/* Expiration and Dates */}
        <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider font-mono">Validity Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-mono font-bold text-white">
                Exp: {expirationDate || 'Not specified'}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-2">
            SCAN DATE: <span className="text-slate-400">{scannedAt}</span>
          </div>
        </div>

        {/* Fast Metrics Panel */}
        <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col justify-between">
          <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider font-mono">Extracted GRC Violations</span>
          <div className="grid grid-cols-3 gap-2 mt-1.5 font-mono">
            <div className="text-center p-1 bg-rose-500/5 rounded border border-rose-500/10">
              <div className="text-sm font-bold text-rose-400">{getSeverityCount('Critical')}</div>
              <div className="text-[7px] text-rose-500 uppercase font-bold">Critical</div>
            </div>
            <div className="text-center p-1 bg-orange-500/5 rounded border border-orange-500/10">
              <div className="text-sm font-bold text-orange-400">{getSeverityCount('High')}</div>
              <div className="text-[7px] text-orange-500 uppercase font-bold">High</div>
            </div>
            <div className="text-center p-1 bg-amber-500/5 rounded border border-amber-500/10">
              <div className="text-sm font-bold text-amber-400">{getSeverityCount('Medium') + getSeverityCount('Low')}</div>
              <div className="text-[7px] text-amber-500 uppercase font-bold">Med / Low</div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative Executive Summary Text Box */}
      <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden group">
        <div className="absolute top-0 right-0 p-3 opacity-5 scale-125 select-none text-indigo-400 group-hover:scale-150 transition-transform duration-500 pointer-events-none">
          <FileText className="h-16 w-16" />
        </div>
        <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest font-mono block mb-2">
          Executive Summary
        </span>
        <p className="text-xs text-slate-300 leading-relaxed font-sans mt-1">
          {executiveSummary}
        </p>
      </div>
    </div>
  );
}
