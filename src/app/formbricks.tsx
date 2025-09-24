'use client';

import formbricks from '@formbricks/js';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { DEFAULT_BEE_API_URL } from './components/constants';

export default function FormbricksProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    formbricks.setup({
      environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENV_ID || '0000000000000000000000000',
      appUrl: DEFAULT_BEE_API_URL,
    });
  }, []);

  useEffect(() => {
    formbricks?.registerRouteChange();
  }, [pathname, searchParams]);

  return null;
}
