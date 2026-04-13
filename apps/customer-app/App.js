import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OtpScreen from './src/screens/OtpScreen';
import PersonalDetailScreen from './src/screens/PersonalDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import RequestFormScreen from './src/screens/RequestFormScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
          <Stack.Screen name="PersonalDetail" component={PersonalDetailScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="RequestForm" component={RequestFormScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
