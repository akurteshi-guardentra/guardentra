import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Loader2, MessageSquare, Shield, Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';

// Audio constants
const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 4096;

export function LiveAssistant() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(20).fill(0));

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  
  const { profile } = useAuth();

  // Initialize Audio Context
  const initAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  // Convert Float32Array to Int16Array (PCM)
  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  };

  // Convert Int16Array to Float32Array
  const pcmToFloat32 = (input: Int16Array) => {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 0x8000;
    }
    return output;
  };

  // Play next audio chunk in queue
  const playNextChunk = async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      return;
    }

    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    const floatData = pcmToFloat32(pcmData);

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(floatData);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };

    source.start();
  };

  const startConnection = async () => {
    try {
      setError(null);
      await initAudio();

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            startRecording();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              audioQueueRef.current.push(pcmData);
              playNextChunk();
            }

            // Handle transcription
            const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (modelText) {
              setAiResponse(prev => prev + modelText);
            }

            // Handle tool calls
            const toolCall = message.toolCall;
            if (toolCall) {
              setIsProcessing(true);
              for (const call of toolCall.functionCalls || []) {
                let result = {};
                
                if (call.name === "get_compliance_gaps") {
                  const q = query(collection(db, 'compliance'), where('organizationId', '==', profile?.organizationId));
                  const snapshot = await getDocs(q);
                  result = { frameworks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
                } else if (call.name === "get_active_risks") {
                  const q = query(collection(db, 'risks'), where('organizationId', '==', profile?.organizationId));
                  const snapshot = await getDocs(q);
                  result = { risks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
                } else if (call.name === "get_incident_playbooks") {
                  const q = query(collection(db, 'incidents'), where('organizationId', '==', profile?.organizationId));
                  const snapshot = await getDocs(q);
                  result = { incidents: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
                } else if (call.name === "get_vendor_risk_summary") {
                  const q = query(collection(db, 'vendors'), where('organizationId', '==', profile?.organizationId));
                  const snapshot = await getDocs(q);
                  result = { vendors: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
                } else if (call.name === "get_audit_readiness_status") {
                  const q = query(collection(db, 'audit_readiness'), where('organizationId', '==', profile?.organizationId));
                  const snapshot = await getDocs(q);
                  result = { readinessReports: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
                } else if (call.name === "get_policy_inventory") {
                  const q = query(collection(db, 'policies'), where('organizationId', '==', profile?.organizationId));
                  const snapshot = await getDocs(q);
                  result = { policies: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
                }

                await sessionRef.current?.sendToolResponse({
                  functionResponses: [{
                    name: call.name,
                    id: call.id,
                    response: { result }
                  }]
                });
              }
              setIsProcessing(false);
            }
            
            // Handle interruption
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              setAiResponse("");
            }
          },
          onclose: () => {
            setIsConnected(false);
            stopRecording();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error. Please try again.");
            setIsConnected(false);
            stopRecording();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "get_compliance_gaps",
                  description: "Get the latest compliance framework status and AI gap analysis results for the organization.",
                },
                {
                  name: "get_active_risks",
                  description: "Get the current risk register, including impact and likelihood scores.",
                },
                {
                  name: "get_incident_playbooks",
                  description: "Get active incidents and their associated AI-generated remediation playbooks.",
                },
                {
                  name: "get_vendor_risk_summary",
                  description: "Get a summary of third-party vendors and their security assessment results.",
                },
                {
                  name: "get_audit_readiness_status",
                  description: "Get the latest AI-driven audit readiness scores and identified red flags.",
                },
                {
                  name: "get_policy_inventory",
                  description: "Get the current list of security policies and their enforcement status.",
                }
              ]
            }
          ],
          systemInstruction: { 
            parts: [{ 
              text: `You are Guardentra AI, the primary autonomous intelligence for Guardentra GRC. 
              Your goal is to provide elite GRC advice with extreme precision.
              You have real-time access to the entire GRC data stack:
              - Compliance Gaps (get_compliance_gaps)
              - Active Risks & Threat Landscape (get_active_risks)
              - Incident Response & Playbooks (get_incident_playbooks)
              - Third-Party Vendor Risks (get_vendor_risk_summary)
              - AI Audit Readiness & Red Flags (get_audit_readiness_status)
              - Policy Status (get_policy_inventory)

              When a user asks about their security posture, you MUST fetch the latest data from relevant tools.
              If you detect "qualified" audit red flags or high-impact risks, raise an alert in your spoken advice.
              Be professional, authoritative, but calm. Your tone should inspire confidence in the user's compliance strategy.
              Always summarize your data-driven findings before giving strategic recommendations.` 
            }] 
          },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to initialize AI session.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      if (!audioContextRef.current) return;

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(CHUNK_SIZE, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (!isConnected || isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        
        // Update visualizer
        const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
        const avg = sum / inputData.length;
        setVisualizerData(prev => {
          const next = [...prev.slice(1), avg * 100];
          return next;
        });

        // Send to Gemini
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current?.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setError("Microphone access is required for live interaction.");
    }
  };

  const stopRecording = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const disconnect = () => {
    sessionRef.current?.close();
    stopRecording();
    setIsConnected(false);
    setAiResponse("");
    setTranscription([]);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white font-display flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            Guardentra AI Live
          </h1>
          <p className="text-slate-400 mt-1">Real-time bidirectional GRC intelligence advisor.</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
          isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          {isConnected ? 'LIVE SESSION ACTIVE' : 'OFFLINE'}
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3"
        >
          <Shield className="h-5 w-5 shrink-0" />
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-slate-900/50 border-white/10 backdrop-blur-xl relative overflow-hidden h-[500px] flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Advisor Stream
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 p-6 overflow-y-auto font-mono text-sm space-y-4">
            {isProcessing && (
              <div className="flex items-center gap-2 text-primary animate-pulse text-xs mb-4">
                <Activity className="h-4 w-4" />
                ANALYZING GRC DATA STACK...
              </div>
            )}
            {aiResponse ? (
              <div className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                {aiResponse}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                {!isConnected ? (
                  <>
                    <div className="p-4 bg-white/5 rounded-full">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                    <p>Start a session to interact with Guardentra AI</p>
                    <Button onClick={startConnection} className="bg-primary hover:bg-primary/90 text-white px-8">
                      Initialize Session
                    </Button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Guardentra AI is listening...</p>
                  </>
                )}
              </div>
            )}
          </CardContent>

          {isConnected && (
            <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleMute}
                  className={isMuted ? "text-rose-400 bg-rose-500/10" : "text-slate-400"}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <div className="flex items-end gap-1 h-8">
                  {visualizerData.map((val, i) => (
                    <motion.div 
                      key={i}
                      animate={{ height: isMuted ? 2 : Math.max(2, val) }}
                      className="w-1 bg-primary rounded-full"
                    />
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={disconnect} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                End Session
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-400">Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Real-time Risk Assessment",
                "Compliance Gap Analysis",
                "Incident Response Strategy",
                "Policy Review & Drafting"
              ].map((cap, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {cap}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-indigo-500/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-indigo-300">Live Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Latency</span>
                <span className="text-emerald-400 font-mono">~120ms</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Sample Rate</span>
                <span className="text-slate-300 font-mono">16kHz</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Modality</span>
                <span className="text-slate-300 font-mono">Audio/Text</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
