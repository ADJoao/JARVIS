import type { UserAccount } from './types';
import { uid } from './storage';

const USERS_KEY = 'jarvis.users';
const SESSION_KEY = 'jarvis.session';
const ITERATIONS = 150_000;

const toB64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toB64(bits);
}

export function listUsers(): UserAccount[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users: UserAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const norm = (s: string) => s.trim().toLowerCase();

export async function register(name: string, password: string): Promise<UserAccount> {
  const clean = name.trim();
  if (clean.length < 2) throw new Error('Escolha um nome de usuário com pelo menos 2 letras.');
  if (password.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres.');
  const users = listUsers();
  if (users.some((u) => norm(u.name) === norm(clean))) throw new Error('Esse usuário já existe.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const user: UserAccount = {
    id: uid(),
    name: clean,
    salt: toB64(salt),
    hash: await derive(password, salt, ITERATIONS),
    iterations: ITERATIONS,
    createdAt: Date.now(),
  };
  saveUsers([...users, user]);
  return user;
}

export async function login(name: string, password: string): Promise<UserAccount> {
  const user = listUsers().find((u) => norm(u.name) === norm(name));
  if (!user) throw new Error('Usuário não encontrado.');
  const hash = await derive(password, fromB64(user.salt), user.iterations);
  if (hash !== user.hash) throw new Error('Senha incorreta.');
  return user;
}

export async function changePassword(userId: string, current: string, next: string) {
  const users = listUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('Usuário não encontrado.');
  if ((await derive(current, fromB64(user.salt), user.iterations)) !== user.hash)
    throw new Error('Senha atual incorreta.');
  if (next.length < 4) throw new Error('A nova senha precisa ter pelo menos 4 caracteres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  user.salt = toB64(salt);
  user.hash = await derive(next, salt, ITERATIONS);
  user.iterations = ITERATIONS;
  saveUsers(users);
}

export function deleteAccount(userId: string) {
  saveUsers(listUsers().filter((u) => u.id !== userId));
  localStorage.removeItem(`jarvis.data.${userId}`);
  endSession();
}

/** "Manter conectado" guarda a sessão no aparelho; senão ela some ao fechar o app. */
export function startSession(userId: string, remember: boolean) {
  endSession();
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, userId);
}

export function currentSession(): UserAccount | null {
  const id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  return listUsers().find((u) => u.id === id) ?? null;
}

export function endSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
