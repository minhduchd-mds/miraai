import type { ReactNode, SVGProps } from 'react';

function ShellSvg({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
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
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconCamera = (props: SVGProps<SVGSVGElement>) => (
  <ShellSvg {...props}>
    <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
    <circle cx="12" cy="13" r="3.4" />
  </ShellSvg>
);

export const IconCameraOff = (props: SVGProps<SVGSVGElement>) => (
  <ShellSvg {...props}>
    <path d="M3 3l18 18" />
    <path d="M9.6 4h4.9L16 6h4a2 2 0 0 1 2 2v9.2" />
    <path d="M21 17.5a2 2 0 0 1-1 .5H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
    <path d="M9.6 10.2a3.4 3.4 0 0 0 4.4 4.6" />
  </ShellSvg>
);

export const IconSettings = (props: SVGProps<SVGSVGElement>) => (
  <ShellSvg {...props}>
    <path d="M5 7h14M5 12h14M5 17h14" />
    <circle cx="9" cy="7" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="8" cy="17" r="2" />
  </ShellSvg>
);


export const IconMic = (props: SVGProps<SVGSVGElement>) => (
  <ShellSvg {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17v4M8.5 21h7" />
  </ShellSvg>
);

export const IconPhoneOff = (props: SVGProps<SVGSVGElement>) => (
  <ShellSvg {...props}>
    <path d="M5 14.5c4.3-3.3 9.7-3.3 14 0" />
    <path d="M7.2 13.1l-1.4 3.3M16.8 13.1l1.4 3.3" />
  </ShellSvg>
);
