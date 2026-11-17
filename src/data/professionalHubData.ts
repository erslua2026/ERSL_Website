export interface ProfSubSection {
  id: string;
  label: string;
  icon: string;
  kind: 'guides' | 'links';
}

export interface ProfResourceLink {
  id: string;
  subSectionId: string;
  category: string;
  title: string;
  description: string;
  url: string;
  boxUrl?: string;
  tags: string[];
}

export const initialProfSubSections: ProfSubSection[] = [
  { id: 'guides', label: 'Mentorship Guides', icon: '📚', kind: 'guides' },
  { id: 'useful_links', label: 'Useful Links', icon: '🔗', kind: 'links' },
  { id: 'databases', label: 'Databases', icon: '🗄️', kind: 'links' },
  { id: 'links_tools', label: 'Links & Tools', icon: '🧰', kind: 'links' },
];

export const initialProfLinks: ProfResourceLink[] = [
  {
    id: 'pl-1',
    subSectionId: 'useful_links',
    category: 'Scientific Writing',
    title: 'Overleaf IEEE & Elsevier Remote Sensing Templates',
    description: 'Official LaTeX templates for IEEE TGRS, Remote Sensing of Environment, and AGU Water Resources Research.',
    url: 'https://www.overleaf.com/gallery/tagged/academic-journal',
    tags: ['LaTeX', 'Manuscripts'],
  },
  {
    id: 'pl-2',
    subSectionId: 'useful_links',
    category: 'Funding & Fellowships',
    title: 'NASA FINESST & NSPIRES Portal',
    description: 'Federal Earth Science fellowship announcements, guidelines, and submission portal.',
    url: 'https://nspires.nasaprs.com/',
    tags: ['NASA', 'FINESST', 'Grants'],
  },
  {
    id: 'pl-3',
    subSectionId: 'useful_links',
    category: 'Lab Cloud Storage',
    title: 'UA Box ERSL Manuscript & Poster Templates',
    description: 'Shared UA Box folder with AGU/IGARSS poster templates, vector logos, and response letter drafts.',
    url: 'https://ua.box.com',
    boxUrl: 'https://ua.box.com',
    tags: ['Box', 'Templates'],
  },
  {
    id: 'db-1',
    subSectionId: 'databases',
    category: 'Satellite Archives',
    title: 'NASA Earthdata Search (SWOT, MODIS, VIIRS, NISAR)',
    description: 'Primary portal for SWOT Level-2 river/lake altimetry, MODIS snow cover, and NASA Earth observation granules.',
    url: 'https://search.earthdata.nasa.gov/',
    tags: ['SWOT', 'NASA', 'Satellite'],
  },
  {
    id: 'db-2',
    subSectionId: 'databases',
    category: 'Satellite Archives',
    title: 'Copernicus Data Space Ecosystem (Sentinel-1/2/3)',
    description: 'Direct access to Sentinel-1 SAR, Sentinel-2 MSI, and Sentinel-3 OLCI coastal & inland water products.',
    url: 'https://dataspace.copernicus.eu/',
    tags: ['Sentinel-1', 'Sentinel-2', 'OLCI'],
  },
  {
    id: 'db-3',
    subSectionId: 'databases',
    category: 'Hydrology & In-Situ',
    title: 'USGS National Water Information System (NWIS)',
    description: 'Real-time and historical stream gauge discharge, stage, turbidity, and water quality measurements.',
    url: 'https://waterdata.usgs.gov/nwis',
    tags: ['USGS', 'Discharge', 'Water Quality'],
  },
  {
    id: 'lt-1',
    subSectionId: 'links_tools',
    category: 'Cloud Computing',
    title: 'Google Earth Engine Code Editor & Catalog',
    description: 'Planetary-scale cloud geospatial analysis platform for Landsat, Sentinel, and hydrography datasets.',
    url: 'https://code.earthengine.google.com/',
    tags: ['GEE', 'Cloud'],
  },
  {
    id: 'lt-2',
    subSectionId: 'links_tools',
    category: 'Citation & Literature',
    title: 'OpenAlex & CrossRef DOI Explorer',
    description: 'Open scholarly metadata databases used by ERSL to track citations and synchronize publications.',
    url: 'https://openalex.org/',
    tags: ['OpenAlex', 'Citations'],
  },
];

