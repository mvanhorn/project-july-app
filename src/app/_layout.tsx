import '@/polyfills';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { PublicSans_400Regular, PublicSans_600SemiBold } from '@expo-google-fonts/public-sans';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, fonts } from '@/theme';
import { OvenProvider } from '@/state/oven';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_500Medium, Fraunces_600SemiBold, PublicSans_400Regular, PublicSans_600SemiBold, IBMPlexMono_400Regular,
  });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OvenProvider>
          <Screens />
        </OvenProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Screens() {
  const { c, name } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerShadowVisible: false,
          headerTintColor: c.ember,
          headerTitleStyle: { fontFamily: fonts.sansStrong, fontSize: 18, color: c.ink },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.surface },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="setup/index" options={{ title: 'Set up' }} />
        <Stack.Screen name="setup/pair" options={{ title: 'Pair your oven' }} />
        <Stack.Screen name="cook" options={{ title: 'Start a cook', presentation: 'modal' }} />
        <Stack.Screen name="camera" options={{ title: 'Live view' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
