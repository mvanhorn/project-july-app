// Add a JPEG file to the phone's photo library (save-only access).
import { Asset, requestPermissionsAsync } from 'expo-media-library';

export async function savePhoto(fileUri: string): Promise<void> {
  const { granted } = await requestPermissionsAsync(true, ['photo']);
  if (!granted) throw new Error('permission');
  await Asset.create(fileUri);
}
