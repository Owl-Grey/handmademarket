// src/api/auth.ts
import { supabase } from '../lib/supabaseClient';
import type { AuthUser } from '../context/AuthContext';

export type LoginType = 'phone' | 'email';

export class AuthError extends Error {
  code?: 'USER_EXISTS' | 'INVALID_CREDENTIALS' | 'UNKNOWN';

  constructor(message: string, code: AuthError['code'] = 'UNKNOWN') {
    super(message);
    this.code = code;
  }
}

const mapDbUserToAuthUser = (row: any): AuthUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
});

/**
 * Регистрация пользователя.
 * Обязательные поля: name, phone/email, password.
 */
export const registerUser = async (params: {
  name: string;
  loginType: LoginType;
  loginValue: string;
  password: string;
}): Promise<AuthUser> => {
  const { name, loginType, loginValue, password } = params;

  // проверяем, что такого пользователя ещё нет
  const { data: exists, error: existsErr } = await supabase
    .from('users')
    .select('id')
    .or(
      loginType === 'phone'
        ? `phone.eq.${loginValue}`
        : `email.eq.${loginValue}`,
    );

  if (existsErr) {
    console.error('register: exists error', existsErr);
    throw new AuthError('Ошибка при проверке пользователя');
  }

  if (exists && exists.length > 0) {
    throw new AuthError('Такой пользователь уже существует', 'USER_EXISTS');
  }

  // создаём пользователя
  const { data, error: insertError } = await supabase
    .from('users')
    .insert({
      name: name.trim(),
      phone: loginType === 'phone' ? loginValue : null,
      email: loginType === 'email' ? loginValue : null,
      // пока без хэша, демка; позже заменишь на хэширование на бэке
      password_hash: password,
    })
    .select('*')
    .maybeSingle();

  if (insertError || !data) {
    console.error('register: insert error', insertError);
    throw new AuthError('Не удалось создать пользователя');
  }

  return mapDbUserToAuthUser(data);
};

/**
 * Логин по телефону или email + паролю.
 */
export const loginUser = async (params: {
  loginType: LoginType;
  loginValue: string;
  password: string;
}): Promise<AuthUser> => {
  const { loginType, loginValue, password } = params;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq(loginType === 'phone' ? 'phone' : 'email', loginValue)
    .maybeSingle();

  if (error || !data) {
    console.error('login: select error', error);
    throw new AuthError('Неверный логин или пароль', 'INVALID_CREDENTIALS');
  }

  if ((data as any).password_hash !== password) {
    throw new AuthError('Неверный логин или пароль', 'INVALID_CREDENTIALS');
  }

  return mapDbUserToAuthUser(data);
};
