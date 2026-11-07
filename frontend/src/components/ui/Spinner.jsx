import { CircleNotch } from '@phosphor-icons/react'

export default function Spinner({ size = 18, className = '' }) {
  return <CircleNotch size={size} className={`animate-spin ${className}`} aria-hidden="true" />
}
