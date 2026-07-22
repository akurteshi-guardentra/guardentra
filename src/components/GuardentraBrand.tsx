import React from 'react';

interface BrandProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
}

export function GuardentraLogo({ className = '', size = 'md', showText = true, textColor = 'text-white' }: BrandProps) {
  const sizeMap = {
    sm: { svg: 'h-6 w-6', text: 'text-sm' },
    md: { svg: 'h-8 w-8', text: 'text-lg' },
    lg: { svg: 'h-12 w-12', text: 'text-2xl' },
    xl: { svg: 'h-16 w-16', text: 'text-3xl' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* High-fidelity Vector representation of the Guardentra Shield Logo */}
      <svg
        className={`${currentSize.svg} text-indigo-500 shrink-0 select-none`}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Core Shield Shape */}
        <path
          d="M250 40C140 70 80 120 80 230C80 340 180 430 250 460C322 430 420 340 420 230C420 120 360 70 250 40Z"
          fill="url(#shieldGrad)"
          stroke="#1e1b4b"
          strokeWidth="8"
        />
        {/* Secondary inner contour for sleek, high-trust border */}
        <path
          d="M250 65C155 92 105 135 105 230C105 322 192 398 250 425C308 398 395 322 395 230C395 135 345 92 250 65Z"
          fill="#030712"
          opacity="0.85"
        />
        
        {/* Ascending Data Pillars on the left */}
        <path
          d="M170 250V330H195V230L170 250Z"
          fill="url(#primaryGrad)"
        />
        <path
          d="M205 210V335H230V180L205 210Z"
          fill="url(#primaryGrad)"
        />
        <path
          d="M240 160V340H265V135L240 160Z"
          fill="url(#primaryGrad)"
        />

        {/* The Sleek "G" integrated right into the Shield contour */}
        <path
          d="M290 170H340V195H290C250 195 230 220 230 260C230 300 250 325 290 325H340V245H310V220H365V350H290C220 350 195 310 195 260C195 210 220 170 290 170Z"
          fill="url(#accentGrad)"
        />

        {/* Dynamic glossy overlay shine */}
        <path
          d="M250 65C155 92 105 135 105 230C105 250 108 270 112 290C130 190 200 120 250 65Z"
          fill="white"
          opacity="0.08"
        />

        {/* Color gradients for high-end feel */}
        <defs>
          <linearGradient id="shieldGrad" x1="80" y1="40" x2="420" y2="460" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="50%" stopColor="#312e81" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <linearGradient id="primaryGrad" x1="170" y1="135" x2="265" y2="340" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="accentGrad" x1="195" y1="170" x2="365" y2="350" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <div className="flex flex-col select-none">
          <span className={`font-bold font-display tracking-tight leading-none ${textColor} ${currentSize.text}`}>
            Guard<span className="text-indigo-400">Entra</span>
          </span>
          <span className="text-[7.5px] text-slate-500 uppercase tracking-[0.25em] font-medium leading-none mt-1">
            Build Trust. Drive Confidence.
          </span>
        </div>
      )}
    </div>
  );
}
