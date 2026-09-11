interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const svgProps = ({ size = 20, className, strokeWidth = 2 }: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
});

/** Stroke icons traced from the design mockups (hint bulb, penalty bolt, keyboard backspace...). */
export const HintIcon = (props: IconProps) => (
  <svg {...svgProps(props)}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
  </svg>
);

export const LightningIcon = (props: IconProps) => (
  <svg {...svgProps(props)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);

export const BackspaceIcon = (props: IconProps) => (
  <svg {...svgProps(props)}>
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <path d="m18 9-6 6" />
    <path d="m12 9 6 6" />
  </svg>
);

export const CopyIcon = (props: IconProps) => (
  <svg {...svgProps(props)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...svgProps({ strokeWidth: 3, ...props })}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <svg {...svgProps({ strokeWidth: 2.5, ...props })}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...svgProps(props)}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const MinusIcon = (props: IconProps) => (
  <svg {...svgProps(props)}>
    <path d="M5 12h14" />
  </svg>
);
