import type { CSSProperties } from "react";

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

// Original, non-trademarked insignia -- an abstract star/wing mark evoking
// the theme without reproducing any copyrighted franchise logo.
export function AllianceInsignia({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path
        d="M24 6 L29 20 L44 24 L29 28 L24 42 L19 28 L4 24 L19 20 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MenuIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
