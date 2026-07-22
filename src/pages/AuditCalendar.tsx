import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Users, 
  Shield, 
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Loader2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from "@google/genai";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: 'External Audit' | 'Internal Review' | 'Policy Deadline' | 'Training';
  organizationId: string;
}

export function AuditCalendar() {
  const { profile, loading } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New Event Form
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CalendarEvent['type']>('Internal Review');
  const [newDate, setNewDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!profile?.organizationId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'calendar_events'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CalendarEvent[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as CalendarEvent);
      });
      // Sort in JS
      data.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setEvents(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Calendar loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handleAddEvent = async () => {
    if (!newTitle || !newDate || !profile?.organizationId) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'calendar_events'), {
        title: newTitle,
        startDate: new Date(newDate).toISOString(),
        type: newType,
        description: '',
        organizationId: profile.organizationId,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewDate('');
    } catch (error) {
      console.error("Failed to add event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'calendar_events', id));
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const getEventsForDay = (day: number) => {
    return events.filter(event => {
      const d = new Date(event.startDate);
      return d.getDate() === day && 
             d.getMonth() === currentDate.getMonth() && 
             d.getFullYear() === currentDate.getFullYear();
    });
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display flex items-center gap-4">
            <CalendarDays className="h-10 w-10 text-primary" />
            Audit & GRC Calendar
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Strategic scheduling of compliance reviews and external audits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="border-white/10 text-slate-400">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 font-bold text-white min-w-[150px] text-center">
            {monthName} {year}
          </div>
          <Button variant="outline" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="border-white/10 text-slate-400">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-primary hover:bg-primary/90 text-white ml-4">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Review
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-8">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl overflow-hidden p-1">
            <div className="grid grid-cols-7 border-b border-white/5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-4 text-center text-[10px] uppercase tracking-widest font-bold text-slate-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-[120px]">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b border-white/5 bg-white/[0.01]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = getEventsForDay(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                
                return (
                  <div key={day} className={cn(
                    "border-r border-b border-white/5 p-2 relative group hover:bg-white/[0.02] transition-colors overflow-hidden",
                    isToday && "bg-primary/5"
                  )}>
                    <span className={cn(
                      "text-sm font-mono font-bold transition-colors",
                      isToday ? "text-primary" : "text-slate-600 group-hover:text-slate-400"
                    )}>
                      {day < 10 ? `0${day}` : day}
                    </span>
                    
                    <div className="mt-2 space-y-1">
                      {dayEvents.map(event => (
                        <div 
                          key={event.id}
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded border truncate cursor-pointer transition-all hover:scale-[1.02]",
                            event.type === 'External Audit' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                            event.type === 'Internal Review' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                            event.type === 'Policy Deadline' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>

                    {isToday && (
                      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Sidebar: Upcoming Intelligence */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl h-full flex flex-col">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Strategic Timeline
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">Upcoming audit milestones</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 font-sans custom-scrollbar">
              {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-slate-600 italic text-sm">
                  No upcoming events scheduled.
                </div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="group relative p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={cn(
                         "text-[9px] uppercase tracking-tighter",
                         event.type === 'External Audit' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                         event.type === 'Internal Review' ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" :
                         "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      )}>
                        {event.type}
                      </Badge>
                      <button onClick={(e) => deleteEvent(event.id, e)} className="text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">{event.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(event.startDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel max-w-md w-full p-8 rounded-2xl border border-white/10 relative"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30 text-primary">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-white font-display uppercase tracking-tight">Schedule Milestone</h2>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Event Title</label>
                <Input 
                  placeholder="e.g. ISO 27001 Final Audit" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Type</label>
                <select 
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:ring-1 focus:ring-primary"
                >
                  <option>External Audit</option>
                  <option>Internal Review</option>
                  <option>Policy Deadline</option>
                  <option>Training</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date</label>
                <Input 
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1 text-slate-400">
                Cancel
              </Button>
              <Button onClick={handleAddEvent} disabled={isSubmitting || !newTitle || !newDate} className="flex-1 bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Slot'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", className)}>
      {children}
    </span>
  );
}
