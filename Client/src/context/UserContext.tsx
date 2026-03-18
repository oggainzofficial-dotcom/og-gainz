import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import { userService } from '@/services/userService';

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, name?: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  loginWithGoogleAccessToken: (accessToken: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const currentUser = userService.getCurrentUser();
        // If there is no token, treat as logged out even if a stale user exists in storage.
        if (!userService.isAuthenticated()) {
          setUser(null);
          return;
        }

        setUser(currentUser);

        // If a token exists, verify with backend to ensure role/identity is server-truth.
        const verified = await userService.verify();
        setUser(verified);
      } catch {
        // If verify fails, treat as logged out.
        await userService.logout();
        setUser(null);
      } finally {
        setIsLoading(false);
        setAuthReady(true);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, name?: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await userService.loginWithEmail(email, name);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await userService.loginWithGoogle(idToken);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleAccessToken = async (accessToken: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await userService.loginWithGoogleAccessToken(accessToken);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await userService.logout();
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (user) {
      const updated = await userService.updateProfile(user.id, data);
      if (updated) setUser(updated);
    }
  };

  const isAuthenticated = authReady && !!user && userService.isAuthenticated();

  return (
    <UserContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      loginWithGoogle,
      loginWithGoogleAccessToken,
      logout,
      updateProfile,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
