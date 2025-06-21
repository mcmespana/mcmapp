import { useEffect, useState } from 'react';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirebaseApp } from './firebaseApp';

const DEFAULT_LOCATIONS = [
  'MCM Castellon',
  'MCM nacional',
  'MCM Villacañas',
  'MCM Madrid',
];

export default function useLocations() {
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);

  useEffect(() => {
    const rc = getRemoteConfig(getFirebaseApp());
    rc.settings = { minimumFetchIntervalMillis: 3600000 };
    rc.defaultConfig = { locations: JSON.stringify(DEFAULT_LOCATIONS) } as any;
    fetchAndActivate(rc)
      .then(() => {
        const val = getValue(rc, 'locations').asString();
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) setLocations(parsed);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  return locations;
}
