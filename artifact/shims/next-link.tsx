import { forwardRef, type AnchorHTMLAttributes } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean }

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...rest }, ref) {
  void _p
  void _r
  void _s
  return <a ref={ref} href={href.startsWith('/') ? '#' + href : href} {...rest} />
})
export default Link
