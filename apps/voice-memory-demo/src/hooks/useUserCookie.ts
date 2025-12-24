'use client';

import { useState, useEffect } from 'react';

export function useUserCookie(deploymentId: string) {
  const [userCookie, setUserCookie] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = `userCookie_${deploymentId}`;
      const existing = localStorage.getItem(storageKey);
      
      if (existing) {
        setUserCookie(existing);
      } else {
        const newCookie = crypto.randomUUID();
        localStorage.setItem(storageKey, newCookie);
        setUserCookie(newCookie);
      }
      setIsLoading(false);
    }
  }, [deploymentId]);

  const resetCookie = () => {
    if (typeof window !== 'undefined') {
      const storageKey = `userCookie_${deploymentId}`;
      const newCookie = crypto.randomUUID();
      localStorage.setItem(storageKey, newCookie);
      setUserCookie(newCookie);
    }
  };

  return { userCookie, isLoading, resetCookie };
}
