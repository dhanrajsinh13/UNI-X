"use client";
import Link from 'next/link';
import React, { useState, useCallback } from 'react';
import CreatePostModal from './CreatePostModal';
import AuthModal from './AuthModal';
import SearchModal, { DesktopSearchPanel } from './SearchModal';
import { useAuth } from '../contexts/AuthContext';
import Image from 'next/image'

const Navbar = () => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutClicked, setLogoutClicked] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = useCallback(() => {
    if (!logoutClicked) {
      // First click - show confirmation
      setLogoutClicked(true);
      // Reset after 3 seconds
      setTimeout(() => setLogoutClicked(false), 3000);
    } else {
      // Second click - actually logout
      setIsLoggingOut(true);
      logout();
    }
  }, [logoutClicked, logout]);

  const handleCreatePostOpen = useCallback(() => {
    setIsCreatePostOpen(true);
  }, []);

  const handleCreatePostClose = useCallback(() => {
    setIsCreatePostOpen(false);
  }, []);

  const handleAuthModalOpen = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const handleAuthModalClose = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  // Mobile search modal handlers
  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  // Desktop search panel handlers
  const handleDesktopSearchToggle = useCallback(() => {
    setIsDesktopSearchOpen(prev => !prev);
  }, []);

  const handleDesktopSearchClose = useCallback(() => {
    setIsDesktopSearchOpen(false);
  }, []);

  // Don't show navbar on landing page or when user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar - Instagram Style */}
      <aside className={`hidden md:flex fixed left-0 top-0 bottom-0 bg-white border-r border-border-light z-fixed flex-col justify-between py-8 px-4 transition-all duration-300 ease-in-out ${isDesktopSearchOpen ? 'w-20' : 'w-60'}`}>
        <div>
          <Link href="/" className="flex items-center px-4 mb-8 transition-opacity duration-300">
            <Image src="/uni-x_logo.png" alt="UNI-X" width={40} height={40} className="w-10 h-10 mr-3" />
            <span className={`font-bold text-2xl bg-gradient-to-r from-text to-accent bg-clip-text text-transparent transition-opacity duration-300 ${isDesktopSearchOpen ? 'opacity-0 w-0' : 'opacity-100'}`}>
              UNI-X
            </span>
          </Link>
          {user ? (
            <nav className="space-y-2">
              <SidebarItem href="/" icon="/SVG/home.svg" label="Home" collapsed={isDesktopSearchOpen} />
              <SidebarItem href="/uniwall" icon="/SVG/uniwall.svg" label="UniWall" collapsed={isDesktopSearchOpen} />
              <SidebarButton
                icon="/SVG/search.svg"
                label="Search"
                onClick={handleDesktopSearchToggle}
                active={isDesktopSearchOpen}
                collapsed={isDesktopSearchOpen}
              />
              <SidebarButton icon="/SVG/post.svg" label="Create" onClick={handleCreatePostOpen} collapsed={isDesktopSearchOpen} />
              <SidebarItem href="/messages" icon="/SVG/messages.svg" label="Messages" collapsed={isDesktopSearchOpen} />
              <SidebarItem href="/notifications" icon="/SVG/notifications.svg" label="Notifications" collapsed={isDesktopSearchOpen} />
              <SidebarItem href="/profile/me" icon="/SVG/profile.svg" label="Profile" collapsed={isDesktopSearchOpen} />
            </nav>
          ) : (
            <div className="px-2">
              <button
                onClick={handleAuthModalOpen}
                className="btn-primary w-full"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
        {user && (
          <div className="space-y-2 border-t border-border-light pt-4">
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all duration-200 ${isDesktopSearchOpen ? 'justify-center' : ''}`}
            >
              <Image src="/SVG/settings.svg" alt="Settings" width={20} height={20} className="w-5 h-5" />
              {!isDesktopSearchOpen && <span className="text-sm font-medium text-text">Settings</span>}
            </Link>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full ${isDesktopSearchOpen ? 'justify-center' : ''} ${isLoggingOut
                ? 'bg-gray-100 text-text-tertiary cursor-not-allowed'
                : logoutClicked
                  ? 'bg-error/10 text-error hover:bg-error/20'
                  : 'hover:bg-gray-50 text-text'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {!isDesktopSearchOpen && (
                <span className="text-sm font-medium">
                  {isLoggingOut
                    ? 'Logging out...'
                    : logoutClicked
                      ? 'Click again to confirm'
                      : 'Logout'
                  }
                </span>
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Desktop Search Panel - Slides out next to sidebar */}
      <DesktopSearchPanel
        isOpen={isDesktopSearchOpen}
        onClose={handleDesktopSearchClose}
      />


      {/* Mobile Bottom Navigation - Instagram Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border-light z-fixed safe-bottom">
        <div className="flex justify-around items-center py-2 px-2">
          {user ? (
            <>
              <MobileNavItem href="/" icon="/SVG/home.svg" />
              <MobileNavItem href="/uniwall" icon="/SVG/uniwall.svg" />
              <MobilePostNavButton icon="/SVG/post.svg" onClick={handleCreatePostOpen} />
              <MobileNavItem href="/messages" icon="/SVG/messages.svg" />
              <MobileNavItem href="/profile/me" icon="/SVG/profile.svg" />
            </>
          ) : (
            <div className="flex justify-center w-full py-2">
              <button
                onClick={handleAuthModalOpen}
                className="btn-primary"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Modals */}
      <CreatePostModal isOpen={isCreatePostOpen} onClose={handleCreatePostClose} />
      <AuthModal isOpen={isAuthModalOpen} onClose={handleAuthModalClose} />
      {/* Mobile Search Modal - Only used on mobile when triggered from other places */}
      <SearchModal isOpen={isSearchOpen} onClose={handleSearchClose} variant="modal" />
    </>
  );
};

// Nav item components with SVG icon support
const SidebarItem = ({ href, icon, label, collapsed = false }: { href: string; icon: string; label: string; collapsed?: boolean }) => (
  <Link
    href={href}
    className={`flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all duration-200 group ${collapsed ? 'justify-center' : ''}`}
  >
    {icon.startsWith('/') ? (
      <Image src={icon} alt={label} width={24} height={24} className="w-6 h-6 opacity-80 group-hover:opacity-100 transition-opacity" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
    {!collapsed && <span className="text-base font-medium text-text">{label}</span>}
  </Link>
);

const SidebarButton = ({
  icon,
  label,
  onClick,
  active = false,
  collapsed = false
}: {
  icon: string;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  collapsed?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left group ${collapsed ? 'justify-center' : ''} ${active
        ? 'bg-gray-100 font-semibold'
        : 'hover:bg-gray-50'
        }`}
    >
      {icon.startsWith('/') ? (
        <Image
          src={icon}
          alt={label || 'icon'}
          width={24}
          height={24}
          className={`w-6 h-6 transition-all ${active ? 'opacity-100 scale-110' : 'opacity-80 group-hover:opacity-100'}`}
        />
      ) : (
        <span className="text-2xl">{icon}</span>
      )}
      {!collapsed && label && <span className="text-base font-medium text-text">{label}</span>}
    </button>
  );
};

const MobileNavItem = ({ href, icon }: { href: string; icon: string }) => (
  <Link
    href={href}
    className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 active:scale-95 transition-all duration-fast"
  >
    {icon.startsWith('/') ? (
      <Image src={icon} alt="Navigation icon" width={24} height={24} className="w-6 h-6" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
  </Link>
);

const MobilePostNavButton = ({ icon, onClick }: { icon: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 active:scale-95 transition-all duration-fast"
  >
    {icon.startsWith('/') ? (
      <Image src={icon} alt="Post icon" width={24} height={24} className="w-6 h-6" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
  </button>
);

export default Navbar;
