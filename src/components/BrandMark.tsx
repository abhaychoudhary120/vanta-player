export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vanta-mark" x1="7" y1="4" x2="33" y2="36">
          <stop stopColor="#B5A9FF" />
          <stop offset="0.52" stopColor="#8B7CFF" />
          <stop offset="1" stopColor="#4DE3C1" />
        </linearGradient>
        <linearGradient id="vanta-mark-fill" x1="8" y1="8" x2="33" y2="32">
          <stop stopColor="#8B7CFF" stopOpacity="0.3" />
          <stop offset="1" stopColor="#4DE3C1" stopOpacity="0.08" />
        </linearGradient>
        <filter id="vanta-mark-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11.5"
        fill="url(#vanta-mark-fill)"
        stroke="white"
        strokeOpacity="0.14"
      />
      <path
        d="M11.6 10.8L20 29.2L28.4 10.8"
        stroke="url(#vanta-mark)"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#vanta-mark-glow)"
      />
      <path
        d="M15.1 18.9H24.9"
        stroke="white"
        strokeOpacity="0.72"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
