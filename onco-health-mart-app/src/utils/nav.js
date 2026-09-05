/** Tab screens live inside the "Tabs" navigator, so jumping to one from a
 *  root-stack screen has to be addressed explicitly. */
export function goTab(navigation, tab, params) {
  navigation.navigate('Tabs', { screen: tab, params });
}

export const TABS = {
  home: 'HomeTab',
  categories: 'CategoriesTab',
  search: 'SearchTab',
  cart: 'CartTab',
  profile: 'ProfileTab',
};
