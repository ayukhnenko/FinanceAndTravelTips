import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const LOGIN_PATTERN = /^[a-z0-9._-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterUserInput = {
  login: string;
  password: string;
  name: string;
  phone?: string;
  email?: string;
};

export type LoginUserInput = {
  identifier: string;
  password: string;
};

export type UpdateProfileInput = {
  name: string;
  phone?: string;
  email?: string;
};

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    digits = `7${digits}`;
  }
  return digits;
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

export function validateRegisterInput(input: RegisterUserInput): string | null {
  const login = normalizeLogin(input.login);
  if (!LOGIN_PATTERN.test(login)) {
    return "Логин: 3–50 символов, латиница, цифры, точка, дефис или подчёркивание";
  }

  const password = input.password ?? "";
  if (password.length < 8) {
    return "Пароль должен быть не короче 8 символов";
  }

  const name = input.name?.trim() ?? "";
  if (!name) {
    return "Укажите имя";
  }
  if (name.length > 100) {
    return "Имя не должно быть длиннее 100 символов";
  }

  const phoneRaw = input.phone?.trim() ?? "";
  if (phoneRaw) {
    const phone = normalizePhone(phoneRaw);
    if (phone.length < 11 || phone.length > 15) {
      return "Укажите корректный номер телефона";
    }
  }

  const email = input.email?.trim() ?? "";
  if (email && !EMAIL_PATTERN.test(email)) {
    return "Некорректный адрес e-mail";
  }
  if (email && normalizeEmail(email).length > 254) {
    return "Адрес e-mail слишком длинный";
  }

  return null;
}

export function validateLoginInput(input: LoginUserInput): string | null {
  const identifier = input.identifier.trim();
  if (!identifier) {
    return "Укажите логин или e-mail";
  }
  if (isEmailIdentifier(identifier)) {
    const email = normalizeEmail(identifier);
    if (!EMAIL_PATTERN.test(email)) {
      return "Некорректный адрес e-mail";
    }
  }
  if (!input.password) {
    return "Укажите пароль";
  }
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) {
    return "Пароль должен быть не короче 8 символов";
  }
  return null;
}

export function validateUpdateProfileInput(input: UpdateProfileInput): string | null {
  const name = input.name?.trim() ?? "";
  if (!name) {
    return "Укажите имя";
  }
  if (name.length > 100) {
    return "Имя не должно быть длиннее 100 символов";
  }

  const phoneRaw = input.phone?.trim() ?? "";
  if (phoneRaw) {
    const phone = normalizePhone(phoneRaw);
    if (phone.length < 11 || phone.length > 15) {
      return "Укажите корректный номер телефона";
    }
  }

  const email = input.email?.trim() ?? "";
  if (email && !EMAIL_PATTERN.test(email)) {
    return "Некорректный адрес e-mail";
  }
  if (email && normalizeEmail(email).length > 254) {
    return "Адрес e-mail слишком длинный";
  }

  return null;
}

export function validatePasswordResetEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return "Укажите e-mail";
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return "Некорректный адрес e-mail";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}
