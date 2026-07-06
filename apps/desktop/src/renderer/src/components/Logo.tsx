interface LogoProps {
  size?: number;
}

function Logo({ size = 48 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="logo-icon"
    >
      {/* Gradient Definitions */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
      </defs>

      {/* Brain/Memory Icon - Simplified modern style */}
      <g className="logo-brain">
        {/* Left hemisphere */}
        <path
          d="M 30 35 Q 20 35, 20 45 Q 20 55, 25 60 Q 30 65, 35 65 L 35 40 Q 35 35, 30 35 Z"
          fill="url(#logoGradient)"
          opacity="0.9"
        />

        {/* Right hemisphere */}
        <path
          d="M 70 35 Q 80 35, 80 45 Q 80 55, 75 60 Q 70 65, 65 65 L 65 40 Q 65 35, 70 35 Z"
          fill="url(#logoGradient)"
          opacity="0.9"
        />

        {/* Center connection */}
        <rect x="35" y="40" width="30" height="25" rx="3" fill="url(#logoGradient)" />

        {/* Neural connections */}
        <circle cx="40" cy="48" r="3" fill="url(#accentGradient)" />
        <circle cx="50" cy="45" r="3" fill="url(#accentGradient)" />
        <circle cx="60" cy="50" r="3" fill="url(#accentGradient)" />
        <line
          x1="40"
          y1="48"
          x2="50"
          y2="45"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          opacity="0.6"
        />
        <line
          x1="50"
          y1="45"
          x2="60"
          y2="50"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          opacity="0.6"
        />
      </g>

      {/* Memo lines at bottom */}
      <g className="logo-memo" opacity="0.8">
        <line
          x1="30"
          y1="75"
          x2="70"
          y2="75"
          stroke="url(#logoGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="35"
          y1="82"
          x2="65"
          y2="82"
          stroke="url(#logoGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
        <line
          x1="40"
          y1="89"
          x2="60"
          y2="89"
          stroke="url(#logoGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
    </svg>
  );
}

export default Logo;
