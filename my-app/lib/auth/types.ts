export type Role = 'teacher';

/** What actually sits in AsyncStorage — includes the hash + salt, never the raw password. */
export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

/** What the rest of the app gets back — password material stripped out. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  /** Accepts either the username or the email */
  emailOrUsername: string;
  password: string;
}

export type AuthErrorCode =
  | 'VALIDATION'
  | 'WEAK_PASSWORD'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'INVALID_CREDENTIALS';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
