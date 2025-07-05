import { useEffect, useState } from 'react';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirebaseApp } from './firebaseApp';

export default function useProfiles() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rc = getRemoteConfig(getFirebaseApp());
    rc.settings = { minimumFetchIntervalMillis: 3600000 } as any;
    rc.defaultConfig = { profile: '[]' } as any;
    fetchAndActivate(rc)
      .then(() => {
        const str = getValue(rc, 'profile').asString();
        console.log('Loaded profiles', str);
        try {
          setProfiles(JSON.parse(str));
        } catch {
          setProfiles([]);
        }
      })
      .catch((e) => console.error('Remote config fetch error', e))
      .finally(() => setLoading(false));
  }, []);

  return { profiles, loading } as const;
}
