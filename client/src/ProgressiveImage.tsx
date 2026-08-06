import { ImgHTMLAttributes, useEffect, useRef, useState } from 'react'

type ProgressiveImageProps = ImgHTMLAttributes<HTMLImageElement> & { eager?: boolean }

export function ProgressiveImage({ className = '', eager = false, onLoad, onError, src, ...props }: ProgressiveImageProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const image = imageRef.current
    if (!image?.complete) setState('loading')
    else setState(image.naturalWidth > 0 ? 'loaded' : 'error')
  }, [src])

  return <img
    {...props}
    ref={imageRef}
    src={src}
    className={`${className} progressive-image is-${state}`.trim()}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    onLoad={(event) => { setState('loaded'); onLoad?.(event) }}
    onError={(event) => { setState('error'); onError?.(event) }}
  />
}
