"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI } from '../lib/dataFetcher';
import Image from 'next/image'

interface User {
  id: number;
  name: string;
  email: string;
  department?: string;
  year?: number;
  profileImageUrl?: string;
}

interface ContactsListProps {
  onSelectUser: (user: User) => void;
  selectedUserId?: number;
}

const ContactsList: React.FC<ContactsListProps> = ({ onSelectUser, selectedUserId }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view contacts');
        return;
      }

      const data = await fetchAPI<{ users: User[] }>(
        '/api/users',
        { token, cacheTTL: 120000 } // Cache contacts for 2 minutes
      );

      // Filter out current user from contacts
      const filteredContacts = data.users?.filter((u: User) => u.id !== user?.id) || [];
      setContacts(filteredContacts);
    } catch (err: any) {
      console.error('Error loading contacts:', err);
      setError(err.message || 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const filteredContacts = useMemo(() =>
    contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.department && contact.department.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [contacts, searchTerm]
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={loadContacts}
            className="mt-2 text-[#FFAF50] hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#FFAF50] to-orange-400">
        <h2 className="text-lg font-semibold text-white mb-3">Contacts</h2>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Contacts List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">👥</div>
            <p>
              {searchTerm
                ? `No contacts found for "${searchTerm}"`
                : 'No contacts available'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectUser(contact)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 ${selectedUserId === contact.id ? 'bg-orange-50 border-r-4 border-[#FFAF50]' : ''
                  }`}
              >
                <Image
                  src={contact.profileImageUrl || '/uploads/DefaultProfile.jpg'}
                  alt={contact.name}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 truncate">
                      {contact.name}
                    </p>
                    {selectedUserId === contact.id && (
                      <div className="w-2 h-2 bg-[#FFAF50] rounded-full"></div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {contact.department ? `${contact.department} - Year ${contact.year}` : contact.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsList;