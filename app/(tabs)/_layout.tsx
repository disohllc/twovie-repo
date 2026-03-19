import { Tabs } from 'expo-router';
import { Hop as Home, List, Users, Settings } from 'lucide-react-native';
import { View, Image, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#2a2a2a',
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#e50914',
        tabBarInactiveTintColor: '#808080',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <View style={styles.tabBarContent} />
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/twovie_whit.svg')}
                style={styles.footerLogo}
                resizeMode="contain"
              />
            </View>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'My List',
          tabBarIcon: ({ size, color }) => <List size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    flex: 1,
    backgroundColor: '#141414',
  },
  tabBarContent: {
    flex: 1,
  },
  logoContainer: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 2,
  },
  footerLogo: {
    width: 60,
    height: 16,
    opacity: 0.4,
  },
});
