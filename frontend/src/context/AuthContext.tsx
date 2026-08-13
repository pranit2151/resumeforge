import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'user' | 'admin';
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('authUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(res.data.user);
          localStorage.setItem('authUser', JSON.stringify(res.data.user));
        } catch (err) {
          // Token expired or invalid, attempt refresh
          const refresh = localStorage.getItem('refreshToken');
          if (refresh) {
            try {
              const res = await axios.post('/api/auth/refresh-token', { refreshToken: refresh });
              setAccessToken(res.data.accessToken);
              localStorage.setItem('accessToken', res.data.accessToken);
              localStorage.setItem('refreshToken', res.data.refreshToken);
              // Fetch user info
              const meRes = await axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${res.data.accessToken}` },
              });
              setUser(meRes.data.user);
              localStorage.setItem('authUser', JSON.stringify(meRes.data.user));
            } catch (rErr) {
              setUser(null);
              setAccessToken(null);
              localStorage.removeItem('authUser');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            }
          } else {
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem('authUser');
            localStorage.removeItem('accessToken');
          }
        }
      }
      setIsLoading(false);
    };

    verifySession();
  }, []);

  const login = (data: { user: User; accessToken: string; refreshToken: string }) => {
    setUser(data.user);
    setAccessToken(data.accessToken);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) {
      try {
        await axios.post('/api/auth/logout', { refreshToken: refresh });
      } catch (e) {
        // Ignore logout network errors
      }
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('authUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const updateUser = (partial: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...partial };
      setUser(updated);
      localStorage.setItem('authUser', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
