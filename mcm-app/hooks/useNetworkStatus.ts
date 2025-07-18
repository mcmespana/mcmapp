import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export default function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let subscription: any;
    const subscribe = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsConnected(state.isConnected && state.isInternetReachable !== false);
      subscription = Network.addNetworkStateListener((s) => {
        setIsConnected(s.isConnected && s.isInternetReachable !== false);
      });
    };
    subscribe();
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  return isConnected;
}
