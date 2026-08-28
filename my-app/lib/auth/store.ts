import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateSalt, hashPassword, verifyPassword } from './crypto';
import {
  AuthError,
  AuthUser,
  LoginInput,
  RegisterInput,
  StoredUser,
} from './types';

const USERS_KEY = 'diagnomath:auth:users:v1';
const SESSION_KEY = 'diagnomath:auth:session:v1';

function toAuthUser(u: StoredUser): AuthUser {
  const { passwordHash, passwordSalt, ...rest } = u;
  return rest;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(name: string) {
  return name.trim();
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch (err) {
    console.error('Failed to read stored users:', err);
    return [];
  }
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function setSession(userId: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const password = input.password ?? '';

  if (!name) {
    throw new AuthError('VALIDATION', 'Username is required');
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    throw new AuthError('VALIDATION', 'Enter a valid email address');
  }
  if (password.length < 6) {
    throw new AuthError('WEAK_PASSWORD', 'Password must be at least 6 characters');
  }

  const users = await readUsers();

  if (users.some((u) => u.email === email)) {
    throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists');
  }
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    throw new AuthError('USERNAME_TAKEN', 'That username is already taken');
  }

  const passwordSalt = await generateSalt();
  const passwordHash = await hashPassword(password, passwordSalt);

  const newUser: StoredUser = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name,
    email,
    role: 'teacher',
    passwordHash,
    passwordSalt,
    createdAt: new Date().toISOString(),
  };

  await writeUsers([...users, newUser]);
  await setSession(newUser.id);

  return toAuthUser(newUser);
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const identifier = (input.emailOrUsername ?? '').trim().toLowerCase();
  const password = input.password ?? '';

  if (!identifier || !password) {
    throw new AuthError('VALIDATION', 'Enter your username/email and password');
  }

  const users = await readUsers();
  const user = users.find(
    (u) => u.email === identifier || u.name.toLowerCase() === identifier
  );

  // Deliberately identical error for "no such user" and "wrong password" —
  // don't leak which one it was.
  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Incorrect username/email or password');
  }

  const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Incorrect username/email or password');
  }

  await setSession(user.id);
  return toAuthUser(user);
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function restoreSession(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const { userId } = JSON.parse(raw) as { userId: string };
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    return user ? toAuthUser(user) : null;
  } catch (err) {
    console.error('Failed to restore session:', err);
    return null;
  }
}

/** Debug/admin helper — never exposes password material. */
export async function listUsers(): Promise<AuthUser[]> {
  const users = await readUsers();
  return users.map(toAuthUser);
}
