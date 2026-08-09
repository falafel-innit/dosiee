import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermission } from '../services/notifications';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [userEmail, setUserEmailState] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedEmail = await AsyncStorage.getItem('userEmail');
        if (savedToken) setTokenState(savedToken);
        if (savedEmail) setUserEmailState(savedEmail);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const setToken = async (value) => {
    setTokenState(value);
    if (value) {
      await AsyncStorage.setItem('token', value);
      await requestNotificationPermission();
    } else {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userEmail');
    }
  };

  const setUserEmail = async (value) => {
    setUserEmailState(value);
    if (value) await AsyncStorage.setItem('userEmail', value);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, userEmail, setUserEmail, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}