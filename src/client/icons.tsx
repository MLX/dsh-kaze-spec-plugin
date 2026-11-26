/** Small inline icons: no icon package, no external assets. */
import type { ReactNode, SVGProps } from 'react'

type IconProps = { readonly size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>

function Svg({ size = 13, children, ...rest }: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function ChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4 6 4 4 4-4" />
    </Svg>
  )
}

export function ChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3 5 8l5 5" />
    </Svg>
  )
}

export function ChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 3 5 5-5 5" />
    </Svg>
  )
}

export function Refresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 3v3.5H9.5" />
    </Svg>
  )
}

export function Search(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="4.2" />
      <path d="m10.2 10.2 3 3" />
    </Svg>
  )
}

export function Close(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  )
}

export function Plus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Svg>
  )
}

export function Check(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Svg>
  )
}

export function Play(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3.5v9l7-4.5-7-4.5Z" />
    </Svg>
  )
}

export function Sync(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.5 5.5A5 5 0 0 0 4 4.2L2.5 6" />
      <path d="M2.5 3v3h3" />
      <path d="M3.5 10.5A5 5 0 0 0 12 11.8l1.5-1.8" />
      <path d="M13.5 13v-3h-3" />
    </Svg>
  )
}

export function ArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" />
    </Svg>
  )
}

export function Shield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2.5 13 4v3.7c0 3-2.1 5-5 5.8-2.9-.8-5-2.8-5-5.8V4l5-1.5Z" />
      <path d="m5.8 8 1.5 1.5 3-3" />
    </Svg>
  )
}

export function Comment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3.75A1.75 1.75 0 0 1 4.75 2h6.5A1.75 1.75 0 0 1 13 3.75v5.5A1.75 1.75 0 0 1 11.25 11H7.5L4 13.5V11h-.25A1.75 1.75 0 0 1 2 9.25v-5.5Z" />
    </Svg>
  )
}

export function Copy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
    </Svg>
  )
}

export function Send(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m2.5 8 11-5-5 11-1.4-4.6L2.5 8Z" />
      <path d="M7.1 9.4 13.5 3" />
    </Svg>
  )
}

export function Trash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.6 8a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.6-8" />
    </Svg>
  )
}

export function Archive(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 5.5h11v8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M1.5 2.5h13v3h-13z" />
      <path d="M6.5 8.5h3" />
    </svg>
  )
}

export function Edit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3 10.5-.5 3 3-.5 7-7-2.5-2.5-7 7Z" />
      <path d="m9.5 3.5 2.5 2.5" />
    </Svg>
  )
}

export function Doc(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 2h5l3 3v9H4V2Z" />
      <path d="M9 2v3h3M6 8h4M6 10.5h4" />
    </Svg>
  )
}

export function Clock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 4.8v3.5l2.2 1.3" />
    </Svg>
  )
}

export function Spark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2.5 9.4 6 13 7.4 9.4 8.8 8 12.3 6.6 8.8 3 7.4 6.6 6 8 2.5Z" />
    </Svg>
  )
}
