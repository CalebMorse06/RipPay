import React from 'react';
import {Linking} from 'react-native';
import {NavigationContainer, LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RootStackParamList} from './types';
import HomeScreen from '../screens/HomeScreen';
import MerchantLanding from '../screens/MerchantLanding';
import CheckoutScreen from '../screens/CheckoutScreen';
import ProcessingScreen from '../screens/ProcessingScreen';
import SuccessScreen from '../screens/SuccessScreen';
import {canonicalizeUrl} from '../utils/linkParser';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Deep link config.
 *
 * All incoming URLs are canonicalized first (via canonicalizeUrl) so the
 * linking config only needs to know two path shapes:
 *   coldtap://merchant/:merchantId  → MerchantLanding  (NFC sticker, primary)
 *   coldtap://session/:sessionId    → Checkout          (direct session link)
 *
 * Merchant tap URL variants (handled by canonicalizeUrl → parseLinkIntent):
 *   coldtap://tap/:id
 *   coldtap://merchant/:id
 *   https://app.coldtap.xyz/merchant/:id
 *   https://app.coldtap.xyz/tap/:id
 *   https://app.coldtap.xyz/m/:id
 *
 * Session URL variants:
 *   coldtap://session/:id
 *   https://app.coldtap.xyz/session/:id
 *   ?id=, ?session=, ?sessionId=
 *
 * Custom scheme (coldtap://) works without AASA file — suitable for hackathon.
 * Universal links (https://app.coldtap.xyz) require AASA on the server.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['coldtap://', 'https://app.coldtap.xyz'],
  config: {
    screens: {
      Home: '',
      MerchantLanding: 'merchant/:merchantId',
      Checkout: 'session/:sessionId',
      Processing: 'processing/:sessionId',
      Success: 'success/:sessionId',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url ? canonicalizeUrl(url) : undefined;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({url}) => {
      listener(canonicalizeUrl(url));
    });
    return () => sub.remove();
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {backgroundColor: '#FFFFFF'},
          headerTintColor: '#1A1D23',
          headerTitleStyle: {fontWeight: '700', fontSize: 17, color: '#1A1D23'},
          headerShadowVisible: false,
          contentStyle: {backgroundColor: '#FFFFFF'},
          animation: 'slide_from_right',
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="MerchantLanding"
          component={MerchantLanding}
          options={{title: '', headerBackVisible: true}}
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
