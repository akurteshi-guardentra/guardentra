import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Plus, Search, Sparkles, Loader2, ChevronDown, ChevronUp, ShieldAlert, Info } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import * as d3 from 'd3';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '@/src/lib/utils';

interface Risk {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  owner: string;
  impact: number;
  likelihood: number;
  mitigation?: string;
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || risks.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 400;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear().domain([0.5, 5.5]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0.5, 5.5]).range([innerHeight, 0]);

    // Background Grid & Colors
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= 5; j++) {
        const score = i * j;
        let color = "#10b981"; // Green
        if (score > 12) color = "#ef4444"; // Red
        else if (score > 6) color = "#f59e0b"; // Amber

        g.append("rect")
          .attr("x", xScale(i - 0.5))
          .attr("y", yScale(j + 0.5))
          .attr("width", innerWidth / 5)
          .attr("height", innerHeight / 5)
          .attr("fill", color)
          .attr("opacity", 0.15)
          .attr("stroke", "rgba(255,255,255,0.05)");
      }
    }

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d => d.toString());
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => d.toString());

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr("color", "#64748b");

    g.append("g")
      .call(yAxis)
      .attr("color", "#64748b");

    // Labels
    svg.append("text")
      .attr("x", width / 2 + 10)
      .attr("y", height - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text("LIKELIHOOD");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2 + 10)
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text("IMPACT");

    // Plot Risks
    const simulation = d3.forceSimulation(risks as any)
      .force("x", d3.forceX((d: any) => xScale(d.likelihood)).strength(1))
      .force("y", d3.forceY((d: any) => yScale(d.impact)).strength(1))
      .force("collide", d3.forceCollide(8))
      .stop();

    for (let i = 0; i < 120; ++i) simulation.tick();

    const nodes = g.selectAll(".risk-node")
      .data(risks)
      .enter()
      .append("circle")
      .attr("class", "risk-node")
      .attr("cx", (d: any) => d.x)
      .attr("cy", (d: any) => d.y)
      .attr("r", 6)
      .attr("fill", "#6366f1")
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .style("filter", "drop-shadow(0 0 4px rgba(99, 102, 241, 0.5))");

    nodes.append("title")
      .text(d => `${d.title}\nImpact: ${d.impact}\nLikelihood: ${d.likelihood}`);

  }, [risks]);

  return (
    <div className="flex justify-center items-center bg-black/20 rounded-xl p-4 border border-white/5">
      <svg ref={svgRef} width={400} height={400} className="max-w-full h-auto" />
    </div>
  );
}

export function RiskManagement() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedRisks, setDetectedRisks] = useState<any[]>([]);
  const [showDetectModal, setShowDetectModal] = useState(false);
  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [newRisk, setNewRisk] = useState({
    title: '',
    category: 'Operational',
    severity: 'Medium',
    impact: 3,
    likelihood: 2,
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [selectedRiskIndices, setSelectedRiskIndices] = useState<number[]>([]);
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [isGeneratingMitigation, setIsGeneratingMitigation] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'risks'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const risksData: Risk[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        risksData.push({ 
          id: doc.id, 
          ...data,
          impact: data.impact || Math.floor(Math.random() * 5) + 1,
          likelihood: data.likelihood || Math.floor(Math.random() * 5) + 1
        } as Risk);
      });
      setRisks(risksData);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const handleAutoDetect = async () => {
    if (!profile?.organizationId) return;
    setIsDetecting(true);
    try {
      // Fetch some context
      const [incidentsSnap, vendorsSnap, complianceSnap] = await Promise.all([
        getDocs(query(collection(db, 'incidents'), where('organizationId', '==', profile.organizationId))),
        getDocs(query(collection(db, 'vendors'), where('organizationId', '==', profile.organizationId))),
        getDocs(query(collection(db, 'compliance'), where('organizationId', '==', profile.organizationId)))
      ]);

      const context = {
        incidentCount: incidentsSnap.size,
        vendorCategories: vendorsSnap.docs.map(d => d.data().category),
        complianceFrameworks: complianceSnap.docs.map(d => d.data().name)
      };

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Act as a senior GRC risk analyst. 
      Based on this organizational context, predict 4 high-probability security or operational risks.
      Context:
      - Active Incidents: ${context.incidentCount}
      - Vendor Categories: ${context.vendorCategories.join(', ')}
      - Compliance Focus: ${context.complianceFrameworks.join(', ')}
      
      Return a JSON array of risks:
      [{ "title": string, "category": string, "severity": "Critical" | "High" | "Medium" | "Low", "impact": 1-5, "likelihood": 1-5, "description": string }]`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(result.text || "[]");
      setDetectedRisks(parsed);
      setSelectedRiskIndices([]);
      setShowDetectModal(true);
    } catch (error) {
      console.error("Failed to auto-detect risks:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleAddSelectedRisks = async () => {
    if (!profile?.organizationId) return;
    
    const selected = selectedRiskIndices.map(index => detectedRisks[index]);
    
    for (const risk of selected) {
      try {
        await addDoc(collection(db, 'risks'), {
          ...risk,
          status: 'Open',
          owner: 'AI Detected',
          organizationId: profile.organizationId,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Failed to add AI risk:", error);
      }
    }
    
    setShowDetectModal(false);
  };

  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organizationId) return;
    
    setFormError('');
    if (!newRisk.title.trim()) {
      setFormError('Risk title is required');
      return;
    }
    if (newRisk.title.length < 5) {
      setFormError('Risk title must be at least 5 characters');
      return;
    }

    try {
      await addDoc(collection(db, 'risks'), {
        ...newRisk,
        status: 'Open',
        owner: profile.displayName || 'Analyst',
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      setShowAddRiskModal(false);
      setNewRisk({
        title: '',
        category: 'Operational',
        severity: 'Medium',
        impact: 3,
        likelihood: 2,
        description: ''
      });
    } catch (error) {
      console.error("Failed to add risk:", error);
      setFormError('Failed to save risk to database.');
    }
  };

  const handleGenerateMitigation = async (risk: Risk) => {
    setIsGeneratingMitigation(risk.id);
    try {
      // Using direct AI call for mitigation
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Generate a detailed mitigation plan for the following risk:
      Title: ${risk.title}
      Category: ${risk.category}
      Severity: ${risk.severity}
      Impact: ${risk.impact}/5
      Likelihood: ${risk.likelihood}/5
      
      Provide a step-by-step resolution strategy.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      const mitigation = response.text || "Failed to generate mitigation plan.";
      
      await updateDoc(doc(db, 'risks', risk.id), {
        mitigation: mitigation
      });
    } catch (error) {
      console.error("Failed to generate mitigation:", error);
    } finally {
      setIsGeneratingMitigation(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRiskId(expandedRiskId === id ? null : id);
  };

  const filteredRisks = risks.filter(risk => {
    const matchesSearch = risk.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         risk.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         risk.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = filterSeverity === 'All' || risk.severity === filterSeverity;
    const matchesStatus = filterStatus === 'All' || risk.status === filterStatus;
    const matchesCategory = filterCategory === 'All' || risk.category === filterCategory;
    
    return matchesSearch && matchesSeverity && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(risks.map(r => r.category)));
  const severities = ['Critical', 'High', 'Medium', 'Low'];
  const statuses = ['Open', 'In Progress', 'Resolved'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Risk Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">AI-quantified risk register and mitigation tracking.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/10"
            onClick={handleAutoDetect}
            disabled={isDetecting}
          >
            {isDetecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isDetecting ? 'Scanning...' : 'Auto-Detect Risks'}
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setShowAddRiskModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Risk
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-white/10 bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Risk Heatmap
              <Info className="h-4 w-4 text-slate-500" />
            </CardTitle>
            <CardDescription>Impact vs Likelihood Matrix</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskMatrix risks={risks} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase font-bold tracking-wider">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500" />
                Low Risk
              </div>
              <div className="flex items-center gap-1.5 text-amber-500">
                <div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500" />
                Medium
              </div>
              <div className="flex items-center gap-1.5 text-rose-500">
                <div className="w-2 h-2 rounded-full bg-rose-500/20 border border-rose-500" />
                High
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-white/10 bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Active Risk Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="relative flex-1 w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    type="search" 
                    placeholder="Search risks..." 
                    className="pl-8 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  className={`border-white/10 text-slate-300 hover:bg-white/5 ${showFilters ? 'bg-white/10' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  Filter
                </Button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Severity</label>
                        <select 
                          className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                          value={filterSeverity}
                          onChange={(e) => setFilterSeverity(e.target.value)}
                        >
                          <option value="All">All Severities</option>
                          {severities.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Status</label>
                        <select 
                          className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <option value="All">All Statuses</option>
                          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Category</label>
                        <select 
                          className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                        >
                          <option value="All">All Categories</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[700px] sm:min-w-0">
                <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400">ID</TableHead>
                  <TableHead className="text-slate-400">Title</TableHead>
                  <TableHead className="text-slate-400">Impact</TableHead>
                  <TableHead className="text-slate-400">Likelihood</TableHead>
                  <TableHead className="text-slate-400">Severity</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading risks...
                    </TableCell>
                  </TableRow>
                ) : filteredRisks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      No risks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRisks.map((risk) => (
                    <React.Fragment key={risk.id}>
                      <TableRow className={`border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${expandedRiskId === risk.id ? 'bg-white/5' : ''}`} onClick={() => toggleExpand(risk.id)}>
                        <TableCell className="font-medium font-mono text-slate-300">{risk.id.substring(0, 8)}</TableCell>
                        <TableCell className="text-slate-200">{risk.title}</TableCell>
                        <TableCell className="text-slate-400">{risk.impact}/5</TableCell>
                        <TableCell className="text-slate-400">{risk.likelihood}/5</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={cn(
                              "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                              risk.severity === 'Critical' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_8px_-2px_theme(colors.rose.500)]' : 
                              risk.severity === 'High' ? 'border-orange-500/30 text-orange-400 bg-orange-500/10 shadow-[0_0_8px_-2px_theme(colors.orange.500)]' : 
                              risk.severity === 'Medium' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_8px_-2px_theme(colors.amber.500)]' :
                              'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_-2px_theme(colors.emerald.500)]'
                            )}
                          >
                            {risk.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                            {expandedRiskId === risk.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                      <AnimatePresence>
                        {expandedRiskId === risk.id && (
                          <TableRow className="bg-slate-900/50 border-b border-white/5">
                            <TableCell colSpan={6} className="p-0">
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-6">
                                  <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                                      <ShieldAlert className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-white">AI Mitigation Plan</h3>
                                        {!risk.mitigation && (
                                          <Button 
                                            size="sm" 
                                            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                                            onClick={(e) => { e.stopPropagation(); handleGenerateMitigation(risk); }}
                                            disabled={isGeneratingMitigation === risk.id}
                                          >
                                            {isGeneratingMitigation === risk.id ? (
                                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                                            ) : (
                                              <><Sparkles className="mr-2 h-4 w-4" /> Generate Plan</>
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                      
                                      {risk.mitigation ? (
                                        <div className="bg-black/20 border border-white/5 rounded-lg p-4">
                                          <div className="prose prose-invert prose-sm max-w-none">
                                            {risk.mitigation.split('\n').map((line, i) => (
                                              <p key={i} className="text-slate-300 leading-relaxed mb-2 last:mb-0">{line}</p>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-black/20 border border-white/5 rounded-lg p-6 text-center">
                                          <p className="text-slate-400 text-sm">No mitigation plan generated yet. Use AI to create a step-by-step resolution strategy.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
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
      </div>

      {/* AI Detection Modal */}
      {showDetectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden m-4"
          >
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-primary" />
                AI Detected Risks
              </h2>
              <p className="text-sm text-slate-400 mt-1">Select the risks you want to add to your register.</p>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {detectedRisks.map((risk, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedRiskIndices.includes(index) 
                      ? 'border-primary bg-primary/10' 
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => {
                    setSelectedRiskIndices(prev => 
                      prev.includes(index) 
                        ? prev.filter(i => i !== index)
                        : [...prev, index]
                    );
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedRiskIndices.includes(index) ? 'bg-primary border-primary text-white' : 'border-slate-500'
                      }`}>
                        {selectedRiskIndices.includes(index) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-200">{risk.title}</h3>
                        <p className="text-sm text-slate-400">{risk.category}</p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                        risk.severity === 'Critical' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_8px_-2px_theme(colors.rose.500)]' : 
                        risk.severity === 'High' ? 'border-orange-500/30 text-orange-400 bg-orange-500/10 shadow-[0_0_8px_-2px_theme(colors.orange.500)]' : 
                        risk.severity === 'Medium' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_8px_-2px_theme(colors.amber.500)]' :
                        'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_-2px_theme(colors.emerald.500)]'
                      )}
                    >
                      {risk.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-slate-900/50">
              <Button variant="outline" onClick={() => setShowDetectModal(false)} className="border-white/10 text-slate-300 hover:bg-white/10">
                Cancel
              </Button>
              <Button 
                onClick={handleAddSelectedRisks} 
                disabled={selectedRiskIndices.length === 0}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Add Selected ({selectedRiskIndices.length})
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manual Risk Addition Modal */}
      {showAddRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden m-4"
          >
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Declare New Risk</h2>
              <p className="text-sm text-slate-400 mt-1">Manually document a potential threat to your operations.</p>
            </div>
            
            <form onSubmit={handleAddRisk} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {formError}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Risk Title</label>
                <Input 
                  value={newRisk.title}
                  onChange={(e) => setNewRisk({...newRisk, title: e.target.value})}
                  placeholder="e.g., Unathorized access to S3 buckets"
                  className="bg-black/20 border-white/10 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label>
                  <select 
                    className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newRisk.category}
                    onChange={(e) => setNewRisk({...newRisk, category: e.target.value})}
                  >
                    <option value="Operational">Operational</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Strategic">Strategic</option>
                    <option value="Financial">Financial</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Severity</label>
                  <select 
                    className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newRisk.severity}
                    onChange={(e) => setNewRisk({...newRisk, severity: e.target.value})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Impact (1-5)</label>
                  <Input 
                    type="number"
                    min={1}
                    max={5}
                    value={newRisk.impact}
                    onChange={(e) => setNewRisk({...newRisk, impact: parseInt(e.target.value)})}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Likelihood (1-5)</label>
                  <Input 
                    type="number"
                    min={1}
                    max={5}
                    value={newRisk.likelihood}
                    onChange={(e) => setNewRisk({...newRisk, likelihood: parseInt(e.target.value)})}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Internal Description</label>
                <textarea 
                  className="w-full bg-black/40 border border-white/10 rounded-md p-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none"
                  placeholder="Describe the risk scenario..."
                  value={newRisk.description}
                  onChange={(e) => setNewRisk({...newRisk, description: e.target.value})}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddRiskModal(false)}
                  className="border-white/10 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white">
                  Add to Register
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

