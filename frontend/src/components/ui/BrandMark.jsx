export default function BrandMark({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Clinic logo"
    >
      <rect width="64" height="64" rx="14" fill="var(--color-brand-700)" />
      <rect x="27" y="15" width="10" height="34" rx="2" fill="#ffffff" />
      <rect x="15" y="27" width="34" height="10" rx="2" fill="#ffffff" />
    </svg>
  )
}
