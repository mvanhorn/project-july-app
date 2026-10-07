// expo-media-library has no web module; the web build downloads pictures instead.
export async function savePhoto(): Promise<void> {
  throw new Error('unsupported');
}
