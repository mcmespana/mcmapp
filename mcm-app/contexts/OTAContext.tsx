import React, { createContext, useContext, useState } from 'react';
import useOTAUpdate from '@/hooks/useOTAUpdate';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';

interface OTAContextValue {
  isReady: boolean;
  isDownloading: boolean;
  error: Error | null;
  applyUpdate: () => Promise<void>;
  dismissed: boolean;
  setDismissed: (v: boolean) => void;
}

const OTAContext = createContext<OTAContextValue>({
  isReady: false,
  isDownloading: false,
  error: null,
  applyUpdate: async () => {},
  dismissed: false,
  setDismissed: () => {},
});

export function OTAProvider({ children }: { children: React.ReactNode }) {
  // `OTAProvider` va DENTRO de `PreviewChannelProvider` (ver `app/_layout.tsx`):
  // no buscamos updates hasta que el canal esté reconciliado, para que un
  // tester en modo alpha no acabe pidiéndole el update a `production` por
  // ganarle la carrera al override.
  const { hydrated } = usePreviewChannel();
  const ota = useOTAUpdate({ ready: hydrated });
  const [dismissed, setDismissed] = useState(false);

  return (
    <OTAContext.Provider
      value={{
        isReady: ota.isReady,
        isDownloading: ota.isDownloading,
        error: ota.error,
        applyUpdate: ota.applyUpdate,
        dismissed,
        setDismissed,
      }}
    >
      {children}
    </OTAContext.Provider>
  );
}

export function useOTAContext(): OTAContextValue {
  return useContext(OTAContext);
}
