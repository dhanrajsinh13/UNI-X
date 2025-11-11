'use client';

import { usePathname } from 'next/navigation';
import MetaChatbot from './MetaChatbot';

const ConditionalChatbot = () => {
  const pathname = usePathname();
  
  // Don't show chatbot on messages page
  if (pathname === '/messages') {
    return null;
  }
  
  return <MetaChatbot />;
};

export default ConditionalChatbot;
