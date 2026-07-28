import PublicLayout from '@/components/layout/PublicLayout'
import AnnouncementBar from '@/components/home/AnnouncementBar'
import HeroSection from '@/components/home/HeroSection'
import ServiceSpotlight from '@/components/home/ServiceSpotlight'
import VideoHighlight from '@/components/home/VideoHighlight'
import NotableResults from '@/components/home/NotableResults'
import ServicesSection from '@/components/home/ServicesSection'
import LatestFromSection from '@/components/home/LatestFromSection'
import TeamPreview from '@/components/home/TeamPreview'
import AwardsPreview from '@/components/home/AwardsPreview'
import CoverageMap from '@/components/map/CoverageMap'
import { getHomePageData } from '@/lib/homeData'

// A Server Component, not a client one: every section below used to fetch
// its own data client-side in a useEffect, twelve independent round trips
// firing after an empty first paint. Fetched once here, in parallel,
// server-side, and handed down as props instead, so the page arrives with
// its content already in it rather than filling in section by section
// over the following several seconds.
export const revalidate = 30

export default async function HomePage() {
  const data = await getHomePageData()

  return (
    <PublicLayout fullBleedTop>
      <HeroSection />
      {/* Renders only when a news item is pushed to announcement. */}
      <AnnouncementBar initialAnnouncement={data.announcement} />
      <ServiceSpotlight />
      <ServicesSection initialGroups={data.groups} />
      <VideoHighlight />
      {/* A three-card taste of the case record. The full record, client
          testimonials, and the pro bono / CSR work all live on /impact
          now: this page is an introduction, not the whole proof. */}
      <NotableResults initialResults={data.caseResults} />
      <TeamPreview initialTeam={data.team} />
      <LatestFromSection initialInsights={data.insights} initialBlogPosts={data.blogPosts} initialEvents={data.events} />
      <CoverageMap initialAreas={data.coverage} />
      {/* Renders only when the backend actually has awards. */}
      <AwardsPreview initialAwards={data.awards} />
      {/* The consultation CTA and mail signup live at the top of the
          footer, which follows immediately. */}
    </PublicLayout>
  )
}
