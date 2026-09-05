import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import ProductCard from '../components/ProductCard';
import { AppHeader, EmptyState } from '../components/ui';
import { colors } from '../theme';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { goTab, TABS } from '../utils/nav';

export default function WishlistScreen({ navigation }) {
  const { wishlist, refreshWishlist } = useCart();
  const { isLoggedIn } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) refreshWishlist();
    }, [isLoggedIn, refreshWishlist])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshWishlist();
    } finally {
      setRefreshing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <Screen>
        <AppHeader title="Wishlist" back />
        <EmptyState
          icon="heart-outline"
          title="Log in to see your wishlist"
          actionTitle="Log in"
          onAction={() => navigation.navigate('Login')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Wishlist" back />
      <FlatList
        data={wishlist}
        keyExtractor={(p) => String(p.product_id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 18 }}
        contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => <ProductCard product={item} style={{ flex: 1 }} />}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="Your wishlist is empty"
            subtitle="Tap the heart on any product to save it for later."
            actionTitle="Browse products"
            onAction={() => goTab(navigation, TABS.home)}
          />
        }
      />
    </Screen>
  );
}
