import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useCart } from '../store/CartContext';

import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import SearchScreen from '../screens/SearchScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function CartIcon({ color, size, focused }) {
  const { count } = useCart();
  return (
    <View>
      <Ionicons name={focused ? 'cart' : 'cart-outline'} size={size} color={color} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const ICONS = {
  HomeTab: ['home', 'home-outline'],
  CategoriesTab: ['grid', 'grid-outline'],
  SearchTab: ['search', 'search-outline'],
  ProfileTab: ['person', 'person-outline'],
};

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const barStyle = [styles.bar, { height: 56 + insets.bottom, paddingBottom: 8 + insets.bottom }];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: barStyle,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'CartTab') return <CartIcon color={color} size={size} focused={focused} />;
          const [on, off] = ICONS[route.name] || ICONS.HomeTab;
          return <Ionicons name={focused ? on : off} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="CategoriesTab" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <Tab.Screen name="SearchTab" component={SearchScreen} options={{ title: 'Search' }} />
      <Tab.Screen name="CartTab" component={CartScreen} options={{ title: 'Cart' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  label: { fontSize: 10, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 12, includeFontPadding: false },
});