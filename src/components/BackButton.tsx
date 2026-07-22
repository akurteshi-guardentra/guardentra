import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface BackButtonProps {
  className?: string;
  to?: string;
}

export function BackButton({ className, to }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-slate-400 hover:text-white transition-colors flex items-center gap-2 mb-4", className)}
      onClick={() => to ? navigate(to) : navigate(-1)}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back</span>
    </Button>
  );
}
