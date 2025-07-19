import React, { createContext, useContext, ReactNode } from 'react';
import featureFlags, { FeatureFlags } from '@/constants/featureFlags';

const FeatureFlagsContext = createContext<FeatureFlags>(featureFlags);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  return (
    <FeatureFlagsContext.Provider value={featureFlags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
