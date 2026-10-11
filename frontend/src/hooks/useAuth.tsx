import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.me();
      setUser(response.data);
    } catch {
      // If fetching me fails, clear invalid token
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Try auto-login with demo account if no token exists
  const tryDemoLogin = useCallback(async () => {
    try {
      const res = await authAPI.login('demo@legal.local', 'demo1234');
      const newToken = res.data.access_token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(res.data.user);
    } catch {
      // Backend may not have demo user seeded yet or offline
      // Fallback: stay unauthenticated without breaking
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      try {
        if (savedToken) {
          if (mounted) setToken(savedToken);
          const userRes = await Promise.race([
            authAPI.me(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
          ]);
          if (mounted) setUser(userRes.data);
        } else {
          const res = await Promise.race([
            authAPI.login('demo@legal.local', 'demo1234'),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
          ]);
          if (mounted) {
            const newToken = res.data.access_token;
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(res.data.user);
          }
        }
      } catch {
        // On failure or timeout, gracefully continue without freezing the app
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authAPI.login(email, password);
      const newToken = res.data.access_token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(res.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      const res = await authAPI.register(email, password, fullName);
      const newToken = res.data.access_token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(res.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
