import { SITE_NAME } from '../brand/site'

export function SiteTopBar() {
  return (
    <header className="site-topbar">
      <div className="site-topbar-inner">
        <a className="site-brand" href="/" aria-label={`${SITE_NAME} home`}>
          <span className="site-name">{SITE_NAME}</span>
        </a>
      </div>
    </header>
  )
}
