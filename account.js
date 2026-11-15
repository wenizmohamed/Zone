(() => {
  'use strict';
  const copy = {
    en: {
      title: 'Keep your character', intro: 'Claim this character with a username and password. Your money, items, training and family stay on the server.',
      loading: 'Checking account access...', claimTitle: 'Claim this character', username: 'Username', usernameHelp: '3-24 Latin letters, digits or underscores. Start with a letter.',
      password: 'Password', passwordHelp: '15-128 characters. A long, unique passphrase works well.', confirm: 'Confirm password', claim: 'Save my character',
      backupTitle: 'Save your recovery code now', backupHelp: 'This code is shown only now. Keep it privately offline. It can reset your password, and using it generates a replacement. Never send it to another player.', backupSaved: 'I saved this code somewhere safe.',
      loginTitle: 'Sign in to an existing character', switchGuest: 'I understand that signing in replaces access to this guest. I must claim it first if I want to keep it.', login: 'Sign in',
      recoverTitle: 'Forgot your password?', recovery: 'Recovery code', newPassword: 'New password', recover: 'Recover character', noCode: 'If you lose both your password and recovery code, self-service recovery is unavailable. Email recovery is not configured.',
      back: 'Back to game', logout: 'Sign out', guest: 'Guest character. Claim it before clearing browser data.', claimed: 'Permanent character. Sign in with your username and password on another device.',
      anonymous: 'No active character in this browser. Sign in below, or return to the game to create a guest.', mismatch: 'Passwords do not match.', switched: 'Claim this guest first, or confirm the account switch.', busy: 'Saving securely...',
      saved: 'Account saved. Keep the recovery code before returning to the game.', signedIn: 'Signed in. Your saved character is ready.', signedOut: 'Signed out. Your claimed character is still saved on the server.', failed: 'Connection unavailable. Reload to retry.',
      invalid: 'Invalid username, password or recovery code.', limited: 'Too many account attempts. Try again in 15 minutes.', unavailable: 'This username is unavailable, or this character is already claimed.', invalidFields: 'Check your account details: username 3-24 Latin characters; password 15-128 characters.', missingSession: 'Guest access expired. Sign in or return to the game.', saveFirst: 'Save the recovery code before leaving.',
      generatePassphrase: 'Generate strong passphrase', showPasswords: 'Show / hide', copyRecovery: 'Copy recovery code', generated: 'Strong passphrase generated. Copy it safely before saving.', copied: 'Recovery code copied to clipboard.'
    },
    ar: {
      title: 'احفظ شخصيتك', intro: 'اربط هذه الشخصية باسم مستخدم وكلمة مرور. تبقى أموالك وأغراضك وتدريبك وعائلتك محفوظة على الخادم.',
      loading: 'جارٍ التحقق من الحساب...', claimTitle: 'تثبيت حساب هذه الشخصية', username: 'اسم المستخدم', usernameHelp: 'من 3 إلى 24 حرفاً لاتينياً أو رقماً أو شرطة سفلية. ابدأ بحرف.',
      password: 'كلمة المرور', passwordHelp: 'من 15 إلى 128 محرفاً. استخدم عبارة مرور طويلة وفريدة.', confirm: 'تأكيد كلمة المرور', claim: 'حفظ شخصيتي',
      backupTitle: 'احفظ رمز الاسترداد الآن', backupHelp: 'يظهر هذا الرمز الآن فقط. احفظه سرياً خارج المتصفح. يسمح بإعادة تعيين كلمة المرور ويُستبدل بعد استخدامه. لا ترسله لأي لاعب.', backupSaved: 'حفظت الرمز في مكان آمن.',
      loginTitle: 'الدخول إلى شخصية محفوظة', switchGuest: 'أفهم أن الدخول يستبدل الوصول إلى شخصية الضيف الحالية. يجب تثبيتها أولاً إذا أردت الاحتفاظ بها.', login: 'تسجيل الدخول',
      recoverTitle: 'نسيت كلمة المرور؟', recovery: 'رمز الاسترداد', newPassword: 'كلمة مرور جديدة', recover: 'استرداد الشخصية', noCode: 'إذا فقدت كلمة المرور ورمز الاسترداد معاً فلا يتوفر استرداد ذاتي. الاسترداد بالبريد الإلكتروني غير مهيأ.',
      back: 'العودة إلى اللعبة', logout: 'تسجيل الخروج', guest: 'شخصية ضيف. ثبّت حسابها قبل مسح بيانات المتصفح.', claimed: 'شخصية محفوظة. يمكنك الدخول باسم المستخدم وكلمة المرور من جهاز آخر.',
      anonymous: 'لا توجد شخصية نشطة في هذا المتصفح. سجّل الدخول أدناه أو عد إلى اللعبة لإنشاء شخصية ضيف.', mismatch: 'كلمتا المرور غير متطابقتين.', switched: 'ثبّت حساب الضيف أولاً أو وافق على تبديل الحساب.', busy: 'جارٍ الحفظ بأمان...',
      saved: 'تم حفظ الحساب. احتفظ برمز الاسترداد قبل العودة إلى اللعبة.', signedIn: 'تم تسجيل الدخول. شخصيتك المحفوظة جاهزة.', signedOut: 'تم تسجيل الخروج. تبقى شخصيتك المثبتة محفوظة على الخادم.', failed: 'الاتصال غير متاح. أعد تحميل الصفحة للمحاولة.',
      invalid: 'اسم المستخدم أو كلمة المرور أو رمز الاسترداد غير صحيح.', limited: 'محاولات كثيرة. أعد المحاولة بعد 15 دقيقة.', unavailable: 'اسم المستخدم غير متاح أو الحساب مثبت مسبقاً.', invalidFields: 'تحقق من البيانات: اسم لاتيني من 3 إلى 24 محرفاً وكلمة مرور من 15 إلى 128 محرفاً.', missingSession: 'انتهى وصول الضيف. سجّل الدخول أو عد إلى اللعبة.', saveFirst: 'احفظ رمز الاسترداد قبل المغادرة.',
      generatePassphrase: 'توليد عبارة مرور قوية', showPasswords: 'إظهار / إخفاء', copyRecovery: 'نسخ رمز الاسترداد', generated: 'تم توليد عبارة مرور قوية. احتفظ بنسخة منها قبل الحفظ.', copied: 'تم نسخ رمز الاسترداد إلى الحافظة.'
    }
  };
  let lang = new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en';
  let identity = null, busy = false, ready = false, backup = false, messageKey = 'loading', messageError = false;
  const element = id => document.getElementById(id);
  const message = (key, error = false) => { messageKey = key; messageError = error; element('message').textContent = copy[lang][key]; element('message').dataset.error = String(error); };
  const translate = () => {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'زون | حساب اللاعب' : 'ZONE | Player account';
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = copy[lang][node.dataset.i18n]; });
    element('languageToggle').textContent = lang === 'ar' ? 'English' : 'العربية';
    element('languageToggle').lang = lang === 'ar' ? 'en' : 'ar';
    element('backToGame').href = '/?screen=home&lang=' + lang;
    message(messageKey, messageError);
    paint();
  };
  const paint = () => {
    const active = !!identity?.playerId, claimed = !!identity?.claimed;
    element('identity').hidden = !active;
    element('identityName').textContent = identity?.username || '';
    element('identityState').textContent = copy[lang][claimed ? 'claimed' : 'guest'];
    element('claimPanel').hidden = !active || claimed || backup;
    element('loginPanel').hidden = claimed || backup;
    element('recoverPanel').hidden = claimed || backup;
    element('guestWarning').hidden = !active;
    element('logout').hidden = !claimed;
    element('backupPanel').hidden = !backup;
    document.querySelectorAll('button[type=submit]').forEach(button => { button.disabled = busy || !ready; });
    element('logout').disabled = busy || (backup && !element('backupSaved').checked);
    element('backToGame').setAttribute('aria-disabled', String(backup && !element('backupSaved').checked));
  };
  const request = async (path, body) => {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json();
    if (!response.ok) {
      const key = response.status === 429 ? 'limited' : response.status === 409 ? 'unavailable' : response.status === 422 ? 'invalidFields' : response.status === 401 ? (path.endsWith('/claim') ? 'missingSession' : 'invalid') : 'failed';
      throw new Error(key);
    }
    return value;
  };
  const status = async () => {
    identity = await request('/api/v1/auth/account'); ready = true; paint();
    if (!identity.playerId) { element('loginPanel').open = true; message('anonymous'); }
    else message(identity.claimed ? 'claimed' : 'guest');
  };
  const submit = async (action, data) => {
    if (busy || !ready) return;
    if (action !== 'login' && data.password !== data.confirmation) { message('mismatch', true); return; }
    if (action === 'login' && identity?.playerId && !element('switchGuest').checked) { message('switched', true); return; }
    if (!['claim', 'login', 'recover', 'logout'].includes(action)) return;
    busy = true; paint(); message('busy');
    const body = action === 'logout' ? {} : { username: data.username, password: data.password, ...(action === 'recover' ? { recoveryCode: data.recoveryCode } : {}) };
    try {
      const result = await request('/api/v1/auth/' + action, body);
      document.querySelectorAll('input[type=password]').forEach(input => { input.value = ''; });
      document.querySelectorAll('input[name=recoveryCode]').forEach(input => { input.value = ''; });
      if (result.recoveryCode) { element('recoveryCode').textContent = result.recoveryCode; element('backupSaved').checked = false; backup = true; }
      if (action === 'logout') { backup = false; element('recoveryCode').textContent = ''; }
      await status();
      message(action === 'logout' ? 'signedOut' : result.recoveryCode ? 'saved' : 'signedIn');
    } catch (error) { message(copy[lang][error.message] ? error.message : 'failed', true); }
    finally { busy = false; paint(); }
  };
  const randomWord = list => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return list[buf[0] % list.length];
    }
    return list[Math.floor(Math.random() * list.length)];
  };
  const updateMeter = () => {
    const val = String(element('claimPassword').value || '');
    element('passphraseMeter').textContent = val ? (val.length >= 15 ? '✓ ' + val.length + '/15+' : val.length + '/15') : '';
  };
  element('claimPassword').addEventListener('input', updateMeter);
  element('generatePassphrase').addEventListener('click', () => {
    const words = ['velvet', 'harbor', 'cipher', 'obsidian', 'falcon', 'syndicate', 'amber', 'shadow', 'viper', 'platinum', 'midnight', 'monarch', 'cobalt', 'sector', 'dagger', 'crown'];
    const digits = String(1000 + (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? (crypto.getRandomValues(new Uint32Array(1))[0] % 9000) : Math.floor(Math.random() * 9000)));
    const generated = [randomWord(words), randomWord(words), randomWord(words), randomWord(words), digits].join('-');
    element('claimPassword').value = generated;
    element('claimConfirm').value = generated;
    element('claimPassword').type = 'text';
    element('claimConfirm').type = 'text';
    updateMeter();
    message('generated');
  });
  element('togglePasswordView').addEventListener('click', () => {
    const nextType = element('claimPassword').type === 'text' ? 'password' : 'text';
    element('claimPassword').type = nextType;
    element('claimConfirm').type = nextType;
  });
  element('copyRecoveryCode').addEventListener('click', () => {
    const code = String(element('recoveryCode').textContent || '').trim();
    if (!code) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(code).then(() => message('copied')).catch(() => {});
    }
  });
  for (const action of ['claim', 'login', 'recover']) element(action + 'Form').addEventListener('submit', event => { event.preventDefault(); submit(action, Object.fromEntries(new FormData(event.currentTarget))); });
  element('logout').addEventListener('click', () => submit('logout', {}));
  element('backupSaved').addEventListener('change', paint);
  element('backToGame').addEventListener('click', event => { if (backup && !element('backupSaved').checked) { event.preventDefault(); message('saveFirst', true); } });
  element('languageToggle').addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; translate(); });
  window.addEventListener('beforeunload', event => { if (backup && !element('backupSaved').checked) { event.preventDefault(); event.returnValue = ''; } });
  // Exposed controller contains no credentials or recovery-code state.
  window.ZoneAccount = {
    submit,
    current: () => identity,
    supportedActions: () => ['claim', 'login', 'recover', 'logout'],
    isSupportedAction: action => ['claim', 'login', 'recover', 'logout'].includes(String(action ?? '')),
    isClaimed: () => Boolean(identity?.claimed),
    isGuest: () => Boolean(identity?.playerId && !identity?.claimed),
    supportedLanguages: () => Object.keys(copy),
    isSupportedLanguage: language => Object.hasOwn(copy, String(language ?? '')),
    currentLanguage: () => lang,
    accountStatusEndpointPath: () => '/api/v1/auth/account',
    isReady: () => Boolean(ready && !busy),
    diagnostics: () => ({
      lang,
      ready,
      busy,
      backup,
      active: Boolean(identity?.playerId),
      claimed: Boolean(identity?.claimed),
      messageKey,
      messageError,
    }),
  };
  translate(); status().catch(() => { ready = false; paint(); message('failed', true); });
})();
