'use client';

import React from 'react';

const AuthTokenContext = React.createContext<string | undefined>(undefined);

export function AuthTokenProvider({
  token,
  children,
}: {
  token: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <AuthTokenContext.Provider value={token}>
      {children}
    </AuthTokenContext.Provider>
  );
}

export function useAuthToken(): string | undefined {
  return React.useContext(AuthTokenContext);
}
