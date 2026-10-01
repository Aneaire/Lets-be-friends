import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

type InfiniteScrollStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

export function InfiniteScrollTrigger({
  status,
  onLoadMore,
  loadingLabel,
  className,
  rootMargin = '600px 0px',
}: {
  status: InfiniteScrollStatus
  onLoadMore: () => void
  loadingLabel: string
  className?: string
  rootMargin?: string
}) {
  const { ref, inView } = useInView({ rootMargin, triggerOnce: false })

  useEffect(() => {
    if (inView && status === 'CanLoadMore') onLoadMore()
  }, [inView, status, onLoadMore])

  if (status !== 'CanLoadMore' && status !== 'LoadingMore') return null

  return (
    <div ref={ref} className={className ?? 'infinite-scroll-trigger'}>
      <p className="text-meta tabular mt-3" role="status">
        {loadingLabel}
      </p>
    </div>
  )
}
