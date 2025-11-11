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
  
  // Don't show navbar on landing page or when user is not authenticated
  if (!user) {
    return null;
  }
  
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-100 z-50 flex-col justify-between py-6 px-3">
        <div>
          <Link href="/" className="flex items-center px-2 mb-6">
            <img src="/uni-x_logo.png" alt="UNI-X" className="w-15 h-15 mr-2" />
            <span className="font-bold text-xl bg-gradient-to-r from-[#1E1E1E] to-green-500 bg-clip-text text-transparent">UNI-X</span>
          </Link>
          {user ? (
          <nav className="space-y-1">
              <SidebarItem href="/" icon="/SVG/home.svg" label="Home" />
              <SidebarItem href="/uniwall" icon="/SVG/uniwall.svg" label="UniWall" />
              <SidebarButton icon="/SVG/post.svg" label="Post" onClick={handleCreatePostOpen} />
              <SidebarItem href="/messages" icon="/SVG/messages.svg" label="Messages" />
              <SidebarItem href="/connect" icon="/SVG/connect.svg" label="Connect" />
              <SidebarItem href="/notifications" icon="/SVG/notifications.svg" label="Notifications" />
              <SidebarItem href="/profile/me" icon="/SVG/profile.svg" label="Profile" />
          </nav>
          ) : (
            <div className="px-2">
              <button
                onClick={handleAuthModalOpen}
                className="w-full bg-[#02fa97] text-black px-4 py-2 rounded-xl font-semibold hover:bg-teal-500 transition-colors"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
        {user && (
          <div className="space-y-1">
            <Link 
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <img src="/SVG/settings.svg" alt="Settings" className="w-5 h-5" />
              <span className="text-sm font-medium text-gray-700">Settings</span>
            </Link>
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                isLoggingOut 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : logoutClicked
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'hover:bg-gray-50 text-gray-700'
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50 shadow-lg">
        <div className="flex justify-around items-center py-2">
          {user ? (
            <>
              <MobileNavItem href="/" icon="/SVG/home.svg" />
              <MobileNavItem href="/uniwall" icon="/SVG/uniwall.svg" />
              <MobilePostNavItem icon="/SVG/post.svg" onClick={handleCreatePostOpen} />
              <MobileNavItem href="/messages" icon="/SVG/messages.svg" />
              <MobileNavItem href="/profile/me" icon="/SVG/profile.svg" />
            </>
          ) : (
            <div className="flex justify-center w-full">
              <button
                onClick={handleAuthModalOpen}
                className="bg-[#02fa97] text-black px-8 py-2 rounded-full font-semibold hover:bg-teal-500 transition-colors"
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
    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
  >
    {icon.startsWith('/') ? (
      <img src={icon} alt={label} className="w-5 h-5" />
    ) : (
      <span className="text-xl">{icon}</span>
    )}
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </Link>
);

const SidebarButton = ({ href, icon, label, onClick }: { href?: string; icon: string; label?: string; onClick?: () => void }) => {
  const content = (
    <>
      {icon.startsWith('/') ? (
        <img src={icon} alt={label || 'icon'} className="w-5 h-5" />
      ) : (
        <span className="text-xl">{icon}</span>
      )}
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors w-full text-left"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors w-full text-left"
    >
      {content}
    </button>
  );
};

const MobileNavItem = ({ href, icon }: { href: string; icon: string }) => (
  <Link 
    href={href} 
    className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 transition-all duration-200"
  >
    {icon.startsWith('/') ? (
      <img src={icon} alt="Navigation icon" className="w-6 h-6" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
  </Link>
);

const MobilePostNavItem = ({ icon, onClick }: { icon: string; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 transition-all duration-200"
  >
    {icon.startsWith('/') ? (
      <img src={icon} alt="Post icon" className="w-6 h-6" />
    ) : (
      <span className="text-2xl">{icon}</span>
    )}
  </button>
);

export default Navbar;
