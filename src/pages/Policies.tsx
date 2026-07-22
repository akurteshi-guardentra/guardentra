import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Plus, 
  Search, 
  FileText, 
  Sparkles, 
  History, 
  CheckCircle2, 
  Clock, 
  Archive, 
  MoreVertical, 
  Trash2, 
  Download, 
  Eye, 
  Loader2,
  AlertCircle,
  ChevronRight,
  Shield,
  Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';

interface Policy {
  id: string;
  title: string;
  content: string;
  category: string;
  status: 'Draft' | 'Active' | 'Archived';
  version: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export function Policies() {
  const { profile, loading } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPolicyTitle, setNewPolicyTitle] = useState('');
  const [newPolicyCategory, setNewPolicyCategory] = useState('General Security');
  const [policyError, setPolicyError] = useState('');

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'policies'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Policy[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Policy);
      });
      // Sort in JS to avoid index requirement
      data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setPolicies(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Policies loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const generatePolicy = async () => {
    setPolicyError('');
    if (!newPolicyTitle.trim()) {
      setPolicyError('Policy title is required');
      return;
    }
    if (newPolicyTitle.length < 5) {
      setPolicyError('Policy title should be more descriptive (min 5 chars)');
      return;
    }
    if (!profile?.organizationId) return;
    
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Generate a comprehensive enterprise security policy for: "${newPolicyTitle}".
      Category: ${newPolicyCategory}.
      The policy should be professional, follow industry standards (like ISO 27001 or SOC 2), and include:
      1. Purpose
      2. Scope
      3. Policy Statements
      4. Roles and Responsibilities
      5. Compliance and Enforcement
      
      Format the output in clean Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      const content = response.text || "Failed to generate policy content.";
      
      const policyData = {
        title: newPolicyTitle,
        content,
        category: newPolicyCategory,
        status: 'Draft',
        version: '1.0',
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'policies'), policyData);
      setShowCreateModal(false);
      setNewPolicyTitle('');
    } catch (error) {
      console.error("Policy generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const updatePolicyStatus = async (id: string, status: Policy['status']) => {
    try {
      await updateDoc(doc(db, 'policies', id), { 
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to update policy:", error);
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'policies', id));
      if (selectedPolicy?.id === id) setSelectedPolicy(null);
    } catch (error) {
      console.error("Failed to delete policy:", error);
    }
  };

  const filteredPolicies = policies.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-700">
      {/* Sidebar List */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">Policies</h1>
          <div className="flex gap-2">
            <Link to="/policies/draftsman">
              <Button size="sm" variant="outline" className="h-8 border-primary/30 text-primary hover:bg-primary/10">
                <Zap className="h-4 w-4 mr-2" />
                AI Draft
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 w-8 p-0 rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search policies..." 
            className="pl-10 bg-black/20 border-white/10 text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No policies found.
            </div>
          ) : (
            filteredPolicies.map((policy) => (
              <button
                key={policy.id}
                onClick={() => setSelectedPolicy(policy)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all group relative overflow-hidden",
                  selectedPolicy?.id === policy.id 
                    ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5" 
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{policy.category}</span>
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    policy.status === 'Active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                    policy.status === 'Draft' ? "bg-amber-500" : "bg-slate-500"
                  )} />
                </div>
                <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-primary transition-colors">
                  {policy.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-mono">
                  <Clock className="h-3 w-3" />
                  {new Date(policy.updatedAt).toLocaleDateString()}
                  <span className="ml-auto">v{policy.version}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 glass-panel rounded-2xl border border-white/5 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {selectedPolicy ? (
            <motion.div 
              key={selectedPolicy.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white">{selectedPolicy.title}</h2>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider",
                      selectedPolicy.status === 'Active' ? "bg-emerald-500/20 text-emerald-400" :
                      selectedPolicy.status === 'Draft' ? "bg-amber-500/20 text-amber-400" :
                      "bg-slate-500/20 text-slate-400"
                    )}>
                      {selectedPolicy.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{selectedPolicy.category} • Last updated {new Date(selectedPolicy.updatedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPolicy.status === 'Draft' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => updatePolicyStatus(selectedPolicy.id, 'Active')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Publish
                    </Button>
                  )}
                  {selectedPolicy.status === 'Active' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                      onClick={() => updatePolicyStatus(selectedPolicy.id, 'Archived')}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-rose-400 hover:bg-rose-500/10"
                    onClick={() => deletePolicy(selectedPolicy.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-3xl mx-auto prose prose-invert prose-indigo">
                  <ReactMarkdown>{selectedPolicy.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12 text-center">
              <div className="p-6 rounded-full bg-white/5 mb-6 border border-white/10">
                <FileText className="h-12 w-12 opacity-20" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Policy Selected</h3>
              <p className="max-w-xs">Select a policy from the sidebar to view its content or generate a new one using AI.</p>
              <Button 
                variant="outline" 
                className="mt-6 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setShowCreateModal(true)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate New Policy
              </Button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-md w-full p-8 rounded-2xl border border-white/10 relative"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white">AI Policy Generator</h2>
            </div>
            
            <div className="space-y-4 mb-8">
              {policyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                  {policyError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Policy Title</label>
                <Input 
                  placeholder="e.g. Acceptable Use Policy" 
                  value={newPolicyTitle}
                  onChange={(e) => setNewPolicyTitle(e.target.value)}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label>
                <select 
                  value={newPolicyCategory}
                  onChange={(e) => setNewPolicyCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="General Security">General Security</option>
                  <option value="Access Control">Access Control</option>
                  <option value="Data Privacy">Data Privacy</option>
                  <option value="Incident Response">Incident Response</option>
                  <option value="Network Security">Network Security</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setShowCreateModal(false)} 
                className="flex-1 text-slate-400"
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button 
                onClick={generatePolicy} 
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
                disabled={isGenerating || !newPolicyTitle}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
