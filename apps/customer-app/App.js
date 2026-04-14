import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getToken } from './src/services/authService';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OtpScreen from './src/screens/OtpScreen';
import PersonalDetailScreen from './src/screens/PersonalDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import RequestFormScreen from './src/screens/RequestFormScreen';
import TaskListScreen from './src/screens/TaskListScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import TaskTrackingScreen from './src/screens/TaskTrackingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';
import WalletScreen from './src/screens/WalletScreen';
import CouponScreen from './src/screens/CouponScreen';
import HelpScreen from './src/screens/HelpScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import TermsScreen from './src/screens/TermsScreen';
import LanguageScreen from './src/screens/LanguageScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    getToken().then((token) => {
      setInitialRoute(token ? 'Home' : 'Welcome');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
          <Stack.Screen name="PersonalDetail" component={PersonalDetailScreen} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="RequestForm" component={RequestFormScreen} />
          <Stack.Screen name="TaskList" component={TaskListScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
          <Stack.Screen name="TaskTracking" component={TaskTrackingScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
          <Stack.Screen name="Wallet" component={WalletScreen} />
          <Stack.Screen name="Coupon" component={CouponScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="Terms" component={TermsScreen} />
          <Stack.Screen name="Language" component={LanguageScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
