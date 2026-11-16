import type { SVGProps } from 'react'

/**
 * Baby-care icons drawn on the same 24px grid / 1.75 stroke as lucide,
 * so they sit naturally next to lucide UI icons.
 */
type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Breastfeeding: heart with a milk drop. */
export function BreastIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
      <path d="M12 8.6c1.3 1.6 2.2 2.8 2.2 3.8a2.2 2.2 0 1 1-4.4 0c0-1 .9-2.2 2.2-3.8z" />
    </Svg>
  )
}

/** Feeding bottle. */
export function BottleIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M10.5 5V3.6a1.5 1.5 0 0 1 3 0V5" />
      <path d="M8.5 5h7" />
      <path d="M9.5 5v1.6C8 7.5 7 9 7 10.8V19a2.5 2.5 0 0 0 2.5 2.5h5A2.5 2.5 0 0 0 17 19v-8.2c0-1.8-1-3.3-2.5-4.2V5" />
      <path d="M7 12.5h2.5M7 16h2.5" />
    </Svg>
  )
}

/** Breast pump: flange + collection bottle. */
export function PumpIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M4 3.5h9l-3 4.5" />
      <path d="M10 8v1.5" />
      <path d="M8 9.5h6v9.5a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 8 19z" />
      <path d="M8 14h6" />
      <path d="M17.5 6.5c1.2 1.5 2 2.7 2 3.7a2 2 0 1 1-4 0c0-1 .8-2.2 2-3.7z" />
    </Svg>
  )
}

/** Diaper. */
export function DiaperIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 6.5h18v3.2c0 5.4-4 9.3-9 9.3s-9-3.9-9-9.3z" />
      <path d="M3 9.5h3.5M17.5 9.5H21" />
      <path d="M9 14c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4" />
    </Svg>
  )
}

/** Sleep: crescent moon with a small star. */
export function SleepIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      <path d="M16.5 3.5v3M15 5h3" />
    </Svg>
  )
}

/** App mark: bottle inside a soft rounded square (used on login). */
export function AppMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <rect width="72" height="72" rx="22" fill="var(--color-primary)" />
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32.5 19v-3a3.5 3.5 0 0 1 7 0v3" />
        <path d="M28 19h16" />
        <path d="M30 19v3.5c-3 1.8-5 5-5 8.5v17a5 5 0 0 0 5 5h12a5 5 0 0 0 5-5V31c0-3.5-2-6.7-5-8.5V19" />
      </g>
      <path d="M25 38h22v10a5 5 0 0 1-5 5H30a5 5 0 0 1-5-5z" fill="#fff" opacity=".9" />
    </svg>
  )
}
