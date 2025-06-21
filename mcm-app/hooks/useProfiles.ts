import { useEffect, useState } from 'react';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirebaseApp } from './firebaseApp';

const DEFAULT_PROFILES = [
  'MCM Castellon',
  'MCM nacional',
  'MCM Villacañas',
  'MCM Madrid',
];

export default function useProfiles() {
  const [profiles, setProfiles] = useState<string[]>(DEFAULT_PROFILES);

  useEffect(() => {
    const rc = getRemoteConfig(getFirebaseApp());
    rc.settings = { minimumFetchIntervalMillis: 3600000 };
    rc.defaultConfig = { profiles: JSON.stringify(DEFAULT_PROFILES) } as any;
    fetchAndActivate(rc)
      .then(() => {
        const val = getValue(rc, 'profiles').asString();
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) setProfiles(parsed);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  return profiles;
}
