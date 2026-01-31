"use client";
import Link from 'next/link';
import React, { useState, useCallback } from 'react';
import CreatePostModal from './CreatePostModal';
import AuthModal from './AuthModal';
import SearchModal from './SearchModal';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);
  
  // Don't show navbar on landing page or when user is not authenticated
  if (!user) {
    return null;
  }
  
  return (
    <>
      {/* Desktop Sidebar - Instagram Style */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-border-light z-fixed flex-col justify-between py-8 px-4">
        <div>
          <Link href="/" className="flex items-center px-4 mb-8">
            <img src="/uni-x_logo.png" alt="UNI-X" className="w-10 h-10 mr-3" />
            <span className="font-bold text-2xl bg-gradient-to-r from-text to-accent bg-clip-text text-transparent">UNI-X</span>
          </Link>
          {user ? (
          <nav className="space-y-2">
              <SidebarItem href="/" icon="/SVG/home.svg" label="Home" />
              <SidebarItem href="/uniwall" icon="/SVG/uniwall.svg" label="UniWall" />
              <SidebarButton icon="/SVG/search.svg" label="Search" onClick={handleSearchOpen} />
              <SidebarButton icon="/SVG/post.svg" label="Create" onClick={handleCreatePostOpen} />
              <SidebarItem href="/messages" icon="/SVG/messages.svg" label="Messages" />
              <SidebarItem href="/notifications" icon="/SVG/notifications.svg" label="Notifications" />
              <SidebarItem href="/profile/me" icon="/SVG/profile.svg" label="Profile" />
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
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              <img src="/SVG/settings.svg" alt="Settings" className="w-5 h-5" />
              <span className="text-sm font-medium text-text">Settings</span>
            </Link>
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full ${
                isLoggingOut 
                  ? 'bg-gray-100 text-text-tertiary cursor-not-allowed'
                  : logoutClicked
                  ? 'bg-error/10 text-error hover:bg-error/20'
                  : 'hover:bg-gray-50 text-text'
              }`}
            >
              <span className="text-xl">
                {isLoggingOut ? '⏳' : logoutClicked ? '❗' : '🚪'}
              </span>
              <span className="text-sm font-medium">
                {isLoggingOut 
                  ? 'Logging out...' 
                  : logoutClicked 
                  ? 'Click again to confirm' 
                  : 'Logout'
                }
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation - Instagram Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border-light z-fixed safe-bottom">
        <div className="flex justify-around items-center py-3 px-2">
          {user ? (
            <>
              <MobileNavItem href="/" icon="/SVG/home.svg" />
              <MobileNavItem href="/uniwall" icon="/SVG/uniwall.svg" />
              <MobilePostNavItem icon="/SVG/search.svg" onClick={handleSearchOpen} />
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
      <SearchModal isOpen={isSearchOpen} onClose={handleSearchClose} />
    </>
  );
};

// Nav item components with SVG icon support
const SidebarItem = ({ href, icon, label }: { href: string; icon: string; label: string }) => (
  <Link 
    href={href} 
    className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all duration-200 group"
  >
    {icon.startsWith('/') ? (
      <img src={icon} alt={label} className="w-6 h-6 opacity-80 group-hover:opacity-100 transition-opacity" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
    <span className="text-base font-medium text-text">{label}</span>
  </Link>
);

const SidebarButton = ({ href, icon, label, onClick }: { href?: string; icon: string; label?: string; onClick?: () => void }) => {
  const content = (
    <>
      {icon.startsWith('/') ? (
        <img src={icon} alt={label || 'icon'} className="w-6 h-6 opacity-80 group-hover:opacity-100 transition-opacity" />
      ) : (
        <span className="text-2xl">{icon}</span>
      )}
      {label && <span className="text-base font-medium text-text">{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all duration-200 w-full text-left group"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all duration-200 w-full text-left group"
    >
      {content}
    </button>
  );
};

const MobileNavItem = ({ href, icon }: { href: string; icon: string }) => (
  <Link 
    href={href} 
    className="flex items-center justify-center w-14 h-14 rounded-full hover:bg-gray-50 active:scale-95 transition-all duration-200"
  >
    {icon.startsWith('/') ? (
      <img src={icon} alt="Navigation icon" className="w-7 h-7" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
  </Link>
);

const MobilePostNavItem = ({ icon, onClick }: { icon: string; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center justify-center w-14 h-14 rounded-full hover:bg-gray-50 active:scale-95 transition-all duration-200"
  >
    {icon.startsWith('/') ? (
      <img src={icon} alt="Post icon" className="w-7 h-7" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
  </button>
);

export default Navbar;
