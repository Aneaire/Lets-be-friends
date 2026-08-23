type IoniconsProps = {
  color?: string
  name: string
  size?: number
}

export default function Ionicons({ color = 'currentColor', size = 20 }: IoniconsProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: color,
        borderRadius: '50%',
        display: 'inline-block',
        height: size,
        width: size,
      }}
    />
  )
}
