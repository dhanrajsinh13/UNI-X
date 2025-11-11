"use client";

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface MainContainerProps {
  children: React.ReactNode;
}

/**
 * Client wrapper to conditionally apply left margin reserved for the sidebar
 * only when the user is authenticated and the sidebar is visible.
 */
const MainContainer: React.FC<MainContainerProps> = ({ children }) => {
  const { user } = useAuth();

  const containerClassName = user
    ? 'min-h-screen pb-0 md:pb-8 md:ml-60 md:mr-0 px-4 sm:px-0 sm:ml-0 md:px-0'
    : 'min-h-screen p-0';

  return (
    <main className={containerClassName}>
      {children}
    </main>
  );
};

export default MainContainer;


