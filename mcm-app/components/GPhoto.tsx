import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { getGPhotoPreviewURL } from '@/utils/gphoto';

interface Props {
  sharedUrl: string;
  width?: number;
  style?: StyleProp<ImageStyle>;
}

const GPhoto: React.FC<Props> = ({ sharedUrl, width = 600, style }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getGPhotoPreviewURL(sharedUrl, { width });
        if (!cancelled) {
          setUrl(res.url);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sharedUrl, width]);

  if (loading) {
    return (
      <View style={style}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!url) {
    return null;
  }

  return <Image source={{ uri: url }} style={style} />;
};

export default GPhoto;
