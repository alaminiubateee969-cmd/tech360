import PublicSiteApp from '@/components/site/PublicSiteApp'

// Next page entries only accept framework props. The reusable client shell
// (also used by the path catch-all) owns its initial route/blog inputs.
export default function Page() {
  return <PublicSiteApp />
}
