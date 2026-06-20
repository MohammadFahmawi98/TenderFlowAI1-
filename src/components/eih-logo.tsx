interface EIHLogoProps {
  size?: number;
  variant?: "dark" | "light";
  showText?: boolean;
}

export function EIHLogo({ size = 40, variant = "dark", showText = false }: EIHLogoProps) {
  const arch   = variant === "light" ? "white" : "#8B2500";
  const frond  = variant === "light" ? "rgba(255,255,255,0.88)" : "#C8A24A";
  const text   = variant === "light" ? "white" : "#8B2500";
  const vbH    = showText ? 305 : 230;

  return (
    <svg
      width={size}
      height={showText ? Math.round(size * (vbH / 200)) : size}
      viewBox={`0 0 200 ${vbH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Crescent arch */}
      <path
        d="M 12 220 C 12 90 100 10 100 10 C 100 10 188 90 188 220 L 164 220 C 164 152 100 38 100 38 C 100 38 36 152 36 220 Z"
        fill={arch}
      />
      {/* Extra left wedge — calligraphic weight on left side */}
      <path d="M 12 220 C 12 140 18 85 40 58 L 36 220 Z" fill={arch}/>

      {/* Gold palm fronds — all pivot at arch peak (100, 38) */}
      <path d="M 100 38 Q 94 14 100 -2 Q 106 14 100 38 Z" fill={frond}/>

      <g transform="rotate(-15, 100, 38)">
        <path d="M 100 38 Q 94 15 100 0 Q 106 15 100 38 Z" fill={frond}/>
      </g>
      <g transform="rotate(15, 100, 38)">
        <path d="M 100 38 Q 94 15 100 0 Q 106 15 100 38 Z" fill={frond}/>
      </g>

      <g transform="rotate(-32, 100, 38)">
        <path d="M 100 38 Q 94 18 100 4 Q 106 18 100 38 Z" fill={frond}/>
      </g>
      <g transform="rotate(32, 100, 38)">
        <path d="M 100 38 Q 94 18 100 4 Q 106 18 100 38 Z" fill={frond}/>
      </g>

      <g transform="rotate(-52, 100, 38)">
        <path d="M 100 38 Q 95 22 100 10 Q 105 22 100 38 Z" fill={frond}/>
      </g>
      <g transform="rotate(52, 100, 38)">
        <path d="M 100 38 Q 95 22 100 10 Q 105 22 100 38 Z" fill={frond}/>
      </g>

      {showText && (
        <text
          x="100"
          y="290"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="700"
          fontSize="60"
          letterSpacing="10"
          fill={text}
        >
          EIH
        </text>
      )}
    </svg>
  );
}
