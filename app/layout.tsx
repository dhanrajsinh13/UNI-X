import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '../components/Navbar';
import MainContainer from '../components/MainContainer';
import ClientProviders from '../components/ClientProviders';
// @ts-ignore - allow importing global CSS without type declarations
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'UNIX - College Social Network',
  description: 'A modern social network for college students with posts, follow system, DMs, and Meta Chatbot',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-white text-gray-900 min-h-screen`}>
        <ClientProviders>
          <Navbar />
          <MainContainer>
            {children}
          </MainContainer>
        </ClientProviders>
      </body>
    </html>
  );
}