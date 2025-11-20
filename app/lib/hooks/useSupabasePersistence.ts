/**
 * Hook to initialize Supabase persistence with user context
 */

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/remix';
import { supabasePersistence } from '~/lib/services/supabase-persistence';

export function useSupabasePersistence() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializePersistence() {
      if (!isLoaded) {
        return;
      }

      try {
        if (isSignedIn && user) {
          console.log('🔑 Setting up user context for Supabase...');
          
          // Ensure user exists in Supabase
          const supabaseUserId = await supabasePersistence.ensureUser(
            user.id,
            user.emailAddresses[0]?.emailAddress || '',
            user.fullName || undefined
          );

          // Set user context for all operations
          supabasePersistence.setUserContext({
            userId: supabaseUserId,
            clerkUserId: user.id,
          });

          console.log('✅ User context set successfully');
          setIsInitialized(true);
          setError(null);
        } else {
          // User not signed in, clear context
          console.log('🔓 User not signed in, clearing context');
          setIsInitialized(false);
          setError(null);
        }
      } catch (err) {
        console.error('❌ Failed to initialize Supabase persistence:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setIsInitialized(false);
      }
    }

    initializePersistence();
  }, [isLoaded, isSignedIn, user]);

  return {
    isInitialized,
    error,
    syncStatus: supabasePersistence.getSyncStatus(),
  };
}
