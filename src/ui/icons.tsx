import type { SVGProps, ReactNode } from 'react';

// Bộ icon OUTLINE dùng chung (nét currentColor, đồng bộ toàn app). Kích thước theo .ico trong CSS.
function Svg({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
    <circle cx="12" cy="13" r="3.4" />
  </Svg>
);

export const IconCameraOff = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M9.6 4h4.9L16 6h4a2 2 0 0 1 2 2v9.2" />
    <path d="M21 17.5a2 2 0 0 1-1 .5H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
    <path d="M9.6 10.2a3.4 3.4 0 0 0 4.4 4.6" />
  </Svg>
);

export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8.5" cy="8.5" r="1.6" />
    <path d="m21 15-4.5-4.5L6 21" />
  </Svg>
);

export const IconCube = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M21 7.8 12 3 3 7.8v8.4L12 21l9-4.8V7.8Z" />
    <path d="M3 7.8 12 12.6l9-4.8" />
    <path d="M12 12.6V21" />
  </Svg>
);

export const IconOrb = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9Z" />
  </Svg>
);

export const IconPerson = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M5 7h14M5 12h14M5 17h14" />
    <circle cx="9" cy="7" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);

export const IconMic = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Svg>
);

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconChevronUp = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);

export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 4v5h-5" />
  </Svg>
);

export const IconShirt = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M9 3 5 5 3 9l3 1.5V21h12V10.5L21 9l-2-4-4-2a3 3 0 0 1-6 0Z" />
  </Svg>
);

export const IconScene = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8" cy="9" r="1.6" />
    <path d="m3 17 5-4.5 4 3.5 3-2.5 6 5" />
  </Svg>
);

export const IconRepeat = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M17 3l3.5 3.5L17 10" />
    <path d="M3 11V9.5A3.5 3.5 0 0 1 6.5 6h14" />
    <path d="M7 21l-3.5-3.5L7 14" />
    <path d="M21 13v1.5a3.5 3.5 0 0 1-3.5 3.5h-14" />
  </Svg>
);

export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3Z" />
    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
  </Svg>
);

export const IconSpeech = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M21 11.5a8 7 0 0 1-11.6 6.2L4 19l1.3-4A7 7 0 0 1 5 11.5 8 7 0 0 1 21 11.5Z" />
    <path d="M9 11h.01M12.5 11h.01M16 11h.01" />
  </Svg>
);

export const IconBrain = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M10 5a2.5 2.5 0 0 0-4.6 1.3A3 3 0 0 0 4 11.5a3 3 0 0 0 1.5 5A2.5 2.5 0 0 0 10 18V5Z" />
    <path d="M14 5a2.5 2.5 0 0 1 4.6 1.3A3 3 0 0 1 20 11.5a3 3 0 0 1-1.5 5A2.5 2.5 0 0 1 14 18V5Z" />
  </Svg>
);

export const IconHand = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4.5" />
    <path d="M10 10.5V4.5a1.5 1.5 0 0 1 3 0v6" />
    <path d="M13 10.5V6a1.5 1.5 0 0 1 3 0v6.5a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3l-1.8-3.1a1.5 1.5 0 0 1 2.6-1.5L7 13.5" />
  </Svg>
);

// ── Tính cách (persona) ──
export const IconSmile = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
    <path d="M9 9.5h.01M15 9.5h.01" />
  </Svg>
);

export const IconBriefcase = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
    <path d="M3 12.5h18" />
  </Svg>
);

export const IconSparkles = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3.5 13.7 8 18 9.7 13.7 11.5 12 16l-1.7-4.5L6 9.7 10.3 8 12 3.5Z" />
    <path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
  </Svg>
);

export const IconFlower = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 9.6C12 6.5 10.7 4 12 4s1.3 2.5 0 5.6" />
    <path d="M12 14.4c0 3.1 1.3 5.6 0 5.6s-1.3-2.5 0-5.6" />
    <path d="M9.6 12C6.5 12 4 10.7 4 12s2.5 1.3 5.6 0" />
    <path d="M14.4 12c3.1 0 5.6-1.3 5.6 0s-2.5 1.3-5.6 0" />
  </Svg>
);

// Map theo id persona (voice-prefs) → icon outline.
export const PERSONA_ICON: Record<string, (p: SVGProps<SVGSVGElement>) => JSX.Element> = {
  friendly: IconSmile,
  pro: IconBriefcase,
  playful: IconSparkles,
  gentle: IconFlower,
};
