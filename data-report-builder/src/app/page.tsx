'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page - redirects to /mrr (the default report).
 * URL: /
 */
export default function Page() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/mrr');
  }, [router]);

  // Show nothing while redirecting
  return null;
}
