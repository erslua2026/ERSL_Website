import React, { useState } from 'react';
import { Search } from 'lucide-react';
import {
  LogIn, LogOut, Shield, FolderGit2, Menu, X, ChevronDown,
  UserCircle, Sliders, Lock
} from 'lucide-react';
import { SiteConfig, TabConfig } from '../types';
import { filterSiteSearchItems, SiteSearchItem } from '../lib/siteSearch';

interface UAHeaderProps {
  currentUser: { name: string; email: string; role: string; avatarUrl?: string } | null;
  siteConfig: SiteConfig;
  onLoginClick: () => void;
  onLogout: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onAdminClick: () => void;
  onOpenCustomizer?: () => void;
  searchableItems?: SiteSearchItem[];
  onNavigateSearch?: (item: SiteSearchItem) => void;
}

const getCleanInitials = (name?: string): string => {
  if (!name || typeof name !== 'string') return 'UA';
  const parts = name.trim().split(/\s+/).filter(p => {
    const lower = p.toLowerCase().replace(/\./g, '');
    return !['dr', 'prof', 'professor', 'phd', 'candidate', 'postdoc', 'researcher'].includes(lower);
  });
  if (parts.length === 0 || !parts[0]) return 'UA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || 'UA';
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase() || 'UA';
};

export const UAHeader: React.FC<UAHeaderProps> = ({
  currentUser,
  siteConfig,
  onLoginClick,
  onLogout,
  currentTab,
  onTabChange,
  onAdminClick,
  onOpenCustomizer,
  searchableItems = [],
  onNavigateSearch,
}) => {
  const [siteSearch, setSiteSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchMatches = siteSearch.trim().length > 1
    ? filterSiteSearchItems(searchableItems, siteSearch, 15)
    : [];
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoSrcIndex, setLogoSrcIndex] = useState(0);

  const cleanBase = (import.meta.env.BASE_URL || './').endsWith('/')
    ? (import.meta.env.BASE_URL || './')
    : (import.meta.env.BASE_URL || './') + '/';

  const logoCandidates = [
    ...(siteConfig.logoUrl?.trim() ? [siteConfig.logoUrl.trim()] : []),
    'https://alabama.box.com/shared/static/bl5k9qrcbymh4xgvlt03u8fdw81j8vlq.jpg',
    `${cleanBase}images/logo/logo.jpg`,
    `${cleanBase}images/logo/logo.png`,
    'images/logo/logo.jpg',
    'images/logo/logo.png',
    '/images/logo/logo.jpg',
    '/images/logo/logo.png',
  ];

  const handleLogoError = () => {
    if (logoSrcIndex + 1 < logoCandidates.length) {
      setLogoSrcIndex(prev => prev + 1);
    } else {
      setLogoFailed(true);
    }
  };

  const isVertical = siteConfig.layoutMode === 'vertical-left' || siteConfig.layoutMode === 'vertical-right';
  const isCompact = siteConfig.compactMode || siteConfig.layoutMode === 'horizontal-compact';
  const isAdmin = currentUser?.role === 'Admin';

  const visibleTabs: TabConfig[] = siteConfig.tabs.filter(t => {
    if (t.visibility === 'hidden') return false;
    if (t.visibility === 'members' && !currentUser) return false;
    if (t.visibility === 'admin' && !isAdmin) return false;
    return true;
  });

  const primaryColor = siteConfig.primaryColor || '#9E1B32';
  const headerBg = siteConfig.headerBgColor || '#ffffff';
  const headerText = siteConfig.headerTextColor || '#0f172a';
  const isDarkHeader = headerBg.toLowerCase().startsWith('#0') || headerBg.toLowerCase().startsWith('#1') || headerBg.toLowerCase().startsWith('#2') || headerBg.toLowerCase().startsWith('#7') || headerBg.toLowerCase().startsWith('#9');

  const handleSelectSearchMatch = (item: SiteSearchItem) => {
    onNavigateSearch?.(item);
    setSiteSearch('');
    setSearchFocused(false);
    setMobileMenuOpen(false);
  };

  const renderSearchBox = (variant: 'horizontal' | 'sidebar' | 'mobile') => {
    const accent = siteConfig.subheadingColor || primaryColor || '#9E1B32';
    const isSidebar = variant === 'sidebar';
    const isMobile = variant === 'mobile';
    return (
      <div className="relative">
        <form
          onSubmit={e => {
            e.preventDefault();
            if (searchMatches.length > 0) {
              handleSelectSearchMatch(searchMatches[0]);
            }
          }}
          className={`flex items-center rounded-lg overflow-hidden border border-gray-300/80 bg-white/95 backdrop-blur-md shadow-2xs ${
            isSidebar || isMobile ? 'w-full' : ''
          }`}
        >
          <input
            type="text"
            value={siteSearch}
            onChange={e => setSiteSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            placeholder={currentUser ? 'Search all pages, news, projects...' : 'Search This Site...'}
            className={`${isSidebar || isMobile ? 'flex-1 min-w-0' : 'w-48 xl:w-64'} px-3 py-1.5 text-xs text-slate-800 bg-transparent focus:outline-none`}
          />
          {siteSearch && (
            <button
              type="button"
              onMouseDown={() => setSiteSearch('')}
              className="px-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="submit"
            style={{ backgroundColor: primaryColor }}
            className="px-2.5 py-2 text-white hover:opacity-90 cursor-pointer flex items-center justify-center shrink-0"
            title="Search ERSL"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </form>

        {searchFocused && siteSearch.trim().length > 1 && (
          <div
            className={`${
              isSidebar ? 'left-0 right-0 w-full' : isMobile ? 'left-0 right-0 w-full' : 'right-0 w-96'
            } absolute mt-1.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 text-left max-h-80 overflow-y-auto`}
          >
            {searchMatches.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-500">
                No matching items for &ldquo;{siteSearch}&rdquo;.
              </div>
            ) : (
              searchMatches.map(match => (
                <button
                  key={match.id}
                  type="button"
                  onMouseDown={() => handleSelectSearchMatch(match)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-red-50/60 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: accent }}>
                    {match.tabLabel || match.tab}
                  </span>
                  <p className="text-xs font-bold text-slate-900 truncate">{match.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{match.subtitle}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLogo = (sizeClass: string) => (
    <div
      className={`relative flex items-center justify-center ${sizeClass} rounded-full overflow-hidden shrink-0`}
    >
      {logoFailed ? (
        <div
          className="w-full h-full rounded-full text-white flex flex-col items-center justify-center text-[10px] font-black leading-tight"
          style={{ backgroundColor: primaryColor }}
        >
          <span>{siteConfig.labShortName || 'ERSL'}</span>
        </div>
      ) : (
        <img
          src={logoCandidates[logoSrcIndex]}
          onError={handleLogoError}
          alt="ERSL Logo"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain rounded-full"
          loading="eager"
        />
      )}
    </div>
  );

  // VERTICAL SIDEBAR RENDER (Desktop lg+) + Slim Mobile Top Bar
  if (isVertical) {
    return (
      <>
        {/* Mobile Top Bar (< lg) */}
        <header
          className={`lg:hidden w-full border-b sticky top-0 z-50 select-none ${
            siteConfig.themeStyle !== 'classic'
              ? (isDarkHeader ? 'macos-glass-nav-dark' : 'macos-glass-nav')
              : 'border-gray-200'
          }`}
          style={siteConfig.themeStyle !== 'classic' ? { color: headerText } : { backgroundColor: headerBg, color: headerText }}
        >
          <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
            <button onClick={() => onTabChange('home')} className="flex items-center gap-2.5 text-left cursor-pointer min-w-0 flex-1">
              {renderLogo('w-14 h-14 sm:w-16 sm:h-16')}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider block truncate" style={{ color: siteConfig.subheadingColor || primaryColor }}>
                  UA Geography · {siteConfig.labShortName}
                </span>
                <span className="text-xs sm:text-sm font-black leading-tight block truncate">{siteConfig.labFullName}</span>
              </div>
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {!currentUser ? (
                <button
                  onClick={onLoginClick}
                  className="text-white text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Login
                </button>
              ) : (
                <div
                  className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  {getCleanInitials(currentUser.name || currentUser.email)}
                </div>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-lg cursor-pointer">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-gray-200 bg-white text-slate-800 px-4 py-3 space-y-2 max-h-[75vh] overflow-y-auto">
              <div className="pb-1">{renderSearchBox('mobile')}</div>
              {visibleTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { onTabChange(tab.id); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer ${
                    currentTab === tab.id ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={currentTab === tab.id ? { backgroundColor: primaryColor } : undefined}
                >
                  <span>{tab.icon || '•'}</span>
                  <span>{tab.label}</span>
                  {tab.visibility === 'members' && <Lock className="w-3 h-3 ml-auto opacity-75" />}
                </button>
              ))}
              {isAdmin && onOpenCustomizer && (
                <button
                  onClick={() => { onOpenCustomizer(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" /> Customize Site & Layout
                </button>
              )}
              {currentUser && (
                <button
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              )}
            </div>
          )}
        </header>

        {/* Desktop Vertical Sidebar (lg+) */}
        <aside
          className={`hidden lg:flex flex-col w-64 shrink-0 border-gray-200 select-none sticky top-0 h-screen overflow-y-auto ${
            siteConfig.layoutMode === 'vertical-right' ? 'border-l' : 'border-r'
          } ${
            siteConfig.themeStyle !== 'classic'
              ? (isDarkHeader ? 'macos-glass-nav-dark' : 'macos-glass-nav')
              : ''
          }`}
          style={siteConfig.themeStyle !== 'classic' ? { color: headerText } : { backgroundColor: headerBg, color: headerText }}
        >
          {/* UA Brand Strip + Vertical ERSL Lockup */}
          <div className="bg-gradient-to-r from-[#9E1B32]/8 via-slate-100/95 to-red-50/80 text-slate-800 px-4 py-2 text-[10px] flex items-center justify-between border-b border-[#9E1B32]/15">
            <a href="https://www.ua.edu/" target="_blank" rel="noreferrer" className="font-bold uppercase tracking-wider text-slate-900 hover:text-[#9E1B32] transition-colors">
              Univ. of Alabama
            </a>
            <a href="https://mybama.ua.edu/" target="_blank" rel="noreferrer" className="text-slate-700 hover:text-[#9E1B32] font-semibold flex items-center gap-1 transition-colors">
              <UserCircle className="w-3 h-3" style={{ color: primaryColor }} />
              <span>myBama</span>
            </a>
          </div>

          <button
            onClick={() => onTabChange('home')}
            title="Go to ERSL Home"
            className="p-4 flex items-center gap-3 text-left border-b border-gray-200/30 cursor-pointer group"
          >
            {renderLogo('w-20 h-20')}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {siteConfig.labShortName}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider truncate" style={{ color: siteConfig.subheadingColor || primaryColor }}>
                  UA Geography
                </span>
              </div>
              <h1 className="font-black text-xs leading-snug mt-1 line-clamp-2 group-hover:opacity-80">
                {siteConfig.labFullName}
              </h1>
            </div>
          </button>

          {/* Universal Full-Site Search for Logged-In Members & Admins */}
          <div className="px-3 pt-3 pb-1 border-b border-gray-200/20">
            {renderSearchBox('sidebar')}
          </div>

          {/* Vertical Navigation Tabs */}
          <nav
            className={`flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto ${
              siteConfig.tabPosition === 'center'
                ? 'justify-center'
                : siteConfig.tabPosition === 'end'
                  ? 'justify-end'
                  : 'justify-start'
            }`}
          >
            {visibleTabs.map(tab => {
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-between transition-all cursor-pointer ${
                    active
                      ? 'text-white shadow-sm'
                      : isDarkHeader
                        ? 'text-slate-200 hover:bg-white/10'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={active ? { backgroundColor: primaryColor } : undefined}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-sm">{tab.icon || '•'}</span>
                    <span className="truncate">{tab.label}</span>
                  </span>
                  {(tab.visibility === 'members' || tab.visibility === 'admin') && (
                    <Lock className={`w-3 h-3 shrink-0 ${active ? 'text-white/80' : tab.visibility === 'admin' ? 'text-rose-500' : 'text-amber-500'}`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom User / Admin / Customizer Controls */}
          <div className="p-3 border-t border-gray-200/20 space-y-2">
            {isAdmin && onOpenCustomizer && (
              <button
                onClick={onOpenCustomizer}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-300/40 hover:bg-black/5 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span>Customize Site & Tabs</span>
              </button>
            )}

            {currentUser ? (
              <div className="space-y-1.5 bg-black/5 rounded-xl p-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {getCleanInitials(currentUser.name || currentUser.email)}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-bold truncate">{currentUser.name || currentUser.email}</p>
                    <p className="text-[10px] opacity-70 capitalize">{currentUser.role}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  {isAdmin && (
                    <button
                      onClick={onAdminClick}
                      className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg bg-white text-slate-800 border border-gray-200 hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Shield className="w-3 h-3" style={{ color: primaryColor }} /> Admin
                    </button>
                  )}
                  <button
                    onClick={onLogout}
                    className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="w-full text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Member Login</span>
              </button>
            )}
          </div>
        </aside>
      </>
    );
  }

  // HORIZONTAL TOP BAR RENDER (UA Official SDML-inspired 2-Tier + Apple Glass)
  const crimsonAccent = siteConfig.subheadingColor || primaryColor || '#9E1B32';
  const isGlass = siteConfig.themeStyle !== 'classic';

  return (
    <header className="w-full select-none z-50">
      {/* Row 0: Light Crimson-Tinted Institutional UA Top Strip */}
      <section className="bg-gradient-to-r from-[#9E1B32]/8 via-slate-50/95 to-red-50/85 backdrop-blur-md text-slate-800 py-1.5 px-4 md:px-8 border-b border-[#9E1B32]/15">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 text-[11px]">
          <a href="https://www.ua.edu/" target="_blank" rel="noreferrer" className="leading-tight group transition-colors">
            <span className="block font-bold tracking-wider uppercase text-[10px] md:text-[11px] text-slate-900 group-hover:text-[#9E1B32] transition-colors">
              THE UNIVERSITY OF ALABAMA<span className="text-[9px] align-top">®</span>
            </span>
            <span className="block text-[10px] italic text-slate-600 font-serif">
              Barefield College of Arts &amp; Sciences
            </span>
          </a>
          <div className="flex items-center gap-4">
            <a
              href="https://geography.ua.edu/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-slate-700 hover:text-[#9E1B32] font-medium transition-colors"
            >
              <span>🌐</span>
              <span>Department of Geography and the Environment</span>
            </a>
            <a
              href="https://mybama.ua.edu/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center text-slate-800 hover:text-[#9E1B32] font-semibold transition-colors bg-white/80 hover:bg-white px-2.5 py-0.5 rounded-full border border-[#9E1B32]/20 shadow-xs"
            >
              <UserCircle className="w-3.5 h-3.5 mr-1" style={{ color: crimsonAccent }} /> myBama Portal
            </a>
          </div>
        </div>
      </section>

      {/* Sticky Two-Tier Brand + Navigation Bar */}
      <nav
        className={`border-b shadow-xs sticky top-0 transition-all ${
          isGlass
            ? (isDarkHeader ? 'macos-glass-nav-dark' : 'macos-glass-nav')
            : 'border-gray-200'
        }`}
        style={isGlass ? { color: headerText } : { backgroundColor: headerBg, color: headerText }}
      >
        {/* Row 1: Text Brand Lockup (clicks Home, no logo icon here) + Site Search + Member Login */}
        <div className={`max-w-7xl mx-auto px-4 md:px-8 ${isCompact ? 'py-2.5' : 'py-3'} flex items-center justify-between gap-3`}>
          <button
            onClick={() => onTabChange('home')}
            title="Go to ERSL Home"
            className="text-left cursor-pointer group min-w-0 flex-1 transition-opacity hover:opacity-85"
          >
            <h1 className="font-black text-base sm:text-xl md:text-2xl lg:text-[28px] tracking-tight leading-tight break-words" style={{ color: primaryColor }}>
              {siteConfig.labFullName}
            </h1>
            <p className="text-[11px] sm:text-xs md:text-sm font-bold text-slate-700 leading-tight mt-0.5 sm:mt-1 truncate">
              {siteConfig.departmentName || 'Department of Geography & the Environment'}
            </p>
          </button>

          {/* Desktop Right: Site Search + Auth + Customizer */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            {renderSearchBox('horizontal')}

            {isAdmin && onOpenCustomizer && (
              <button
                onClick={onOpenCustomizer}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-300/60 hover:bg-black/5 flex items-center gap-1 cursor-pointer"
                title="Customize layout, colors & tabs"
              >
                <Sliders className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span>Customize</span>
              </button>
            )}

            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-2 py-1 px-2.5 rounded-full border border-gray-200 bg-white text-slate-800 cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: primaryColor }}>
                    {getCleanInitials(currentUser.name || currentUser.email)}
                  </div>
                  <span className="text-xs font-bold">{currentUser.name || 'Member'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white text-slate-800 rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
                    <div className="px-3.5 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold truncate">{currentUser.email}</p>
                      <span className="text-[10px] font-bold uppercase" style={{ color: primaryColor }}>{currentUser.role}</span>
                    </div>
                    <button onClick={() => { onTabChange('box'); setProfileDropdownOpen(false); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                      <FolderGit2 className="w-3.5 h-3.5 text-blue-600" /> Box Workspace
                    </button>
                    {isAdmin && (
                      <button onClick={() => { onAdminClick(); setProfileDropdownOpen(false); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                        <Shield className="w-3.5 h-3.5" style={{ color: primaryColor }} /> Admin Dashboard
                      </button>
                    )}
                    <button onClick={() => { onLogout(); setProfileDropdownOpen(false); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer">
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center space-x-1.5 text-white text-[13px] xl:text-sm font-bold py-2 px-4 rounded-xl cursor-pointer shadow-xs whitespace-nowrap"
                style={{ backgroundColor: primaryColor }}
              >
                <LogIn className="w-4 h-4" />
                <span>Member Login</span>
              </button>
            )}
          </div>

          {/* Mobile Burger */}
          <div className="flex lg:hidden items-center gap-2">
            {!currentUser && (
              <button onClick={onLoginClick} className="text-white text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: primaryColor }}>
                Login
              </button>
            )}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 cursor-pointer">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Row 2: Dedicated Left-Aligned Navigation Strip matching Brand start alignment */}
        <div className={`hidden lg:block border-t ${isGlass ? 'border-white/50 bg-white/10' : 'border-gray-200/70 bg-white/40'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-wrap items-center justify-start gap-x-1 gap-y-0.5 -ml-3.5">
              {visibleTabs.map(tab => {
                const active = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
                      active
                        ? 'bg-slate-200/75 text-[#9E1B32]'
                        : isDarkHeader
                          ? 'border-transparent text-slate-200 hover:bg-white/10'
                          : 'border-transparent text-slate-700 hover:text-[#9E1B32] hover:bg-white/75'
                    }`}
                    style={active ? { borderBottomColor: primaryColor, color: primaryColor } : undefined}
                  >
                    <span>{tab.label}</span>
                    {tab.visibility === 'members' && <Lock className="w-3 h-3 opacity-75" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white text-slate-800 py-3 px-4 space-y-2 max-h-[75vh] overflow-y-auto">
            <div className="pb-1">{renderSearchBox('mobile')}</div>
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setMobileMenuOpen(false); }}
                className={`w-full text-left py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-between cursor-pointer ${
                  currentTab === tab.id ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
                style={currentTab === tab.id ? { backgroundColor: primaryColor } : undefined}
              >
                <span>{tab.icon} {tab.label}</span>
                {tab.visibility === 'members' && <Lock className="w-3 h-3" />}
              </button>
            ))}
            {isAdmin && onOpenCustomizer && (
              <button onClick={() => { onOpenCustomizer(); setMobileMenuOpen(false); }} className="w-full text-left py-2 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                ⚙️ Customize Site
              </button>
            )}
            {currentUser && (
              <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="w-full text-left py-2 px-3 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                Logout
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  );
};
