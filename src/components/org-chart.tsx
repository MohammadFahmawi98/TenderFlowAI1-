"use client";

export interface OrgRole {
  title: string;
  count: number;
  tier: "management" | "mid" | "operational";
}

export interface OrgChartData {
  projectName: string;
  hardServices: OrgRole[];
  softServices: OrgRole[];
}

const CENTRAL_SUPPORT = [
  "Finance Team", "Supply Team", "Human Resources",
  "Training & Recruitment", "Call Centre Services", "Energy Management",
  "Health & Safety", "Quality", "Environmental & Sustainability",
  "Corporate Social Responsibility", "Marketing", "IT Support", "Transport",
];

const MAROON = "#8B3520";
const GOLD   = "#C8A24A";
const SALMON = "#d4956a";
const GRAY   = "#888888";
const BLUE   = "#4472C4";
const NAVY   = "#1e3a6b";
const LBLUE  = "#6b8ed4";
const DGRAY  = "#555555";

// ─── Detailed Chart (EIH Maroon style — Chart 1) ────────────────────────────

export function OrgChartDetailed({ data }: { data: OrgChartData }) {
  const hs = data.hardServices;
  const ss = data.softServices;

  const hsNamed = hs.filter((r) => r.tier !== "operational");
  const hsOps   = hs.filter((r) => r.tier === "operational");
  const ssNamed = ss.filter((r) => r.tier !== "operational");
  const ssOps   = ss.filter((r) => r.tier === "operational");

  const hsTotal = hs.reduce((s, r) => s + r.count, 0);
  const ssTotal = ss.reduce((s, r) => s + r.count, 0);

  // Layout constants
  const W        = 1140;
  const ROLE_H   = 26;
  const ROLE_GAP = 4;
  const OPS_ROW  = 18;
  const OPS_PAD  = 24;

  const HS_X = 268;
  const HS_W = 290;
  const SS_X = 610;
  const SS_W = 290;
  const HS_CX = HS_X + HS_W / 2;
  const SS_CX = SS_X + SS_W / 2;

  const HEADER_Y  = 60;
  const HEADER_H  = 40;
  const BRANCH_Y  = HEADER_Y + HEADER_H + 22;
  const COL_H_Y   = BRANCH_Y + 18;
  const COL_H_H   = 28;
  const ROLES_Y   = COL_H_Y + COL_H_H + ROLE_GAP;

  const hsNamedH = hsNamed.length * (ROLE_H + ROLE_GAP);
  const hsOpsH   = Math.max(hsOps.length * OPS_ROW + OPS_PAD, 60);
  const ssNamedH = ssNamed.length * (ROLE_H + ROLE_GAP);
  const ssOpsH   = Math.max(ssOps.length * OPS_ROW + OPS_PAD, 60);

  const maxColH = Math.max(hsNamedH + hsOpsH, ssNamedH + ssOpsH);
  const H = ROLES_Y + maxColH + 90;

  function tierColor(t: OrgRole["tier"]): string {
    if (t === "management") return GOLD;
    if (t === "mid") return SALMON;
    return GRAY;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
         style={{ width: "100%", fontFamily: "Arial, sans-serif" }}>

      {/* Central Support Panel */}
      <rect x="5" y="48" width="162" height={CENTRAL_SUPPORT.length * 22 + 28} rx="4" fill={DGRAY} />
      <text x="86" y="66" textAnchor="middle" fontSize="10" fontWeight="700" fill="white">Central Support</text>
      {CENTRAL_SUPPORT.map((dept, i) => (
        <g key={dept}>
          <line x1="10" x2="163" y1={74 + i * 22} y2={74 + i * 22} stroke="white" strokeWidth="0.3" opacity="0.3" />
          <text x="86" y={88 + i * 22} textAnchor="middle" fontSize="8.5" fill="#ddd">{dept}</text>
        </g>
      ))}

      {/* HS Total gold oval */}
      <ellipse cx="220" cy={HEADER_Y + HEADER_H / 2} rx="42" ry="30" fill={GOLD} />
      <text x="220" y={HEADER_Y + HEADER_H / 2 - 8} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">HS Total</text>
      <text x="220" y={HEADER_Y + HEADER_H / 2 + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">Manpower</text>
      <text x="220" y={HEADER_Y + HEADER_H / 2 + 17} textAnchor="middle" fontSize="14" fontWeight="900" fill="white">{hsTotal}</text>

      {/* SS Total gold oval */}
      <ellipse cx={SS_X + SS_W + 52} cy={HEADER_Y + HEADER_H / 2} rx="42" ry="30" fill={GOLD} />
      <text x={SS_X + SS_W + 52} y={HEADER_Y + HEADER_H / 2 - 8} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">SS Total</text>
      <text x={SS_X + SS_W + 52} y={HEADER_Y + HEADER_H / 2 + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">Manpower</text>
      <text x={SS_X + SS_W + 52} y={HEADER_Y + HEADER_H / 2 + 17} textAnchor="middle" fontSize="14" fontWeight="900" fill="white">{ssTotal}</text>

      {/* Manager icon */}
      <circle cx={HS_X - 22} cy={HEADER_Y + HEADER_H / 2} r="18" fill={GRAY} />
      <circle cx={HS_X - 22} cy={HEADER_Y + HEADER_H / 2 - 6} r="7" fill="white" opacity="0.9" />
      <ellipse cx={HS_X - 22} cy={HEADER_Y + HEADER_H / 2 + 16} rx="12" ry="9" fill="white" opacity="0.9" />

      {/* Project header */}
      <rect x={HS_X} y={HEADER_Y} width={SS_X + SS_W - HS_X} height={HEADER_H} rx="4" fill={MAROON} />
      <text x={(HS_X + SS_X + SS_W) / 2} y={HEADER_Y + HEADER_H / 2 + 6} textAnchor="middle"
            fontSize="18" fontWeight="700" fill="white">{data.projectName}</text>

      {/* Connectors */}
      <line x1={(HS_X + SS_X + SS_W) / 2} x2={(HS_X + SS_X + SS_W) / 2}
            y1={HEADER_Y + HEADER_H} y2={BRANCH_Y} stroke="#aaa" strokeWidth="1.5" />
      <line x1={HS_CX} x2={SS_CX} y1={BRANCH_Y} y2={BRANCH_Y} stroke="#aaa" strokeWidth="1.5" />
      <line x1={HS_CX} x2={HS_CX} y1={BRANCH_Y} y2={COL_H_Y} stroke="#aaa" strokeWidth="1.5" />
      <line x1={SS_CX} x2={SS_CX} y1={BRANCH_Y} y2={COL_H_Y} stroke="#aaa" strokeWidth="1.5" />

      {/* Hard Services header */}
      <rect x={HS_X} y={COL_H_Y} width={HS_W} height={COL_H_H} rx="3" fill={MAROON} />
      <text x={HS_CX} y={COL_H_Y + COL_H_H / 2 + 5} textAnchor="middle"
            fontSize="12" fontWeight="700" fill="white">Hard Services</text>

      {/* HS named roles */}
      {hsNamed.map((r, i) => (
        <g key={r.title}>
          <rect x={HS_X} y={ROLES_Y + i * (ROLE_H + ROLE_GAP)}
                width={HS_W} height={ROLE_H} rx="2" fill={tierColor(r.tier)} />
          <text x={HS_CX} y={ROLES_Y + i * (ROLE_H + ROLE_GAP) + ROLE_H / 2 + 5}
                textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
            {r.title} ×{r.count}
          </text>
        </g>
      ))}

      {/* HS operational group box */}
      {hsOps.length > 0 && (
        <g>
          <rect x={HS_X} y={ROLES_Y + hsNamedH} width={HS_W} height={hsOpsH} rx="2" fill={GRAY} />
          {hsOps.map((r, i) => (
            <text key={r.title} x={HS_CX}
                  y={ROLES_Y + hsNamedH + OPS_PAD / 2 + 8 + i * OPS_ROW}
                  textAnchor="middle" fontSize="8.5" fill="white">
              {r.title} ×{r.count}
            </text>
          ))}
        </g>
      )}

      {/* HS count badge */}
      <ellipse cx={HS_CX} cy={ROLES_Y + hsNamedH + hsOpsH + 26} rx="24" ry="20" fill={BLUE} />
      <text x={HS_CX} y={ROLES_Y + hsNamedH + hsOpsH + 32} textAnchor="middle"
            fontSize="15" fontWeight="900" fill="white">{hsTotal}</text>

      {/* Soft Services header */}
      <rect x={SS_X} y={COL_H_Y} width={SS_W} height={COL_H_H} rx="3" fill={MAROON} />
      <text x={SS_CX} y={COL_H_Y + COL_H_H / 2 + 5} textAnchor="middle"
            fontSize="12" fontWeight="700" fill="white">Soft Services</text>

      {/* SS named roles */}
      {ssNamed.map((r, i) => (
        <g key={r.title}>
          <rect x={SS_X} y={ROLES_Y + i * (ROLE_H + ROLE_GAP)}
                width={SS_W} height={ROLE_H} rx="2" fill={tierColor(r.tier)} />
          <text x={SS_CX} y={ROLES_Y + i * (ROLE_H + ROLE_GAP) + ROLE_H / 2 + 5}
                textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
            {r.title} ×{r.count}
          </text>
        </g>
      ))}

      {/* SS operational group box */}
      {ssOps.length > 0 && (
        <g>
          <rect x={SS_X} y={ROLES_Y + ssNamedH} width={SS_W} height={ssOpsH} rx="2" fill={GRAY} />
          {ssOps.map((r, i) => (
            <text key={r.title} x={SS_CX}
                  y={ROLES_Y + ssNamedH + OPS_PAD / 2 + 8 + i * OPS_ROW}
                  textAnchor="middle" fontSize="8.5" fill="white">
              {r.title} ×{r.count}
            </text>
          ))}
        </g>
      )}

      {/* SS count badge */}
      <ellipse cx={SS_CX} cy={ROLES_Y + ssNamedH + ssOpsH + 26} rx="24" ry="20" fill={BLUE} />
      <text x={SS_CX} y={ROLES_Y + ssNamedH + ssOpsH + 32} textAnchor="middle"
            fontSize="15" fontWeight="900" fill="white">{ssTotal}</text>
    </svg>
  );
}

// ─── Summary Chart (Navy / Blue style — Chart 2) ─────────────────────────────

export function OrgChartSummary({ data }: { data: OrgChartData }) {
  const hs = data.hardServices;
  const ss = data.softServices;

  const hsNamed = hs.filter((r) => r.tier !== "operational");
  const hsOps   = hs.filter((r) => r.tier === "operational");
  const ssNamed = ss.filter((r) => r.tier !== "operational");
  const ssOps   = ss.filter((r) => r.tier === "operational");

  const hsTotal     = hs.reduce((s, r) => s + r.count, 0);
  const ssTotal     = ss.reduce((s, r) => s + r.count, 0);
  const grandTotal  = hsTotal + ssTotal;

  // Named labels
  const hsNamedLabel = hsNamed.map((r) => `${r.title} ×${r.count}`).join(", ");
  const hsOpsLabel   = hsOps.length ? hsOps.map((r) => `${r.title} ×${r.count}`).join(", ") : `Technicians ×${hsTotal - hsNamed.reduce((s, r) => s + r.count, 0)}`;
  const ssNamedLabel = ssNamed.map((r) => `${r.title} ×${r.count}`).join(", ");
  const ssOpsLabel   = ssOps.length ? ssOps.map((r) => `${r.title} ×${r.count}`).join(", ") : `Cleaners ×${ssTotal - ssNamed.reduce((s, r) => s + r.count, 0)}`;

  const W = 1140;
  const H = 380;

  const HS_X = 200;
  const HS_W = 340;
  const SS_X = 600;
  const SS_W = 340;
  const HS_CX = HS_X + HS_W / 2;
  const SS_CX = SS_X + SS_W / 2;
  const MID_CX = (HS_X + SS_X + SS_W) / 2;

  const HEADER_Y = 62;
  const HEADER_H = 42;
  const BRANCH_Y = HEADER_Y + HEADER_H + 20;
  const COL_Y    = BRANCH_Y + 16;
  const COL_H    = 32;
  const TIER2_Y  = COL_Y + COL_H + 6;
  const TIER2_H  = 32;
  const TIER3_Y  = TIER2_Y + TIER2_H + 6;
  const TIER3_H  = 32;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
         style={{ width: "100%", fontFamily: "Arial, sans-serif" }}>

      {/* Total oval */}
      <ellipse cx="90" cy={HEADER_Y + HEADER_H / 2} rx="46" ry="32" fill={MAROON} />
      <text x="90" y={HEADER_Y + HEADER_H / 2 - 10} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">Total of</text>
      <text x="90" y={HEADER_Y + HEADER_H / 2 + 1} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">Manpower</text>
      <text x="90" y={HEADER_Y + HEADER_H / 2 + 16} textAnchor="middle" fontSize="16" fontWeight="900" fill="white">{grandTotal}</text>

      {/* Manager icon */}
      <circle cx="168" cy={HEADER_Y + HEADER_H / 2} r="20" fill={GRAY} />
      <circle cx="168" cy={HEADER_Y + HEADER_H / 2 - 7} r="8" fill="white" opacity="0.9" />
      <ellipse cx="168" cy={HEADER_Y + HEADER_H / 2 + 18} rx="14" ry="10" fill="white" opacity="0.9" />

      {/* Project header — navy */}
      <rect x="195" y={HEADER_Y} width={SS_X + SS_W - 195} height={HEADER_H} rx="4" fill={NAVY} />
      <text x={(195 + SS_X + SS_W) / 2} y={HEADER_Y + HEADER_H / 2 + 7} textAnchor="middle"
            fontSize="18" fontWeight="700" fill="white">{data.projectName}</text>

      {/* Connectors */}
      <line x1={MID_CX} x2={MID_CX} y1={HEADER_Y + HEADER_H} y2={BRANCH_Y} stroke="#aaa" strokeWidth="1.5" />
      <line x1={HS_CX} x2={SS_CX} y1={BRANCH_Y} y2={BRANCH_Y} stroke="#aaa" strokeWidth="1.5" />
      <line x1={HS_CX} x2={HS_CX} y1={BRANCH_Y} y2={COL_Y} stroke="#aaa" strokeWidth="1.5" />
      <line x1={SS_CX} x2={SS_CX} y1={BRANCH_Y} y2={COL_Y} stroke="#aaa" strokeWidth="1.5" />

      {/* HS column */}
      <rect x={HS_X} y={COL_Y} width={HS_W} height={COL_H} rx="4" fill={BLUE} />
      <text x={HS_CX} y={COL_Y + COL_H / 2 + 6} textAnchor="middle" fontSize="13" fill="white">Hard Services</text>

      <line x1={HS_CX} x2={HS_CX} y1={COL_Y + COL_H} y2={TIER2_Y} stroke="#aaa" strokeWidth="1.2" />
      <rect x={HS_X} y={TIER2_Y} width={HS_W} height={TIER2_H} rx="3" fill={LBLUE} />
      <text x={HS_CX} y={TIER2_Y + TIER2_H / 2 + 5} textAnchor="middle" fontSize="10" fill="white">
        {hsNamedLabel || `Engineers ×${hsNamed.reduce((s, r) => s + r.count, 0)}`}
      </text>

      <line x1={HS_CX} x2={HS_CX} y1={TIER2_Y + TIER2_H} y2={TIER3_Y} stroke="#aaa" strokeWidth="1.2" />
      <rect x={HS_X} y={TIER3_Y} width={HS_W} height={TIER3_H} rx="3" fill={GRAY} />
      <text x={HS_CX} y={TIER3_Y + TIER3_H / 2 + 5} textAnchor="middle" fontSize="10" fill="white">{hsOpsLabel}</text>

      {/* SS column */}
      <rect x={SS_X} y={COL_Y} width={SS_W} height={COL_H} rx="4" fill={BLUE} />
      <text x={SS_CX} y={COL_Y + COL_H / 2 + 6} textAnchor="middle" fontSize="13" fill="white">Soft Services</text>

      <line x1={SS_CX} x2={SS_CX} y1={COL_Y + COL_H} y2={TIER2_Y} stroke="#aaa" strokeWidth="1.2" />
      <rect x={SS_X} y={TIER2_Y} width={SS_W} height={TIER2_H} rx="3" fill={LBLUE} />
      <text x={SS_CX} y={TIER2_Y + TIER2_H / 2 + 5} textAnchor="middle" fontSize="10" fill="white">
        {ssNamedLabel || `Supervisors ×${ssNamed.reduce((s, r) => s + r.count, 0)}`}
      </text>

      <line x1={SS_CX} x2={SS_CX} y1={TIER2_Y + TIER2_H} y2={TIER3_Y} stroke="#aaa" strokeWidth="1.2" />
      <rect x={SS_X} y={TIER3_Y} width={SS_W} height={TIER3_H} rx="3" fill={GRAY} />
      <text x={SS_CX} y={TIER3_Y + TIER3_H / 2 + 5} textAnchor="middle" fontSize="10" fill="white">{ssOpsLabel}</text>
    </svg>
  );
}
