import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getSession, getDriverProfile } from './src/services/driverService';
import DriverLoginScreen      from './src/screens/DriverLoginScreen';
import DriverOtpScreen        from './src/screens/DriverOtpScreen';
import DriverSignupScreen     from './src/screens/DriverSignupScreen';
import PendingApprovalScreen  from './src/screens/PendingApprovalScreen';
import DriverHomeScreen       from './src/screens/DriverHomeScreen';
import DriverProfileScreen    from './src/screens/DriverProfileScreen';
import DriverActiveTaskScreen from './src/screens/DriverActiveTaskScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (!session) { setInitialRoute('DriverLogin'); return; }
        const profile = await getDriverProfile();
        if (profile?.error)       setInitialRoute('DriverLogin');
        else if (profile?.is_verified) setInitialRoute('DriverHome');
        else                      setInitialRoute('PendingApproval');
      } catch {
        setInitialRoute('DriverLogin');
      }
    };
    checkSession();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="DriverLogin"      component={DriverLoginScreen} />
        <Stack.Screen name="DriverOtp"        component={DriverOtpScreen} />
        <Stack.Screen name="DriverSignup"     component={DriverSignupScreen} />
        <Stack.Screen name="PendingApproval"  component={PendingApprovalScreen} />
        <Stack.Screen name="DriverHome"       component={DriverHomeScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="DriverProfile"    component={DriverProfileScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="DriverActiveTask" component={DriverActiveTaskScreen} options={{ animation: 'none' }} />
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
