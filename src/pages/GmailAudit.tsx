import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Loader2, 
  Lock, 
  Key, 
  Sparkles, 
  Clock, 
  Filter, 
  UserCheck, 
  Database,
  ArrowRight,
  Info,
  Layers,
  ArrowUpRight,
  Copy,
  Plus,
  Send,
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface AnalyzedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  isGrcRelevant: boolean;
  summary: string;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'None';
  regulatoryTags: string[];
  actionNeeded: string;
  confidence: number;
}

interface AuditResponse {
  analyzedEmails: AnalyzedEmail[];
  overallRiskRating: string;
  auditSummary: string;
}

// Utility to create RFC 2822 raw email string formatted for Gmail API
function createRawEmail(to: string, subject: string, body: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body
  ];
  const emailText = emailLines.join('\r\n');
  return btoa(unescape(encodeURIComponent(emailText)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function GmailAudit() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('security OR compliance OR audit OR breach OR alert OR incident OR policy');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'grc_only' | 'risks_only'>('all');
  const [activePreset, setActivePreset] = useState<'security' | 'compliance' | 'all'>('security');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State for Email Alert Transmission
  const [emailModalItem, setEmailModalItem] = useState<AnalyzedEmail | null>(null);
  const [alertRecipient, setAlertRecipient] = useState('ciso@guardentra.com');
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle preset queries
  const setPresetQuery = (preset: 'security' | 'compliance' | 'all') => {
    setActivePreset(preset);
    if (preset === 'security') {
      setSearchQuery('security OR breach OR alert OR incident OR vulnerable');
    } else if (preset === 'compliance') {
      setSearchQuery('compliance OR audit OR policy OR SOC OR ISO OR regulation');
    } else {
      setSearchQuery('security OR compliance OR audit OR breach OR alert OR incident OR policy OR assessment');
    }
  };

  // Google Login and Scope Authorization
  const handleConnectGmail = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add standard Gmail scopes requested and approved
      provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
      provider.addScope('https://www.googleapis.com/auth/gmail.modify');
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        setGmailToken(token);
        // Automatically fetch recent emails
        await fetchEmailsFromGmail(token);
      } else {
        throw new Error("Unable to obtain Google Access Token.");
      }
    } catch (error: any) {
      console.error("Gmail Connection Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMsg("Auth popup was closed. Please try again and complete the login.");
      } else {
        setErrorMsg(`Google Authorization failed: ${error.message || error}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch real emails from Google Gmail API
  const fetchEmailsFromGmail = async (token: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Gmail API returned status ${response.status}`);
      }
      
      const listData = await response.json();
      if (!listData.messages || listData.messages.length === 0) {
        setEmails([]);
        setIsLoading(false);
        return;
      }
      
      const fetched = await Promise.all(
        listData.messages.map(async (msg: any) => {
          try {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (!detailRes.ok) return null;
            const detail = await detailRes.json();
            
            const headers = detail.payload?.headers || [];
            const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
            const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown sender';
            const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
            
            return {
              id: detail.id,
              subject,
              from,
              date,
              snippet: detail.snippet || ''
            };
          } catch (e) {
            console.warn("Could not load details for message ID:", msg.id, e);
            return null;
          }
        })
      );
      
      const finalEmails = fetched.filter((e): e is EmailMessage => e !== null);
      setEmails(finalEmails);
    } catch (error: any) {
      console.error("Fetch Gmail Emails failed:", error);
      setErrorMsg(`Failed to retrieve emails: ${error.message || error}. Please verify your connection status.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load simulated/demo mailbox instantly (for premium demo experience)
  const handleLoadDemoInbox = () => {
    setErrorMsg(null);
    setIsLoading(true);
    
    // Simulate short network delay
    setTimeout(() => {
      setEmails([
        {
          id: "msg_1",
          subject: "ALERT: Exposed Corporate Admin API Credentials Detected",
          from: "security-scanner@guardentra.internal",
          date: new Date().toLocaleString(),
          snippet: "During a routine automated continuous compliance scan, an active corporate administrative API credential was found exposed in a public Git repository. High risk of environment breach."
        },
        {
          id: "msg_2",
          subject: "Urgent: Complete Vendor Security Risk Assessment Questionnaire",
          from: "compliance-officer@trustedpartner.com",
          date: new Date(Date.now() - 3600000 * 2).toLocaleString(),
          snippet: "Dear Partner, your annual SOC 2 compliance verification is due in 10 days. Please complete the attached security posture assessment to prevent account lock."
        },
        {
          id: "msg_3",
          subject: "AWS Security Hub: Found public read permissions on storage S3 bucket",
          from: "aws-alerts@amazon.com",
          date: new Date(Date.now() - 3600000 * 5).toLocaleString(),
          snippet: "[Security Hub Critical Finding] S3.2 Public read access was enabled on resource: arn:aws:s3:::guardentra-prod-billing. Action required."
        },
        {
          id: "msg_4",
          subject: "Update to HIPAA Data Processing Agreement (DPA) policies",
          from: "legal@regulatory-update.org",
          date: new Date(Date.now() - 3600000 * 24).toLocaleString(),
          snippet: "Please review the updated requirements for HIPAA §164.312 data governance controls. Partners storing electronic health details must apply dual-layer KMS keys."
        },
        {
          id: "msg_5",
          subject: "Weekly engineering project status sync meeting",
          from: "slack-meetings@slack.com",
          date: new Date(Date.now() - 3600000 * 48).toLocaleString(),
          snippet: "This is a calendar notification for the team sync. Agenda: sprint review, planning Q3 deliverables, and developer team assignments."
        }
      ]);
      setIsLoading(false);
    }, 600);
  };

  // Run the AI GRC Audit using our server route
  const handleRunAiAudit = async () => {
    if (emails.length === 0) return;
    setIsAuditing(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/ai/analyze-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });
      
      if (!response.ok) {
        throw new Error(`AI Audit API returned status ${response.status}`);
      }
      
      const result: AuditResponse = await response.json();
      setAnalysisResult(result);
    } catch (error: any) {
      console.error("AI Email Audit failed:", error);
      setErrorMsg(`AI Scan Engine error: ${error.message || error}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Send Remediation Alert Email via Gmail API (requires explicit user confirmation dialog)
  const handleExecuteSendAlert = async () => {
    if (!emailModalItem) return;
    setIsSendingAlert(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const subject = `[Guardentra GRC Alert] ${emailModalItem.riskLevel} Risk Finding: ${emailModalItem.subject}`;
    const body = `GUARDENTRA GRC AUTOMATED REMEDIATION ALERT\n\n` +
      `Risk Level: ${emailModalItem.riskLevel}\n` +
      `Regulatory Frameworks: ${emailModalItem.regulatoryTags.join(', ') || 'N/A'}\n` +
      `Source Email: ${emailModalItem.subject} (${emailModalItem.from})\n\n` +
      `AUDIT SYNTHESIS:\n${emailModalItem.summary}\n\n` +
      `REQUIRED REMEDIATION ACTION:\n${emailModalItem.actionNeeded}\n\n` +
      `Generated by Guardentra GRC Platform under guardentra.com`;

    try {
      if (gmailToken) {
        const rawEmail = createRawEmail(alertRecipient, subject, body);
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${gmailToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw: rawEmail })
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error?.message || `Gmail API send failed with HTTP status ${res.status}`);
        }

        setSuccessMsg(`Alert email successfully sent via Gmail to ${alertRecipient}`);
      } else {
        // Fallback for demo mode
        setSuccessMsg(`Simulated alert transmission to ${alertRecipient} complete!`);
      }
      setEmailModalItem(null);
    } catch (err: any) {
      console.error("Failed to send alert email via Gmail:", err);
      setErrorMsg(`Email transmission failed: ${err.message || err}`);
    } finally {
      setIsSendingAlert(false);
    }
  };

  // Copy action commands to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Refresh real Inbox
  const handleRefreshInbox = () => {
    if (gmailToken) {
      fetchEmailsFromGmail(gmailToken);
    } else {
      handleLoadDemoInbox();
    }
  };

  // Filter messages based on GRC status
  const filteredEmails = analysisResult 
    ? analysisResult.analyzedEmails.filter(item => {
        if (activeFilter === 'grc_only') return item.isGrcRelevant;
        if (activeFilter === 'risks_only') return item.isGrcRelevant && item.riskLevel !== 'None';
        return true;
      })
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Title & Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display text-glow flex items-center gap-3">
            <Mail className="h-8 w-8 text-indigo-400" />
            Gmail GRC Inbox Auditor
          </h1>
          <p className="text-slate-400 mt-1">
            Audit mailbox communications with autonomous GRC risk scans and regulatory mapping.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {gmailToken ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-emerald-400 text-xs">
              <UserCheck className="h-4 w-4" />
              <span>Gmail Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleLoadDemoInbox}
                variant="ghost"
                className="text-indigo-300 hover:text-white border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-xs"
              >
                Simulate Demo Inbox
              </Button>
              <Button 
                onClick={handleConnectGmail}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 text-xs"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Connect Gmail Account
              </Button>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <p>{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Connection Instructions Card if not connected */}
      {!gmailToken && emails.length === 0 && (
        <div className="glass-panel p-8 rounded-2xl border border-white/5 relative overflow-hidden text-center max-w-2xl mx-auto py-12">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-6">
            <div className="p-4 bg-indigo-500/10 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-indigo-500/20">
              <Mail className="h-8 w-8 text-indigo-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white font-display">No Inbox Connected</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                Connect your professional Google account to scan real corporate emails for critical compliance alerts, vulnerabilities, and vendor requirements.
              </p>
            </div>
            <div className="flex justify-center gap-4 pt-2">
              <Button onClick={handleLoadDemoInbox} variant="outline" className="border-white/10 text-slate-300">
                Load Simulated Data
              </Button>
              <Button onClick={handleConnectGmail} className="bg-primary hover:bg-primary/90 text-white">
                <Lock className="h-4 w-4 mr-2" />
                Authorize with Google
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
              <Info className="h-3.5 w-3.5" />
              <span>We store your Gmail API access token purely in-memory.</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Mailbox Board */}
      {emails.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: List of loaded emails */}
          <div className={cn("space-y-6", analysisResult ? "lg:col-span-5" : "lg:col-span-12")}>
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
              
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-400" />
                  Loaded Mailbox Items
                </h3>
                <Button 
                  onClick={handleRefreshInbox} 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-white"
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </div>

              {/* Advanced filter presets */}
              {gmailToken && (
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Query Presets</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'security', label: 'Security Focus' },
                      { id: 'compliance', label: 'Compliance Focus' },
                      { id: 'all', label: 'Broad GRC Search' }
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setPresetQuery(preset.id as any)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium transition-all",
                          activePreset === preset.id 
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" 
                            : "bg-white/5 text-slate-400 border border-transparent hover:bg-white/10"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Query Input */}
              {gmailToken && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Custom Gmail query..."
                    className="pl-10 pr-24 bg-black/40 border-white/10 text-white text-xs h-10"
                  />
                  <button 
                    onClick={() => fetchEmailsFromGmail(gmailToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
                  >
                    Search
                  </button>
                </div>
              )}

              {/* Email list preview cards */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {emails.map((email) => {
                  const isScanned = analysisResult?.analyzedEmails.find(a => a.id === email.id);
                  return (
                    <div 
                      key={email.id} 
                      className={cn(
                        "p-4 rounded-xl border transition-all text-left relative overflow-hidden group",
                        isScanned?.isGrcRelevant 
                          ? isScanned.riskLevel === 'Critical' ? "bg-red-500/5 border-red-500/30" :
                            isScanned.riskLevel === 'High' ? "bg-orange-500/5 border-orange-500/30" :
                            "bg-indigo-500/5 border-indigo-500/30"
                          : "bg-white/5 border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <span className="text-[10px] text-slate-400 font-mono tracking-tight shrink-0">{email.from.split('<')[0].trim()}</span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-600" />
                          <span className="text-[9px] text-slate-500 font-mono shrink-0">
                            {email.date ? new Date(email.date).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-white leading-snug line-clamp-1 group-hover:text-indigo-300 transition-colors">
                        {email.subject}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {email.snippet}
                      </p>

                      {isScanned && (
                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                            isScanned.isGrcRelevant ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-500/20 text-slate-500"
                          )}>
                            {isScanned.isGrcRelevant ? 'GRC Match' : 'Ignored'}
                          </span>
                          {isScanned.isGrcRelevant && (
                            <span className={cn(
                              "text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase tracking-widest",
                              isScanned.riskLevel === 'Critical' ? "bg-red-500/20 text-red-400" :
                              isScanned.riskLevel === 'High' ? "bg-orange-500/20 text-orange-400" :
                              isScanned.riskLevel === 'Medium' ? "bg-yellow-500/20 text-yellow-400" :
                              isScanned.riskLevel === 'Low' ? "bg-blue-500/20 text-blue-400" :
                              "bg-slate-500/20 text-slate-400"
                            )}>
                              {isScanned.riskLevel} Risk
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Execute GRC Scan Trigger */}
              {!analysisResult && (
                <Button
                  onClick={handleRunAiAudit}
                  disabled={isAuditing}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-xl border-none cursor-pointer border-glow text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {isAuditing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                      Analyzing inbox data with Guardentra AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-indigo-200" />
                      Run Autonomous GRC Audit Scan
                    </>
                  )}
                </Button>
              )}

            </div>
          </div>

          {/* Right Column: AI Analysis Report Summary & Findings */}
          {analysisResult && (
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-indigo-500/20 relative">
                
                {/* Background glow effects */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-6">
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest font-mono">Autonomous Scan Complete</span>
                    <h3 className="text-xl font-bold text-white font-display mt-1">Audit Assessment Report</h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-mono block">Overall Risk Rating</span>
                      <span className={cn(
                        "text-lg font-bold font-mono uppercase tracking-widest",
                        analysisResult.overallRiskRating === 'Critical' ? "text-red-400 text-glow" :
                        analysisResult.overallRiskRating === 'High' ? "text-orange-400" :
                        analysisResult.overallRiskRating === 'Medium' ? "text-yellow-400" :
                        "text-emerald-400"
                      )}>
                        {analysisResult.overallRiskRating}
                      </span>
                    </div>

                    <div className={cn(
                      "p-3 rounded-xl border shrink-0",
                      analysisResult.overallRiskRating === 'Critical' ? "bg-red-500/10 border-red-500/20" :
                      analysisResult.overallRiskRating === 'High' ? "bg-orange-500/10 border-orange-500/20" :
                      "bg-indigo-500/10 border-indigo-500/20"
                    )}>
                      {analysisResult.overallRiskRating === 'Critical' || analysisResult.overallRiskRating === 'High' ? (
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit summary card */}
                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-slate-300 text-xs leading-relaxed mb-6">
                  <p className="font-semibold text-white mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Info className="h-4 w-4 text-indigo-400" />
                    Executive Summary
                  </p>
                  {analysisResult.auditSummary}
                </div>

                {/* Filter and control options */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <span className="text-xs text-slate-400 font-medium">Result Filter:</span>
                  </div>
                  <div className="flex rounded-lg bg-black/40 p-1 border border-white/5 self-start">
                    {[
                      { id: 'all', label: 'All Items' },
                      { id: 'grc_only', label: 'GRC Matches' },
                      { id: 'risks_only', label: 'Risks Only' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setActiveFilter(f.id as any)}
                        className={cn(
                          "px-3 py-1 rounded text-xs font-semibold transition-all",
                          activeFilter === f.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* List of analyzed findings */}
                <div className="space-y-6">
                  {filteredEmails.map((item) => (
                    <div key={item.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4 hover:border-indigo-500/20 transition-all">
                      
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {item.isGrcRelevant ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 font-bold uppercase tracking-wider font-mono">
                                GRC Signal Match
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/10 font-bold uppercase tracking-wider font-mono">
                                General Email
                              </span>
                            )}

                            {item.regulatoryTags.map(tag => (
                              <span key={tag} className="text-[9px] font-mono font-bold bg-white/5 text-slate-400 border border-white/5 px-2 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <h4 className="text-sm font-semibold text-white leading-snug">{item.subject}</h4>
                        </div>

                        <span className={cn(
                          "text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg uppercase tracking-widest shrink-0 border",
                          item.riskLevel === 'Critical' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          item.riskLevel === 'High' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                          item.riskLevel === 'Medium' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                          item.riskLevel === 'Low' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          "bg-slate-500/10 text-slate-500 border-slate-500/10"
                        )}>
                          {item.riskLevel}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                        <span className="font-bold text-white block mb-1 uppercase tracking-wider text-[10px] text-slate-500">AI Audit Synthesis</span>
                        {item.summary}
                      </div>

                      {item.isGrcRelevant && item.actionNeeded && (
                        <div className="space-y-2 border-t border-white/5 pt-4">
                          <span className="font-bold text-indigo-400 block uppercase tracking-wider text-[10px] font-mono">Remediation Blueprint</span>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                            <p className="text-xs text-slate-300 leading-relaxed">{item.actionNeeded}</p>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <Button
                                onClick={() => copyToClipboard(item.actionNeeded, item.id)}
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-slate-400 hover:text-white"
                              >
                                {copiedId === item.id ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                                Copy
                              </Button>
                              <Button
                                onClick={() => setEmailModalItem(item)}
                                size="sm"
                                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                              >
                                <Send className="h-3.5 w-3.5 mr-1" />
                                Dispatch Alert
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ))}

                  {filteredEmails.length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No emails match the selected filters.
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <Button 
                    onClick={() => {
                      setAnalysisResult(null);
                      setEmails([]);
                    }}
                    variant="outline"
                    className="border-white/10 text-slate-300 hover:text-white"
                  >
                    Clear & Start New Scan
                  </Button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* Confirmation Modal for Sending Email Alert via Gmail API */}
      <AnimatePresence>
        {emailModalItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-indigo-500/30 relative space-y-5"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-display">Confirm Gmail Alert Dispatch</h3>
                    <p className="text-xs text-slate-400">Explicit user confirmation required for email transmission</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEmailModalItem(null)} 
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <p className="font-bold text-amber-200">Confirmation Required</p>
                    <p>You are about to send an email notification through your connected Gmail account on behalf of Guardentra.</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recipient Email Address
                  </label>
                  <Input 
                    value={alertRecipient}
                    onChange={(e) => setAlertRecipient(e.target.value)}
                    placeholder="e.g. ciso@guardentra.com"
                    className="bg-black/40 border-white/10 text-white text-xs h-9"
                  />
                </div>

                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Subject Line</span>
                  <p className="font-semibold text-white">
                    [Guardentra GRC Alert] {emailModalItem.riskLevel} Risk Finding: {emailModalItem.subject}
                  </p>
                </div>

                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] text-slate-400">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans">Body Content Preview</span>
                  <p className="whitespace-pre-wrap">{emailModalItem.actionNeeded}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <Button 
                  onClick={() => setEmailModalItem(null)}
                  variant="ghost" 
                  disabled={isSendingAlert}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleExecuteSendAlert}
                  disabled={isSendingAlert || !alertRecipient.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2"
                >
                  {isSendingAlert ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Sending via Gmail...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Confirm & Send Email
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
