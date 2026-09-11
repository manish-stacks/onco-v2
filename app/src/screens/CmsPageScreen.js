import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Screen from '../components/Screen';
import { AppHeader, EmptyState, Loader } from '../components/ui';
import { colors } from '../theme';
import { cmsApi } from '../api';
import { plain } from '../utils/format';

export default function CmsPageScreen({ route }) {
  const { slug, title } = route.params || {};
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setPage(await cmsApi.page(slug));
      } catch {
        setPage(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <Screen>
      <AppHeader title={page?.name || title || 'Page'} back />
      {loading ? (
        <Loader />
      ) : !page ? (
        <EmptyState icon="document-outline" title="Page not available" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
          <Text style={styles.body}>{plain(page.description || page.content || page.body)}</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 13, color: colors.text, lineHeight: 21 },
});
