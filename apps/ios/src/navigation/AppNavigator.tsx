import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RootStackParamList} from './types';
import HomeScreen from '../screens/HomeScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import ProcessingScreen from '../screens/ProcessingScreen';
import SuccessScreen from '../screens/SuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {backgroundColor: '#0A0A0F'},
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {fontWeight: '700'},
          contentStyle: {backgroundColor: '#0A0A0F'},
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'ColdTap'}}
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
