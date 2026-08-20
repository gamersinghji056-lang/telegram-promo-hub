export const LANGUAGES = ["en", "zh-CN", "ru", "fa"] as const;
export type LanguageCode = (typeof LANGUAGES)[number];
export type ThemeMode = "light" | "dark" | "system";

export function normalizeLanguage(value?: string | null): LanguageCode {
  const v = String(value ?? "").toLowerCase();
  if (v === "zh" || v === "zh-cn" || v.startsWith("zh")) return "zh-CN";
  if (v === "ru" || v.startsWith("ru")) return "ru";
  if (v === "fa" || v === "fa-ir" || v.startsWith("fa")) return "fa";
  return "en";
}

export function directionForLanguage(language: string) {
  return language === "fa" ? "rtl" : "ltr";
}

export const messages = {
  en: {
    start: "Welcome to Telegram Promotion Platform.",
    register: "Register",
    login: "Login",
    openMiniApp: "Open Mini App",
    help: "Help",
    chooseLanguage: "Choose language",
    emailPrompt: "Send your email address.",
    passwordPrompt: "Send your password.",
    loginSuccess: "Login successful.",
    registrationSuccess: "Account created.",
    authFailed: "Authentication failed. Try again.",
    settingsSaved: "Settings saved.",
  },
  "zh-CN": {
    start: "欢迎使用 Telegram 推广平台。",
    register: "注册",
    login: "登录",
    openMiniApp: "打开 Mini App",
    help: "帮助",
    chooseLanguage: "选择语言",
    emailPrompt: "请发送您的邮箱地址。",
    passwordPrompt: "请发送您的密码。",
    loginSuccess: "登录成功。",
    registrationSuccess: "账户已创建。",
    authFailed: "认证失败，请重试。",
    settingsSaved: "设置已保存。",
  },
  ru: {
    start: "Добро пожаловать в Telegram Promotion Platform.",
    register: "Регистрация",
    login: "Войти",
    openMiniApp: "Открыть Mini App",
    help: "Помощь",
    chooseLanguage: "Выберите язык",
    emailPrompt: "Отправьте адрес электронной почты.",
    passwordPrompt: "Отправьте пароль.",
    loginSuccess: "Вход выполнен.",
    registrationSuccess: "Аккаунт создан.",
    authFailed: "Ошибка авторизации. Попробуйте снова.",
    settingsSaved: "Настройки сохранены.",
  },
  fa: {
    start: "به پلتفرم تبلیغات تلگرام خوش آمدید.",
    register: "ثبت نام",
    login: "ورود",
    openMiniApp: "باز کردن مینی اپ",
    help: "راهنما",
    chooseLanguage: "زبان را انتخاب کنید",
    emailPrompt: "ایمیل خود را ارسال کنید.",
    passwordPrompt: "رمز عبور خود را ارسال کنید.",
    loginSuccess: "ورود موفق بود.",
    registrationSuccess: "حساب ساخته شد.",
    authFailed: "احراز هویت ناموفق بود. دوباره تلاش کنید.",
    settingsSaved: "تنظیمات ذخیره شد.",
  },
} satisfies Record<LanguageCode, Record<string, string>>;

export function t(language: string | null | undefined, key: keyof typeof messages.en) {
  return messages[normalizeLanguage(language)][key] ?? messages.en[key];
}
