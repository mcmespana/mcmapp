import React from 'react';
import { vexo } from 'vexo-analytics';

// Initialize Vexo at the root level, outside of any component
// Recommended to wrap in production-only check
if (__DEV__ === false) {
  vexo('0b444fa8-3d09-451f-b7ad-a7b97bed2500');
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
