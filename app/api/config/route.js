import { getSetting } from '../../../lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    siteName: getSetting('site_name', 'TrendHub'),
    siteDescription: getSetting('site_description', '实时聚合 GitHub Trending、科技资讯与前沿论文'),
    registrationEnabled: getSetting('registration_enabled', '1') === '1',
  });
}
