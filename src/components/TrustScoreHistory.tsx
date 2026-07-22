import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrustScoreDetails } from '../lib/TrustScoreEngine';

interface TrustScoreHistoryProps {
  scoreDetails: TrustScoreDetails;
}

export function TrustScoreHistory({ scoreDetails }: TrustScoreHistoryProps) {
  const { history } = scoreDetails;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950/90 border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold leading-none mb-1">
            {payload[0].payload.month} Assessment
          </p>
          <p className="text-sm font-bold text-white flex items-center gap-1 font-mono">
            Trust Index: <span className="text-indigo-400 font-extrabold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-slate-900/40 border-white/5 backdrop-blur-md overflow-hidden text-white">
      <CardHeader>
        <CardTitle className="text-xs font-bold tracking-[0.2em] uppercase text-slate-400">
          Historical Governance Progress
        </CardTitle>
        <CardDescription className="text-[10px] text-slate-500">
          Track continuous evaluation cycles over the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent className="h-64 sm:h-72">
        <div className="w-full h-full text-xs font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis 
                dataKey="month" 
                stroke="#64748b" 
                tickLine={false} 
                axisLine={false} 
                className="text-[10px] font-bold"
              />
              <YAxis 
                domain={[50, 100]} 
                ticks={[50, 60, 70, 80, 90, 100]}
                stroke="#64748b" 
                tickLine={false} 
                axisLine={false} 
                className="text-[10px] font-bold"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorScore)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
