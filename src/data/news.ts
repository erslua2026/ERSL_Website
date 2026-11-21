export type NewsCategory = 'publication' | 'achievement' | 'field' | 'blog' | 'general';

export interface NewsItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  link?: string;
  category?: NewsCategory;
  image?: string; // URL, Box direct static link, or base64 data URI
  imageCaption?: string;
  displaySize?: 'auto' | 'compact' | 'wide' | 'full';
}

// Public news shown on the home page. Newest first.
// Lab members can edit or add items directly via the website interface (saved to Supabase cloud).
export const newsItems: NewsItem[] = [
  {
    id: 'n-1',
    date: '2026-09-15',
    category: 'achievement',
    title: 'ERSL welcomes new graduate researchers for Fall 2026',
    summary:
      'The lab has expanded its research cohort with graduate researchers focusing on SWOT satellite altimetry, inland water quality modeling, and GeoAI flood estimation.',
    link: '#people',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'n-2',
    date: '2026-08-02',
    category: 'publication',
    title: 'New paper on satellite-based flood inundation and depth mapping',
    summary:
      'Our latest peer-reviewed study on reach-scale flood depth modeling across the Mobile and Black Warrior River basins is now published. Explore the paper in the Publications catalog.',
    link: '#publications',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'n-3',
    date: '2026-06-20',
    category: 'field',
    title: 'Field campaign: UAV LiDAR, multispectral imaging and ADCP river surveys',
    summary:
      'The ERSL team successfully completed a coordinated hydrological field survey calibrated against synchronized NASA satellite passes. View field photo captures in the Field tab.',
    link: '#field',
    image: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=900&q=80',
  },
];
