interface Props {
  value: number | null
  onChange?: (v: number) => void
  size?: number
}

export default function Stars({ value, onChange, size = 20 }: Props) {
  return (
    <span className="stars" style={{ fontSize: size, lineHeight: 1 }} role={onChange ? 'radiogroup' : undefined} aria-label="التقييم">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${value != null && n <= Math.round(value) ? 'on' : ''}`}
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          aria-label={`${n} نجوم`}
          style={{ cursor: onChange ? 'pointer' : 'default' }}
        >★</button>
      ))}
    </span>
  )
}
