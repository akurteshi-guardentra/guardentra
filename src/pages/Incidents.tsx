import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Plus, Search, ShieldAlert, Loader2, Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, MessageSquare, FileSearch, Clock } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '@/src/lib/utils';

interface PlaybookStep {
  title: string;
  description: string;
  owner_role: string;
}

interface Playbook {
  incident_type: string;
  severity: string;
  steps: PlaybookStep[];
  communications: string[];
  evidence_to_collect: string[];
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  date: string;
  reporter: string;
  playbook?: Playbook;
}

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIncident, setNewIncident] = useState({
    title: '',
    severity: 'Medium',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'incidents'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidentsData: Incident[] = [];
      snapshot.forEach((doc) => {
        incidentsData.push({ id: doc.id, ...doc.data() } as Incident);
      });
      setIncidents(incidentsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const handleDeclareIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organizationId) return;
    
    setFormError('');
    if (!newIncident.title.trim()) {
      setFormError('Incident title is required');
      return;
    }
    if (newIncident.title.length < 5) {
      setFormError('Please provide a more descriptive title');
      return;
    }

    try {
      await addDoc(collection(db, 'incidents'), {
        ...newIncident,
        status: 'Investigating',
        date: new Date().toISOString().split('T')[0],
        reporter: profile.displayName || 'Security Analyst',
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewIncident({ title: '', severity: 'Medium', description: '' });
    } catch (error) {
      console.error("Failed to declare incident:", error);
      setFormError('Failed to save incident record.');
    }
  };

  const handleGeneratePlaybook = async (incident: Incident) => {
    setIsGenerating(incident.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Generate a structured incident response playbook for: ${incident.title}. 
                  Severity: ${incident.severity}. 
                  Status: ${incident.status}.
                  Provide clear steps, communication requirements, and evidence to collect.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              incident_type: { type: Type.STRING },
              severity: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    owner_role: { type: Type.STRING }
                  },
                  required: ["title", "description", "owner_role"]
                }
              },
              communications: { type: Type.ARRAY, items: { type: Type.STRING } },
              evidence_to_collect: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["incident_type", "severity", "steps", "communications", "evidence_to_collect"]
          }
        }
      });

      const playbook = JSON.parse(response.text || '{}');
      await updateDoc(doc(db, 'incidents', incident.id), {
        playbook: playbook
      });
    } catch (error) {
      console.error("Playbook Generation Error:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Incident Response</h1>
          <p className="text-sm text-slate-400 mt-1">AI-assisted threat detection and remediation.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10" onClick={() => setShowAddModal(true)}>
            <ShieldAlert className="mr-2 h-4 w-4" />
            Declare Incident
          </Button>
        </div>
      </div>

      <Card className="border-white/10 bg-slate-900/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Active Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input type="search" placeholder="Search incidents..." className="pl-8 bg-black/20 border-white/10 text-white placeholder:text-slate-500" />
            </div>
            <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">Filter</Button>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] sm:min-w-0">
              <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-400">ID</TableHead>
                <TableHead className="text-slate-400">Title</TableHead>
                <TableHead className="text-slate-400">Severity</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading incidents...
                  </TableCell>
                </TableRow>
              ) : incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No active incidents.
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((incident) => (
                  <React.Fragment key={incident.id}>
                    <TableRow 
                      className={`border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${expandedId === incident.id ? 'bg-white/5' : ''}`}
                      onClick={() => toggleExpand(incident.id)}
                    >
                      <TableCell className="font-medium font-mono text-slate-300">{incident.id.substring(0, 8)}</TableCell>
                      <TableCell className="text-slate-200">{incident.title}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn(
                            "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                            incident.severity === 'Critical' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_8px_-2px_theme(colors.rose.500)]' : 
                            incident.severity === 'High' ? 'border-orange-500/30 text-orange-400 bg-orange-500/10 shadow-[0_0_8px_-2px_theme(colors.orange.500)]' : 
                            incident.severity === 'Medium' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_8px_-2px_theme(colors.amber.500)]' :
                            'border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-[0_0_8px_-2px_theme(colors.blue.500)]'
                          )}
                        >
                          {incident.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn(
                            "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                            incident.status === 'Resolved' 
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_-2px_theme(colors.emerald.500)]' : 
                            incident.status === 'Investigating' || incident.status === 'Open'
                              ? 'border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-[0_0_8px_-2px_theme(colors.blue.500)]' : 
                            'border-slate-500/30 text-slate-400 bg-slate-500/10'
                          )}
                        >
                           {incident.status === 'Resolved' ? <CheckCircle2 className="h-3 w-3" /> : 
                            incident.status === 'Investigating' ? <Clock className="h-3 w-3" /> : null}
                          {incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{incident.date}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                          {expandedId === incident.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <AnimatePresence>
                      {expandedId === incident.id && (
                        <TableRow className="bg-black/20 border-white/5">
                          <TableCell colSpan={6} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-semibold text-white font-display">AI Response Playbook</h3>
                                  </div>
                                  {!incident.playbook && (
                                    <Button 
                                      size="sm" 
                                      className="bg-primary hover:bg-primary/90 text-white"
                                      onClick={(e) => { e.stopPropagation(); handleGeneratePlaybook(incident); }}
                                      disabled={isGenerating === incident.id}
                                    >
                                      {isGenerating === incident.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                      Generate Playbook
                                    </Button>
                                  )}
                                </div>

                                {incident.playbook ? (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-4">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                        Remediation Steps
                                      </h4>
                                      <div className="space-y-3">
                                        {incident.playbook.steps.map((step, i) => (
                                          <div key={i} className="bg-white/5 border border-white/5 rounded-lg p-4 relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary/50" />
                                            <div className="flex justify-between items-start mb-1">
                                              <h5 className="text-sm font-semibold text-white">{step.title}</h5>
                                              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{step.owner_role}</Badge>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="space-y-6">
                                      <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                          <MessageSquare className="h-3 w-3 text-indigo-400" />
                                          Communications
                                        </h4>
                                        <div className="space-y-2">
                                          {incident.playbook.communications.map((comm, i) => (
                                            <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                              <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                              {comm}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                          <FileSearch className="h-3 w-3 text-amber-400" />
                                          Evidence to Collect
                                        </h4>
                                        <div className="space-y-2">
                                          {incident.playbook.evidence_to_collect.map((ev, i) => (
                                            <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                              <div className="w-1 h-1 rounded-full bg-amber-400" />
                                              {ev}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                                    <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">No playbook generated for this incident yet.</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CardContent>
      </Card>

      {/* Manual Incident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden m-4"
          >
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-500" />
                Declare Security Incident
              </h2>
              <p className="text-sm text-slate-400 mt-1">High-priority events requiring immediate attention.</p>
            </div>
            
            <form onSubmit={handleDeclareIncident} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {formError}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Incident Title</label>
                <Input 
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({...newIncident, title: e.target.value})}
                  placeholder="e.g., Potential data exfiltration on DB-01"
                  className="bg-black/20 border-white/10 text-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Severity Level</label>
                <select 
                  className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newIncident.severity}
                  onChange={(e) => setNewIncident({...newIncident, severity: e.target.value})}
                >
                  <option value="Low">Low - Informational</option>
                  <option value="Medium">Medium - Investigation Needed</option>
                  <option value="High">High - Priority Action</option>
                  <option value="Critical">Critical - System Compromise</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preliminary Observations</label>
                <textarea 
                  className="w-full bg-black/40 border border-white/10 rounded-md p-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none"
                  placeholder="Describe what was observed..."
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({...newIncident, description: e.target.value})}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddModal(false)}
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white border-none">
                  Declare & Alert Team
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

