import PublicLayout from '@/components/layout/PublicLayout'
import AnnouncementBar from '@/components/home/AnnouncementBar'
import HeroSection from '@/components/home/HeroSection'
import ServiceSpotlight from '@/components/home/ServiceSpotlight'
import ScrollThread from '@/components/home/ScrollThread'
import VideoHighlight from '@/components/home/VideoHighlight'
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
      {/* One hairline threads the opening statement into the capability
          grid, drawing as the reader scrolls and retracting as they scroll
          back, so the two sections read as one continuous passage. */}
      <ScrollThread>
        <ServiceSpotlight />
        <ServicesSection initialGroups={data.groups} />
      </ScrollThread>
      {/* The Case Record strip: the film still, the firm's proof figures,
          and a three-card taste of the cases won, in one band. The full
          record, client testimonials, and the pro bono / CSR work all live
          on /impact: this page is an introduction, not the whole proof. */}
      <VideoHighlight caseResults={data.caseResults} />
      {/* Recognition sits between the case record and the people, so the
          proof runs cases, then awards, then the team who won them. Renders
          only when the backend actually has awards. */}
      <AwardsPreview initialAwards={data.awards} />
      <TeamPreview initialTeam={data.team} />
      <LatestFromSection initialInsights={data.insights} initialBlogPosts={data.blogPosts} initialEvents={data.events} />
      <CoverageMap initialAreas={data.coverage} />
      {/* The consultation CTA and mail signup live at the top of the
          footer, which follows immediately. */}
    </PublicLayout>
  )
}
