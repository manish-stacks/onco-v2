import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { useAuth } from '../store/AuthContext';

import TabNavigator from './TabNavigator';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import OtpScreen from '../screens/OtpScreen';
import ProductScreen from '../screens/ProductScreen';
import ProductListScreen from '../screens/ProductListScreen';
import ApplyCouponScreen from '../screens/ApplyCouponScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddAddressScreen from '../screens/AddAddressScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import PaymentMethodScreen from '../screens/PaymentMethodScreen';
import PaymentGatewayScreen from '../screens/PaymentGatewayScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import TrackingScreen from '../screens/TrackingScreen';
import RxUploadScreen from '../screens/RxUploadScreen';
import RxManageScreen from '../screens/RxManageScreen';
import RxDetailScreen from '../screens/RxDetailScreen';
import OffersScreen from '../screens/OffersScreen';
import WishlistScreen from '../screens/WishlistScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import HelpScreen from '../screens/HelpScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CmsPageScreen from '../screens/CmsPageScreen';

const Stack = createNativeStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
};

export default function RootNavigator() {
  const { booting, onboarded } = useAuth();

  if (booting) return <SplashScreen />;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!onboarded ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : null}

        <Stack.Screen name="Tabs" component={TabNavigator} />

        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Otp" component={OtpScreen} />

        <Stack.Screen name="Product" component={ProductScreen} />
        <Stack.Screen name="ProductList" component={ProductListScreen} />

        <Stack.Screen
          name="ApplyCoupon"
          component={ApplyCouponScreen}
          options={{ presentation: 'transparentModal', animation: 'slide_from_right' }}
        />
        <Stack.Screen name="AddressList" component={AddressListScreen} />
        <Stack.Screen name="AddAddress" component={AddAddressScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
        <Stack.Screen name="PaymentGateway" component={PaymentGatewayScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ gestureEnabled: false }} />

        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="Tracking" component={TrackingScreen} />

        <Stack.Screen name="RxUpload" component={RxUploadScreen} />
        <Stack.Screen name="RxManage" component={RxManageScreen} />
        <Stack.Screen name="RxDetail" component={RxDetailScreen} />

        <Stack.Screen name="Offers" component={OffersScreen} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="CmsPage" component={CmsPageScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
