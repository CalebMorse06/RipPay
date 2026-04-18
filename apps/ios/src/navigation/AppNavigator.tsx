import React from 'react';
import {Linking} from 'react-native';
import {NavigationContainer, LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RootStackParamList} from './types';
import HomeScreen from '../screens/HomeScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import ProcessingScreen from '../screens/ProcessingScreen';
import SuccessScreen from '../screens/SuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Deep link configuration.
 *
 * Supported URL patterns:
 *   coldtap://session/<id>          → Checkout screen
 *   https://app.coldtap.xyz/session/<id>  → Checkout screen (universal link)
 *
 * Universal link setup requires AASA file on server — for hackathon, rely on
 * the custom coldtap:// scheme which works without server config.
 *
 * Info.plist must declare CFBundleURLSchemes: [coldtap]
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['coldtap://', 'https://app.coldtap.xyz'],
  config: {
    screens: {
      Home: '',
      Checkout: {
        path: 'session/:sessionId',
        parse: {
          sessionId: (id: string) => id,
        },
      },
      Processing: 'processing/:sessionId',
      Success: 'success/:sessionId',
    },
  },
  async getInitialURL() {
    // Check if app was launched from a deep link
    const url = await Linking.getInitialURL();
    return url ?? undefined;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({url}) => listener(url));
    return () => sub.remove();
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {backgroundColor: '#0A0A0F'},
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {fontWeight: '700', fontSize: 17},
          contentStyle: {backgroundColor: '#0A0A0F'},
          animation: 'slide_from_right',
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'ColdTap', headerShown: false}}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{title: 'Review Payment'}}
        />
        <Stack.Screen
          name="Processing"
          component={ProcessingScreen}
          options={{title: 'Approving', headerBackVisible: false}}
        />
        <Stack.Screen
          name="Success"
          component={SuccessScreen}
          options={{title: 'Paid', headerBackVisible: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
