import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';


import { AuthProvider, useAuth } from './context/AuthContext';
import { attachAuthInterceptor } from './api/client';
import { colors } from './theme';

import SignupScreen from './screens/SignupScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import PrescriptionsScreen from './screens/PrescriptionsScreen';
import PrescriptionReviewScreen from './screens/PrescriptionReviewScreen';
import MedicineDetailScreen from './screens/MedicineDetailScreen';
import ChatbotScreen from './screens/ChatbotScreen';

const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const PrescriptionsStack = createNativeStackNavigator();
const ChatbotStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AuthNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Signup" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload' }} />
      <HomeStack.Screen name="MedicineDetail" component={MedicineDetailScreen} options={{ title: 'Details' }} />
    </HomeStack.Navigator>
  );
}

function PrescriptionsStackNavigator() {
  return (
    <PrescriptionsStack.Navigator>
      <PrescriptionsStack.Screen name="Prescriptions" component={PrescriptionsScreen} options={{ headerShown: false }} />
      <PrescriptionsStack.Screen name="PrescriptionReview" component={PrescriptionReviewScreen} options={{ title: 'Review' }} />
      <PrescriptionsStack.Screen name="MedicineDetail" component={MedicineDetailScreen} options={{ title: 'Details' }} />
    </PrescriptionsStack.Navigator>
  );
}

function ChatbotStackNavigator() {
  return (
    <ChatbotStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatbotStack.Screen name="Chatbot" component={ChatbotScreen} />
    </ChatbotStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarIcon: ({ color, size }) => {
          const icons = { HomeTab: 'home', PrescriptionsTab: 'file-text', ChatbotTab: 'message-circle' };
          return <Feather name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tabs.Screen name="PrescriptionsTab" component={PrescriptionsStackNavigator} options={{ title: 'Prescriptions' }} />
      <Tabs.Screen name="ChatbotTab" component={ChatbotStackNavigator} options={{ title: 'Assistant' }} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { token, loading, setToken } = useAuth();

  useEffect(() => {
    attachAuthInterceptor(() => setToken(null));
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      {token ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}