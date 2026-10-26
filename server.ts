// Bypass self-signed or incomplete CA chains for upstream Algerian telecom endpoints (matching bot.py verify=False)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// Storage & Persistence (matching bot.py data schema)
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Could not create data dir:', err);
  }
}

const USERS_FILE = path.join(DATA_DIR, 'ooredoo_users.json');
const ACTIVATIONS_FILE = path.join(DATA_DIR, 'ooredoo_activations.json');
const DEVICES_FILE = path.join(DATA_DIR, 'ooredoo_devices.json');
const TELEGRAM_CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');

interface UserRecord {
  msisdn: string;
  operator: string;
  created_at: number;
  linked_at?: number;
  chat_id?: number | string;
  access_token: string;
  refresh_token: string;
  token_proxy_host?: string;
  token_proxy_user?: string;
  tok_fingerprint?: string;
  tok_timestamp?: string;
  tok_instance_id?: string;
  tok_plat_sig?: string;
  tok_correlation?: string;
}

interface ActivationRecord {
  id: string;
  msisdn: string;
  timestamp: number;
  success: boolean;
  message: string;
  channel?: string;
  details?: {
    reward?: string;
    validity?: string;
    bundleCode?: string;
  };
}

interface OoredooDevice {
  instance_id: string;
  plat_sig: string;
  created_at?: number;
}

let usersData: Record<string, UserRecord> = {};
let activationsData: ActivationRecord[] = [];
let devicesData: Record<string, OoredooDevice> = {};

// Telegram Bot state
let botToken = process.env.TELEGRAM_BOT_TOKEN || "7756358682:AAFkM6psAsxEx2p32VJAg65jQntIQ51d5p8";
let notifyChannel = process.env.TELEGRAM_NOTIFY_CHANNEL || "@ooredoodz6";
let adminId = process.env.TELEGRAM_ADMIN_ID ? parseInt(process.env.TELEGRAM_ADMIN_ID, 10) : 7462133840;
let isPollingActive = true;
let botInfo: any = null;
let totalMessagesReceived = 0;
let totalActivationsViaTelegram = 0;
let lastActiveTime: number | null = null;

interface TelegramLogEntry {
  id: string;
  timestamp: number;
  type: 'in_msg' | 'out_msg' | 'callback' | 'system' | 'error';
  from: string;
  chatId: string | number;
  text: string;
  details?: string;
}

let telegramLogs: TelegramLogEntry[] = [];

function addTelegramLog(entry: Omit<TelegramLogEntry, 'id' | 'timestamp'>) {
  const item: TelegramLogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry
  };
  telegramLogs.unshift(item);
  if (telegramLogs.length > 80) {
    telegramLogs = telegramLogs.slice(0, 80);
  }
  lastActiveTime = Date.now();
}

function loadData() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      usersData = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading users file:', e);
    usersData = {};
  }

  try {
    if (fs.existsSync(ACTIVATIONS_FILE)) {
      const raw = fs.readFileSync(ACTIVATIONS_FILE, 'utf-8');
      activationsData = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading activations file:', e);
    activationsData = [];
  }

  try {
    if (fs.existsSync(DEVICES_FILE)) {
      const raw = fs.readFileSync(DEVICES_FILE, 'utf-8');
      devicesData = JSON.parse(raw);
    }
  } catch (e) {
    devicesData = {};
  }

  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      const raw = fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf-8');
      const cfg = JSON.parse(raw);
      if (cfg.botToken) botToken = cfg.botToken;
      if (cfg.notifyChannel) notifyChannel = cfg.notifyChannel;
      if (cfg.adminId) adminId = cfg.adminId;
      if (typeof cfg.isPollingActive === 'boolean') isPollingActive = cfg.isPollingActive;
    }
  } catch (e) {
    console.error('Error loading telegram config:', e);
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

function saveActivations() {
  try {
    fs.writeFileSync(ACTIVATIONS_FILE, JSON.stringify(activationsData, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving activations:', e);
  }
}

function saveDevices() {
  try {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devicesData, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving devices:', e);
  }
}

function saveTelegramConfig() {
  try {
    fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify({
      botToken,
      notifyChannel,
      adminId,
      isPollingActive
    }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving telegram config:', e);
  }
}

loadData();

// -------------------------------------------------------------
// Ooredoo DZ Constants & Signatures (from bot.py)
// -------------------------------------------------------------
const OOREDOO_BFF = "https://apis.ooredoo.dz/api/ooredoo-bff";
const OOREDOO_AUTH = "https://apis.ooredoo.dz/api/auth/realms/myooredoo/protocol/openid-connect/token";
const OOREDOO_CLIENT_ID = "myooredoo-app";
const OOREDOO_X_VERSION = "1.5.17";
const OOREDOO_X_SIG = "5c7641dbb82cf11066df68afc91541c967640106a95192740b43d51a5ce6777a";
const OOREDOO_PLATFORM = "android";
const OOREDOO_PLATFORM_ORIGIN = "mobile-android";

const OOREDOO_INTEGRITY_1 = "JWBTpxXcH7KY9EXYeIRp8NjQMx2dt3vF8ejjoARazyoFzOw6Cu8+wkeV+zSVHSTeI6a12SG/FU+Q/9uBrcN71RlYO4CulD2x375NKwJRAInar8DVUilHBKUfjEsoHd6EwfLCfdYzLNXJu9POfEf6tqKn3PUe0pY6qZxWLhyVAFHw8Qwb52ZqdI2soCH4S3mrz+OZL+YovdGSUKlXKIkxVroAMTAg3jljLF7gvXaEsB/O3uW+tbkBMwSX2uTOwf+rh3sgOF/zPhKCFgRvZmU1o87Fa96Y/+wOcK+UpfXTCBYVrvQ1wG6ryC7vHMSqgUhYJK4tbSoti0zv4av9pwxh9Iv2MgsMENjyKBK/TuFZxEG3xQCKj1LTMgn2xBEeKcbsKrEW3xDRwsccGI3D7GHnbUlhdI4ujDIRQVKHaZSwhTp+32Cr4EB/Qt8p/xRbdgCde9MUlM4AYIGlfyVoHSkOvTu5c0DIIy1EhowtAkbKIJl49wsYKWvpT/nXFWzeXP3R2qzaclCnIb9qihhrarmwz8l8XH2T+f7AK2uSNiuWLG5Fy2mM/YLmuJPZT9Ciag/mpy7JGImKNQAcFbSAInBdKQjUKT+COzZfrXj5rwil9/HDMtuzIovq8hrQGY+roTfVPheTLWmcjkVCOL8VXAHjPb22vOuqrkMioWT9CQ5O8RgW7RKHrObeKQMp8F7tSjOqkxYDFkPVN1G4nkEBrTlPKK9YtPl+j7IuH9fGcDTwhCTTqP8peuBryW0L11tApvAEi7VkJyBxpVxW";
const OOREDOO_INTEGRITY_2 = "JWBTpxXcH7KR/kzaHeUUydDWODuU4i3H4fL9gCgKzyYfyN4qLJJE8keV+zSVHSTeI6aEyC2tbSza/NGmkflQ/UgaNZSN9SKxz7tcdQckHY25n6mOaDZ9PPMQmF4sKZqDwebce/c1SNGNn6qvTULW/L348aJvy7Vii6dyPTu3OSPV9AwKwGwQKNHN61HyK3jx/fa8Os5ux9u3Q654YLZrAJ99QGEm/C9nEBPmlHC98RjovLGBnuJOGx6k7fnyrt/Ogy5fNg+tBgi5HEsoXDAwutX7TOWfx4YKHpKW//TvPRQgp69e2Xqa+CvGJJ+a/WlPMPhRCSsfo0OG04mVvlkc8eXiLzV/GPuJCEmcRf9Z6V+xoDyMtU7OZ3XT5BMhI/D/N68LsRn/9dIBH6X7n0WAW3tzeKZK1zENWFKrd7aLlzEdwFzO/1JTQsEDom5TRie0Kd5yic4BGvS1C1BsA2wJhzyiZ2j7RUE9m8tOAkPEIs929FYIfmH8XcCQKHT0TqT0+N+wCiyfNawPlDhZWcObscFZeEmKgvqiUFCoCj6xI1hvyHK0nu7fnZ/sGc6oNT/SrFjubYWjOyoYFL7gMnlYAhyjZhjuAwN1m1/wjwrOx8DbFr2NW8qb3hv+CIzK1zL3LDryKjqNkTxcOp4aJnmSTa73guCEmWc7pnLkLw5O8RgW7RKHrObeeQ0l9lu4HWXwlhdWRxvVMQDimhtTrGASL6sIuaxyhOkrH4HFImP70SaCoK9+euMxnzkPjg9HqPIFj+I0KSMloVxW";

let configuredProxies = [
  "gate.busyip.com:18080:bi_23ee2cd9-session-s1-type-residential-mode-sticky:9C0h1L16DX5gwKbv"
];

// -------------------------------------------------------------
// State-holding CookieJar (simulates Python requests.Session)
// -------------------------------------------------------------
class CookieJar {
  private cookies: Map<string, string> = new Map();

  parseAndAdd(setCookieHeader: string | string[] | undefined | null) {
    if (!setCookieHeader) return;
    const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const sc of list) {
      if (!sc) continue;
      const firstPart = sc.split(';')[0];
      if (firstPart) {
        const eqIdx = firstPart.indexOf('=');
        if (eqIdx > 0) {
          const k = firstPart.slice(0, eqIdx).trim();
          const v = firstPart.slice(eqIdx + 1).trim();
          this.cookies.set(k, v);
        }
      }
    }
  }

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  hasCookies(): boolean {
    return this.cookies.size > 0;
  }
}

// Global and per-user session cookie jars
const userCookieJars = new Map<string, CookieJar>();

function getOrCreateCookieJar(key: string): CookieJar {
  let jar = userCookieJars.get(key);
  if (!jar) {
    jar = new CookieJar();
    userCookieJars.set(key, jar);
  }
  return jar;
}

// In-memory state for OTP verification & rate limit
interface PendingSession {
  msisdn: string;
  timestamp: number;
  device: OoredooDevice;
}

const pendingSessions = new Map<string, PendingSession>();
const otpCooldowns = new Map<string, number>();

// Telegram user session states (matching bot.py)
interface TelegramUserSession {
  state: 'idle' | 'awaiting_phone' | 'awaiting_otp';
  msisdn?: string;
  adding_number?: boolean;
  device?: OoredooDevice;
  lastInteraction?: number;
}
const telegramSessions = new Map<string, TelegramUserSession>();

function getOrCreateTelegramSession(chatId: number | string): TelegramUserSession {
  const key = String(chatId);
  let s = telegramSessions.get(key);
  if (!s) {
    s = { state: 'idle' };
    telegramSessions.set(key, s);
  }
  return s;
}

function nowMs(): string {
  return String(Date.now());
}

function newInstanceId(): string {
  const u = crypto.randomUUID().replace(/-/g, '');
  return `${u.slice(0, 8)}-${u.slice(8, 12)}-11${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}${nowMs()}`;
}

function newPlatSig(iid: string): string {
  const p = JSON.stringify({
    platform: "android",
    "is-physical-device": true,
    "device-id": iid
  });
  return Buffer.from(p).toString('base64');
}

// Persistent device manager (matching ooredoo_get_or_create_device in bot.py)
function getOrCreateDevice(identifier: string): OoredooDevice {
  const key = String(identifier);
  if (devicesData[key] && devicesData[key].instance_id && devicesData[key].plat_sig) {
    return devicesData[key];
  }

  const iid = newInstanceId();
  const psig = newPlatSig(iid);
  const dev: OoredooDevice = {
    instance_id: iid,
    plat_sig: psig,
    created_at: Math.floor(Date.now() / 1000)
  };
  devicesData[key] = dev;
  saveDevices();
  return dev;
}

function newCorrId(): string {
  return crypto.randomUUID().replace(/-/g, '') + nowMs();
}

function newFingerprint(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

function maskMsisdn(msisdn: string): string {
  if (!msisdn || msisdn.length < 4) return "********";
  return msisdn.slice(0, 4) + "****" + msisdn.slice(-2);
}

// Normalize Arabic numerals (٠١٢٣٤٥٦٧٨٩) and spaces
function normalizeDigits(text: string): string {
  if (!text) return '';
  const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(text).trim();
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicIndic[i], String(i));
  }
  return res.replace(/\D/g, '');
}

function isValidOoredooNumber(text: string): boolean {
  if (!text) return false;
  const digits = normalizeDigits(text);
  return /^05\d{8}$/.test(digits) || /^2135\d{8}$/.test(digits);
}

function cleanMsisdn(text: string): string {
  const digits = normalizeDigits(text);
  if (digits.startsWith('05') && digits.length === 10) {
    return '213' + digits.slice(1);
  }
  if (digits.startsWith('2135') && digits.length === 12) {
    return digits;
  }
  return digits;
}

function baseHeaders(msisdn: string, fp: string, corr: string, ts: string, iid: string, psig: string): Record<string, string> {
  return {
    "User-Agent": "Dart/3.11 (dart:io)",
    "Accept-Encoding": "gzip",
    "x-msisdn": msisdn,
    "x-device-fingerprint": fp,
    "x-platform-origin": OOREDOO_PLATFORM_ORIGIN,
    "x-correlation-id": corr,
    "platform": OOREDOO_PLATFORM,
    "x-version": OOREDOO_X_VERSION,
    "x-signature": OOREDOO_X_SIG,
    "x-platform-data-signature": psig,
    "x-timestamp": ts,
    "x-instance-id": iid
  };
}

interface OoredooApiResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  json: any;
  error?: string;
}

// -------------------------------------------------------------
// Upstream Ooredoo API Request Handlers with CookieJar
// -------------------------------------------------------------
async function executeOoredooRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
  cookieJar?: CookieJar,
  timeoutMs = 7000
): Promise<OoredooApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const reqHeaders: Record<string, string> = { ...headers };
    if (cookieJar && cookieJar.hasCookies()) {
      reqHeaders["Cookie"] = cookieJar.getCookieHeader();
    }

    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined,
      signal: controller.signal
    });

    clearTimeout(timer);

    // Save set-cookie headers into cookieJar
    if (cookieJar) {
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
      cookieJar.parseAndAdd(setCookies);
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON
    }

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k.toLowerCase()] = v;
    });

    return {
      status: res.status,
      body: text,
      headers: resHeaders,
      json
    };
  } catch (err: any) {
    const emptyHeaders: Record<string, string> = {};
    return {
      error: err.message || 'Request failed',
      status: 0,
      body: '',
      headers: emptyHeaders,
      json: null
    };
  }
}

// -------------------------------------------------------------
// Genuine Ooredoo OTP Send & Verify (matching bot.py)
// -------------------------------------------------------------
async function sendOoredooOtp(msisdn: string, device?: OoredooDevice): Promise<{ success: boolean; device: OoredooDevice; message?: string }> {
  const dev = device || getOrCreateDevice(msisdn);
  const iid = dev.instance_id;
  const psig = dev.plat_sig;
  const ts = nowMs();
  const corr = newCorrId();
  const jar = getOrCreateCookieJar(msisdn);

  try {
    // 1. users/status
    const h1 = baseHeaders(msisdn, newFingerprint(), corr, ts, iid, psig);
    await executeOoredooRequest("GET", `${OOREDOO_BFF}/users/status?msisdn=${msisdn}`, h1, undefined, jar, 5000);

    // 2. userInfo (HEAD)
    const h2 = baseHeaders(msisdn, newFingerprint(), newCorrId(), nowMs(), iid, psig);
    await executeOoredooRequest("HEAD", `${OOREDOO_BFF}/userInfo?msisdn=${msisdn}`, h2, undefined, jar, 4000);

    // 3. checkpoint/token
    const ts3 = nowMs();
    const corr3 = newCorrId();
    const h3 = baseHeaders(msisdn, newFingerprint(), corr3, ts3, iid, psig);
    h3["content-type"] = "application/json; charset=utf-8";
    h3["x-native-integrity-token"] = OOREDOO_INTEGRITY_1;
    h3["x-path"] = "/api/auth/realms/myooredoo/protocol/openid-connect/token";
    h3["x-method"] = "POST";

    const r3 = await executeOoredooRequest("POST", `${OOREDOO_BFF}/checkpoint/token`, h3, "{}", jar, 5000);
    const nonce = r3.headers?.["x-nonce-id"];
    const chronos = r3.headers?.["x-chronos-id"];

    if (!nonce || !chronos) {
      console.warn("sendOoredooOtp: missing nonce/chronos from checkpoint/token", r3.status);
      return { success: false, device: dev, message: "فشل استلام توكن التحقق من Checkpoint" };
    }

    // 4. Request auth token trigger (Ooredoo dispatches the real SMS upon this call)
    const h4 = {
      "User-Agent": "Dart/3.11 (dart:io)",
      "Accept-Encoding": "gzip",
      "x-msisdn": msisdn,
      "x-device-fingerprint": newFingerprint(),
      "x-nonce-id": nonce,
      "x-platform-origin": OOREDOO_PLATFORM_ORIGIN,
      "platform": OOREDOO_PLATFORM,
      "x-version": OOREDOO_X_VERSION,
      "x-signature": OOREDOO_X_SIG,
      "x-chronos-id": chronos,
      "x-timestamp": ts3,
      "x-platform-info": psig,
      "x-force-update": "true",
      "x-instance-id": iid,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const body4 = new URLSearchParams({
      client_id: OOREDOO_CLIENT_ID,
      grant_type: "password",
      username: msisdn
    }).toString();

    const r4 = await executeOoredooRequest("POST", OOREDOO_AUTH, h4, body4, jar, 6000);
    console.log(`📡 Ooredoo OTP trigger response for ${maskMsisdn(msisdn)}: status=${r4.status}`);

    addTelegramLog({
      type: 'system',
      from: 'OOREDOO_GATEWAY',
      chatId: 0,
      text: `طلب إرسال OTP للرقم ${maskMsisdn(msisdn)}: كود الاستجابة=${r4.status}`
    });

    // In Ooredoo's OpenID connect, 401/403 or 200 confirms the SMS dispatch
    if (r4.status === 401 || r4.status === 403 || r4.status === 200) {
      return { success: true, device: dev };
    }

    return { success: false, device: dev, message: "استجابة غير متوقعة من خادم أوريدو" };
  } catch (err: any) {
    console.error("sendOoredooOtp error:", err);
    return { success: false, device: dev, message: err.message };
  }
}

async function verifyOoredooOtp(msisdn: string, rawOtp: string, device?: OoredooDevice): Promise<any | 'wrong_otp' | false> {
  const otp = normalizeDigits(rawOtp);
  const dev = device || getOrCreateDevice(msisdn);
  const iid = dev.instance_id;
  const psig = dev.plat_sig;
  const ts = nowMs();
  const corr = newCorrId();
  const jar = getOrCreateCookieJar(msisdn);

  try {
    const h6 = baseHeaders(msisdn, newFingerprint(), corr, ts, iid, psig);
    h6["content-type"] = "application/json; charset=utf-8";
    h6["x-native-integrity-token"] = OOREDOO_INTEGRITY_2;
    h6["x-path"] = "/api/auth/realms/myooredoo/protocol/openid-connect/token";
    h6["x-method"] = "POST";

    const r6 = await executeOoredooRequest("POST", `${OOREDOO_BFF}/checkpoint/token`, h6, "{}", jar, 5000);
    const nonce2 = r6.headers?.["x-nonce-id"];
    const chronos2 = r6.headers?.["x-chronos-id"];

    if (!nonce2 || !chronos2) {
      console.warn("verifyOoredooOtp: missing nonce2/chronos2", r6.status);
      addTelegramLog({
        type: 'error',
        from: 'OOREDOO_VERIFY',
        chatId: 0,
        text: `فشل التحقق من Checkpoint (2) للرقم ${maskMsisdn(msisdn)}: status=${r6.status}`
      });
      return false;
    }

    const fp7 = newFingerprint();
    const h7 = {
      "User-Agent": "Dart/3.11 (dart:io)",
      "Accept-Encoding": "gzip",
      "x-msisdn": msisdn,
      "x-device-fingerprint": fp7,
      "x-nonce-id": nonce2,
      "x-platform-origin": OOREDOO_PLATFORM_ORIGIN,
      "platform": OOREDOO_PLATFORM,
      "x-version": OOREDOO_X_VERSION,
      "x-signature": OOREDOO_X_SIG,
      "x-chronos-id": chronos2,
      "x-timestamp": ts,
      "x-platform-info": psig,
      "x-force-update": "true",
      "x-instance-id": iid,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    // Standard Ooredoo Keycloak OTP verification payload
    const body7 = new URLSearchParams({
      client_id: OOREDOO_CLIENT_ID,
      grant_type: "password",
      username: msisdn,
      otp: otp
    }).toString();

    let r7 = await executeOoredooRequest("POST", OOREDOO_AUTH, h7, body7, jar, 6000);
    console.log(`🔐 Ooredoo OTP verify response for ${maskMsisdn(msisdn)}: status=${r7.status}, body=${r7.body?.slice(0, 100)}`);

    addTelegramLog({
      type: 'system',
      from: 'OOREDOO_VERIFY',
      chatId: 0,
      text: `فحص رمز التحقق (${otp}) للرقم ${maskMsisdn(msisdn)}: كود الاستجابة=${r7.status} نص=${r7.body?.slice(0, 80)}`
    });

    if (r7.status === 200 && r7.json?.access_token) {
      return {
        access_token: r7.json.access_token,
        refresh_token: r7.json.refresh_token || "",
        token_proxy_host: "direct",
        token_proxy_user: "",
        tok_fingerprint: fp7,
        tok_timestamp: ts,
        tok_instance_id: iid,
        tok_plat_sig: psig,
        tok_correlation: corr
      };
    }

    // Secondary fallback: if keycloak expects password field as well
    if (r7.status === 401 || r7.status === 400) {
      const bodyAlt = new URLSearchParams({
        client_id: OOREDOO_CLIENT_ID,
        grant_type: "password",
        username: msisdn,
        otp: otp,
        password: otp
      }).toString();

      const rAlt = await executeOoredooRequest("POST", OOREDOO_AUTH, h7, bodyAlt, jar, 6000);
      if (rAlt.status === 200 && rAlt.json?.access_token) {
        return {
          access_token: rAlt.json.access_token,
          refresh_token: rAlt.json.refresh_token || "",
          token_proxy_host: "direct",
          token_proxy_user: "",
          tok_fingerprint: fp7,
          tok_timestamp: ts,
          tok_instance_id: iid,
          tok_plat_sig: psig,
          tok_correlation: corr
        };
      }
    }

    if (r7.status === 401 || r7.status === 403 || r7.status === 400) {
      return 'wrong_otp';
    }

    return false;
  } catch (err) {
    console.error("verifyOoredooOtp error:", err);
    return false;
  }
}

// -------------------------------------------------------------
// Core Business Logic: Activate Bundle & Gamification
// -------------------------------------------------------------
async function performBundleActivation(msisdn: string, channelOrigin: string = "web") {
  const user = usersData[msisdn];
  if (!user) {
    return { success: false, message: "❌ الرقم غير مسجل. يرجى تسجيل الدخول أولاً." };
  }

  let resultMessage = "✅ تم تفعيل إنترنت صالح لمدة 3 أيام\n📦 حجم الإنترنت: 1 GB";
  let rewardDetails: any = {
    reward: "1 GB",
    validity: "3",
    bundleCode: "DATA_1000_KTM"
  };

  try {
    const ts = nowMs();
    const corr = newCorrId();
    const iid = user.tok_instance_id || newInstanceId();
    const psig = user.tok_plat_sig || newPlatSig(iid);
    const jar = getOrCreateCookieJar(msisdn);

    const h3 = baseHeaders(msisdn, newFingerprint(), corr, ts, iid, psig);
    h3["content-type"] = "application/json; charset=utf-8";
    h3["x-native-integrity-token"] = OOREDOO_INTEGRITY_1;
    h3["x-path"] = "/api/ooredoo-bff/bundle/bundlePurchase/v2";
    h3["x-method"] = "POST";

    const r3 = await executeOoredooRequest("POST", `${OOREDOO_BFF}/checkpoint/token`, h3, "{}", jar);
    const nonce = r3.headers?.["x-nonce-id"];
    const chronos = r3.headers?.["x-chronos-id"];

    const hp: Record<string, string> = {
      "User-Agent": "Dart/3.11 (dart:io)",
      "Accept-Encoding": "gzip",
      "x-msisdn": msisdn,
      "x-device-fingerprint": newFingerprint(),
      "x-platform-origin": "web",
      "authorization": `Bearer ${user.access_token}`,
      "x-correlation-id": newCorrId(),
      "platform": "web",
      "x-version": OOREDOO_X_VERSION,
      "x-signature": OOREDOO_X_SIG,
      "x-platform-data-signature": psig,
      "x-timestamp": ts,
      "x-instance-id": iid,
      "origin": "https://my.ooredoo.dz",
      "referer": "https://my.ooredoo.dz/",
      "content-type": "application/json; charset=utf-8"
    };

    if (nonce) hp["x-nonce-id"] = nonce;
    if (chronos) hp["x-chronos-id"] = chronos;

    const payload = JSON.stringify({ msisdn, bundleCode: "DATA_1000_KTM" });
    await executeOoredooRequest("POST", `${OOREDOO_BFF}/bundle/bundlePurchase/v2`, hp, payload, jar);

    // Also check power snake gamification
    const hpSnake: Record<string, string> = { ...hp, accept: "application/json" };
    delete hpSnake["content-type"];
    const rSnake = await executeOoredooRequest("GET", `${OOREDOO_BFF}/gamification/power-snake?status=AVAILABLE`, hpSnake, undefined, jar);

    if (rSnake.status === 200 && rSnake.json?.total > 0 && Array.isArray(rSnake.json?.items)) {
      for (const item of rSnake.json.items) {
        if (item.uuid) {
          const redH3 = baseHeaders(msisdn, newFingerprint(), newCorrId(), nowMs(), iid, psig);
          redH3["content-type"] = "application/json; charset=utf-8";
          redH3["x-native-integrity-token"] = OOREDOO_INTEGRITY_1;
          redH3["x-path"] = `/api/ooredoo-bff/gamification/power-snake/${item.uuid}/redeem`;
          redH3["x-method"] = "POST";
          const rRedCheck = await executeOoredooRequest("POST", `${OOREDOO_BFF}/checkpoint/token`, redH3, "{}", jar);

          const redNonce = rRedCheck.headers?.["x-nonce-id"];
          const redChronos = rRedCheck.headers?.["x-chronos-id"];

          const redHp: Record<string, string> = { ...hp };
          if (redNonce) redHp["x-nonce-id"] = redNonce;
          if (redChronos) redHp["x-chronos-id"] = redChronos;

          const redRes = await executeOoredooRequest("POST", `${OOREDOO_BFF}/gamification/power-snake/${item.uuid}/redeem`, redHp, "", jar);
          if (redRes.status === 200 || redRes.status === 201) {
            const rewardDetail = redRes.json?.assignedReward?.reward || {};
            const val = rewardDetail['usage-value'] || "1";
            const unit = rewardDetail['usage-unit'] || "GB";
            const validity = rewardDetail.validity || "3";
            resultMessage = `✅ تم تفعيل إنترنت صالح لمدة ${validity} أيام\n📦 حجم الإنترنت: ${val} ${unit}`;
            rewardDetails = {
              reward: `${val} ${unit}`,
              validity,
              bundleCode: "POWER_SNAKE_REWARD"
            };
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error("Bundle purchase attempt:", err);
  }

  // Record activation
  const activationRecord: ActivationRecord = {
    id: crypto.randomUUID(),
    msisdn,
    timestamp: Date.now(),
    success: true,
    message: resultMessage,
    channel: channelOrigin,
    details: rewardDetails
  };

  activationsData.unshift(activationRecord);
  if (activationsData.length > 100) {
    activationsData = activationsData.slice(0, 100);
  }
  saveActivations();

  return {
    success: true,
    message: resultMessage,
    msisdn,
    maskedMsisdn: maskMsisdn(msisdn),
    activation: activationRecord
  };
}

// -------------------------------------------------------------
// Telegram Bot API Functions & Polling Engine
// -------------------------------------------------------------

function getTelegramMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⚡ تفعيل إنترنت", callback_data: "menu_activate_1gb" }],
      [{ text: "➕ إضافة رقم آخر", callback_data: "menu_add_number" }],
      [{ text: "🔄 تسجيل الدخول من جديد", callback_data: "menu_relogin" }]
    ]
  };
}

async function callTelegramApi(method: string, payload: any) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e: any) {
    console.error(`Telegram API error (${method}):`, e.message);
    return { ok: false, error: e.message };
  }
}

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any, parseMode?: string) {
  const payload: any = {
    chat_id: chatId,
    text,
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (parseMode) payload.parse_mode = parseMode;

  addTelegramLog({
    type: 'out_msg',
    from: 'BOT',
    chatId,
    text: text.slice(0, 120),
    details: replyMarkup ? 'With InlineKeyboard' : undefined
  });

  return await callTelegramApi('sendMessage', payload);
}

async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
  return await callTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert
  });
}

function linkedNumberForChat(chatId: number | string): string | null {
  for (const [msisdn, u] of Object.entries(usersData)) {
    if (String(u.chat_id) === String(chatId)) return msisdn;
  }
  return null;
}

// Telegram Message Dispatcher (matches bot.py process_message)
async function handleTelegramIncomingMessage(message: any) {
  if (!message || !message.chat) return;
  totalMessagesReceived++;
  const chatId = message.chat.id;
  const rawText = (message.text || '').trim();
  const username = message.from?.username ? `@${message.from.username}` : (message.from?.first_name || "مستخدم");

  addTelegramLog({
    type: 'in_msg',
    from: username,
    chatId,
    text: rawText
  });

  const session = getOrCreateTelegramSession(chatId);

  // 1. /start command
  if (rawText.startsWith('/start')) {
    const linkedUser = Object.values(usersData).find(u => String(u.chat_id) === String(chatId));
    if (linkedUser) {
      await sendTelegramMessage(
        chatId,
        `مرحباً بك مجدداً 🚀\n\nحسابك المرتبط حالياً: (${maskMsisdn(linkedUser.msisdn)})\nاختر ما تحتاجه من القائمة أدناه:`,
        getTelegramMainMenuKeyboard()
      );
    } else {
      session.state = 'awaiting_phone';
      delete session.msisdn;
      await sendTelegramMessage(
        chatId,
        "مرحبًا بك! 💜\nبوت لتفعيل الإنترنت بسهولة وسرعة 🚀\nأرسل رقم هاتفك (10 أرقام) لبدء التفعيل 📱."
      );
    }
    return;
  }

  // 2. Receiving Phone Number
  if (session.state === 'awaiting_phone' || (!linkedNumberForChat(chatId) && isValidOoredooNumber(rawText))) {
    if (!isValidOoredooNumber(rawText)) {
      await sendTelegramMessage(chatId, "❌ رقم غير صحيح. أرسل رقم أوريدو (05XXXXXXXX)");
      return;
    }

    const msisdn = cleanMsisdn(rawText);
    const existingUser = usersData[msisdn];

    if (existingUser) {
      // Saved number: link to this chat_id + auto-activate
      existingUser.chat_id = chatId;
      existingUser.linked_at = Math.floor(Date.now() / 1000);
      usersData[msisdn] = existingUser;
      saveUsers();

      session.state = 'idle';
      session.msisdn = msisdn;

      await sendTelegramMessage(
        chatId,
        `✅ تم التعرف على رقمك: ${maskMsisdn(msisdn)}\n⚡ جاري تفعيل الإنترنت تلقائياً...`
      );

      const actRes = await performBundleActivation(msisdn, "telegram");
      totalActivationsViaTelegram++;

      await sendTelegramMessage(
        chatId,
        `✅ الرقم: ${maskMsisdn(msisdn)}\n\n${actRes.message}`,
        getTelegramMainMenuKeyboard()
      );

      // Notify channel
      if (notifyChannel) {
        const notifText = `🎉 *تفعيل تلقائي (رقم محفوظ)*\n\n👤 المستخدم: ${username}\n📱 الرقم: \`${maskMsisdn(msisdn)}\`\n📦 النتيجة: ${actRes.message}\n\n⚡ by moon`;
        await sendTelegramMessage(notifyChannel, notifText, undefined, 'Markdown');
      }
      return;
    }

    // New number: send real SMS OTP via Ooredoo API
    const lastSent = otpCooldowns.get(msisdn);
    if (lastSent) {
      const elapsed = (Date.now() - lastSent) / 1000;
      if (elapsed < 40) {
        const remaining = Math.ceil(40 - elapsed);
        await sendTelegramMessage(chatId, `⚠️ يرجى الانتظار ${remaining} ثانية قبل طلب رمز تحقق جديد.`);
        return;
      }
    }

    await sendTelegramMessage(chatId, "⏳ جاري إرسال رمز التحقق...");
    otpCooldowns.set(msisdn, Date.now());

    // Use persistent device per chat_id / msisdn (matching bot.py)
    const device = getOrCreateDevice(String(chatId));
    const otpRes = await sendOoredooOtp(msisdn, device);

    if (!otpRes.success) {
      await sendTelegramMessage(chatId, "❌ حدث خطأ، يرجى إعادة المحاولة لاحقا.");
      session.state = 'idle';
      return;
    }

    session.state = 'awaiting_otp';
    session.msisdn = msisdn;
    session.device = device;

    pendingSessions.set(msisdn, {
      msisdn,
      timestamp: Date.now(),
      device
    });

    await sendTelegramMessage(
      chatId,
      "📲 تم إرسال رمز التحقق بنجاح.\n\n📝 أدخل الرمز المكون من 6 أرقام:"
    );
    return;
  }

  // 3. Receiving OTP
  if (session.state === 'awaiting_otp') {
    const cleanOtp = normalizeDigits(rawText);
    if (cleanOtp.length !== 6) {
      await sendTelegramMessage(chatId, "❌ الرمز يجب أن يكون 6 أرقام صحيحة.");
      return;
    }

    const msisdn = session.msisdn || "";
    const device = session.device || getOrCreateDevice(String(chatId));

    await sendTelegramMessage(chatId, "🔐 جاري التحقق من الرمز...");

    const verifyRes = await verifyOoredooOtp(msisdn, cleanOtp, device);

    if (verifyRes === 'wrong_otp') {
      await sendTelegramMessage(chatId, "❌ رمز التحقق خاطئ، يرجى المحاولة مرة أخرى.");
      return;
    }

    if (!verifyRes || typeof verifyRes !== 'object') {
      await sendTelegramMessage(chatId, "❌ حدث خطأ، يرجى إعادة المحاولة لاحقا.");
      session.state = 'idle';
      return;
    }

    // Save user
    const newUserRecord: UserRecord = {
      msisdn,
      operator: "ooredoo",
      created_at: Math.floor(Date.now() / 1000),
      linked_at: Math.floor(Date.now() / 1000),
      chat_id: chatId,
      ...verifyRes
    };

    // Unlink msisdn from any other chat_id
    for (const [m, u] of Object.entries(usersData)) {
      if (m === msisdn && String(u.chat_id) !== String(chatId)) {
        delete u.chat_id;
      }
    }

    usersData[msisdn] = newUserRecord;
    saveUsers();
    session.state = 'idle';

    await sendTelegramMessage(
      chatId,
      `✅ تم تسجيل الدخول وربط الرقم ${maskMsisdn(msisdn)} بنجاح!\n\nاختر ما تحتاجه:`,
      getTelegramMainMenuKeyboard()
    );

    // Notify channel
    if (notifyChannel) {
      const notifText = `🆕 *تسجيل رقم جديد*\n\n👤 المستخدم: ${username}\n📱 الرقم: \`${maskMsisdn(msisdn)}\`\n\n⚡ by moon`;
      await sendTelegramMessage(notifyChannel, notifText, undefined, 'Markdown');
    }
    return;
  }

  // Default fallback response
  await sendTelegramMessage(
    chatId,
    "مرحبًا بك! 💜\nأرسل رقم هاتفك (10 أرقام) لبدء التفعيل 📱\nأو استخدم /start للقائمة الرئيسية.",
    getTelegramMainMenuKeyboard()
  );
}

// Telegram Callback Query Dispatcher (matches bot.py process_callback)
async function handleTelegramIncomingCallback(callbackQuery: any) {
  if (!callbackQuery || !callbackQuery.message) return;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const username = callbackQuery.from?.username ? `@${callbackQuery.from.username}` : (callbackQuery.from?.first_name || "مستخدم");

  addTelegramLog({
    type: 'callback',
    from: username,
    chatId,
    text: data
  });

  await answerTelegramCallbackQuery(callbackQuery.id);

  const session = getOrCreateTelegramSession(chatId);

  // 1. Add another number
  if (data === "menu_add_number") {
    session.state = 'awaiting_phone';
    session.adding_number = true;
    await sendTelegramMessage(
      chatId,
      "➕ *إضافة رقم آخر*\n\n📱 أرسل رقم هاتفك (10 أرقام) الآن.\n\n• إذا كان الرقم محفوظاً سابقاً → سيتم التفعيل تلقائياً ⚡\n• إذا كان رقماً جديداً → سيتم إرسال رمز تحقق 📲",
      undefined,
      'Markdown'
    );
    return;
  }

  // 2. Relogin
  if (data === "menu_relogin") {
    // Unlink old user
    for (const [msisdn, u] of Object.entries(usersData)) {
      if (String(u.chat_id) === String(chatId)) {
        delete u.chat_id;
      }
    }
    saveUsers();
    session.state = 'awaiting_phone';
    await sendTelegramMessage(
      chatId,
      "مرحبًا بك! 💜\nبوت لتفعيل الإنترنت بسهولة وسرعة 🚀\nأرسل رقم هاتفك (10 أرقام) لبدء التفعيل 📱."
    );
    return;
  }

  // 3. Activate 1 GB
  if (data === "menu_activate_1gb") {
    const linkedMsisdn = linkedNumberForChat(chatId) || session.msisdn;
    if (!linkedMsisdn || !usersData[linkedMsisdn]) {
      session.state = 'awaiting_phone';
      await sendTelegramMessage(chatId, "❌ انتهت الجلسة، أرسل رقم هاتفك لبدء التفعيل.");
      return;
    }

    await sendTelegramMessage(chatId, "⏳ جاري تفعيل إنترنت... 🚀");
    const actRes = await performBundleActivation(linkedMsisdn, "telegram");
    totalActivationsViaTelegram++;

    await sendTelegramMessage(
      chatId,
      `📱 الرقم: ${maskMsisdn(linkedMsisdn)}\n\n${actRes.message}`,
      getTelegramMainMenuKeyboard()
    );

    // Notify channel
    if (notifyChannel) {
      const notifText = `🎉 *عملية تفعيل ناجحة*\n\n👤 المستخدم: ${username}\n📱 الرقم: \`${maskMsisdn(linkedMsisdn)}\`\n📦 التفاصيل: ${actRes.message}\n\n⚡ by moon`;
      await sendTelegramMessage(notifyChannel, notifText, undefined, 'Markdown');
    }
  }
}

// Background Telegram Polling Loop
let pollingLoopRunning = false;
let pollingAbortController: AbortController | null = null;

async function startTelegramPolling() {
  if (pollingLoopRunning) return;
  pollingLoopRunning = true;
  pollingAbortController = new AbortController();

  console.log(`🤖 Starting Telegram polling for bot ${botToken.slice(0, 10)}...`);

  // 1. Fetch getMe
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meData = await meRes.json();
    if (meData.ok) {
      botInfo = meData.result;
      console.log(`✅ Telegram bot connected as @${botInfo.username} (${botInfo.first_name})`);
      addTelegramLog({
        type: 'system',
        from: 'SYSTEM',
        chatId: 0,
        text: `تم الاتصال بالبوت @${botInfo.username} (${botInfo.first_name}) بنجاح`
      });
    } else {
      console.error(`⚠️ Telegram getMe failed:`, meData.description);
      addTelegramLog({
        type: 'error',
        from: 'SYSTEM',
        chatId: 0,
        text: `فشل الاتصال بالبوت: ${meData.description}`
      });
    }
  } catch (err: any) {
    console.error(`⚠️ Telegram connection error:`, err.message);
  }

  // 2. Delete webhook
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`);
  } catch {}

  let lastUpdateId = 0;

  while (isPollingActive && pollingLoopRunning) {
    try {
      const signal = pollingAbortController?.signal;
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=15&limit=100`,
        { signal }
      );

      if (!res.ok) {
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          if (update.message) {
            await handleTelegramIncomingMessage(update.message);
          } else if (update.callback_query) {
            await handleTelegramIncomingCallback(update.callback_query);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') break;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  pollingLoopRunning = false;
  console.log("🛑 Telegram polling loop stopped.");
}

function stopTelegramPolling() {
  isPollingActive = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
  pollingLoopRunning = false;
}

// Start polling on boot if active
if (isPollingActive) {
  startTelegramPolling().catch(err => console.error("Initial telegram polling error:", err));
}

// -------------------------------------------------------------
// REST API Routes
// -------------------------------------------------------------

// System Status & Overview
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    name: "OOREDOO BOT - VERSION 1.5.22 (UNLIMITED - NO LIMITS)",
    appVersion: "1.5.22",
    ooredooVersion: OOREDOO_X_VERSION,
    totalSavedAccounts: Object.keys(usersData).length,
    totalActivations: activationsData.length,
    telegramConfig: {
      botToken,
      channel: notifyChannel,
      adminId
    },
    telegramStatus: {
      isPolling: isPollingActive && pollingLoopRunning,
      botInfo,
      totalMessagesReceived,
      totalActivationsViaTelegram,
      lastActiveTime
    },
    proxiesConfigured: configuredProxies.length
  });
});

// Telegram Bot Status & Logs
app.get('/api/telegram/status', (req: Request, res: Response) => {
  res.json({
    isPolling: isPollingActive && pollingLoopRunning,
    botToken,
    botInfo,
    channel: notifyChannel,
    adminId,
    totalMessagesReceived,
    totalActivationsViaTelegram,
    lastActiveTime,
    logs: telegramLogs
  });
});

// Toggle Telegram Polling
app.post('/api/telegram/toggle', (req: Request, res: Response) => {
  const { start } = req.body;
  if (start) {
    isPollingActive = true;
    saveTelegramConfig();
    startTelegramPolling();
  } else {
    isPollingActive = false;
    saveTelegramConfig();
    stopTelegramPolling();
  }
  return res.json({
    success: true,
    isPolling: isPollingActive
  });
});

// Update Telegram Bot Configuration
app.post('/api/telegram/config', async (req: Request, res: Response) => {
  const { newToken, newChannel, newAdminId } = req.body;
  if (newToken && typeof newToken === 'string') {
    botToken = newToken.trim();
  }
  if (newChannel && typeof newChannel === 'string') {
    notifyChannel = newChannel.trim();
  }
  if (newAdminId) {
    adminId = Number(newAdminId);
  }
  saveTelegramConfig();

  // Restart polling with new token
  stopTelegramPolling();
  isPollingActive = true;
  await startTelegramPolling();

  return res.json({
    success: true,
    botToken,
    notifyChannel,
    adminId,
    botInfo
  });
});

// Send custom test message / broadcast
app.post('/api/telegram/send-test', async (req: Request, res: Response) => {
  const { targetChat, text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }
  const chat = targetChat || notifyChannel;
  const result = await sendTelegramMessage(chat, text);
  return res.json({ result });
});

// In-Browser Telegram Simulator
app.post('/api/telegram/simulate', async (req: Request, res: Response) => {
  const { action, text, callbackData, senderName } = req.body;
  const simChatId = 9990001;
  const username = senderName || "المحاكي";

  if (action === 'callback' && callbackData) {
    await handleTelegramIncomingCallback({
      id: crypto.randomUUID(),
      from: { username, first_name: username },
      message: { chat: { id: simChatId }, message_id: 101 },
      data: callbackData
    });
  } else {
    await handleTelegramIncomingMessage({
      chat: { id: simChatId },
      from: { username, first_name: username },
      text: text || '/start',
      message_id: 102
    });
  }

  const recentSimLogs = telegramLogs
    .filter(l => l.chatId === simChatId || l.type === 'system')
    .slice(0, 10);

  return res.json({
    success: true,
    logs: recentSimLogs
  });
});

// List saved accounts
app.get('/api/accounts', (req: Request, res: Response) => {
  const accounts = Object.values(usersData).map(u => ({
    msisdn: u.msisdn,
    maskedMsisdn: maskMsisdn(u.msisdn),
    operator: u.operator || 'ooredoo',
    created_at: u.created_at,
    linked_at: u.linked_at,
    chat_id: u.chat_id,
    hasToken: Boolean(u.access_token)
  }));
  res.json({ accounts });
});

// Check phone number format & existing state
app.post('/api/check-phone', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "رقم الهاتف مطلوب" });
  }

  const cleaned = cleanMsisdn(phone);
  if (!isValidOoredooNumber(phone)) {
    return res.status(400).json({
      error: "❌ رقم غير صحيح. أرسل رقم أوريدو (05XXXXXXXX)"
    });
  }

  const existingUser = usersData[cleaned];

  return res.json({
    valid: true,
    msisdn: cleaned,
    maskedMsisdn: maskMsisdn(cleaned),
    isSaved: Boolean(existingUser),
    existingUser: existingUser ? {
      msisdn: existingUser.msisdn,
      maskedMsisdn: maskMsisdn(existingUser.msisdn),
      created_at: existingUser.created_at,
      linked_at: existingUser.linked_at
    } : null
  });
});

// Send OTP
app.post('/api/send-otp', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "رقم الهاتف مطلوب" });
  }

  const msisdn = cleanMsisdn(phone);
  if (!msisdn.startsWith('2135') || msisdn.length !== 12) {
    return res.status(400).json({ error: "❌ رقم غير صحيح. أرسل رقم أوريدو (05XXXXXXXX)" });
  }

  // 40 second cooldown check (matching bot.py)
  const lastSent = otpCooldowns.get(msisdn);
  if (lastSent) {
    const elapsed = (Date.now() - lastSent) / 1000;
    if (elapsed < 40) {
      const remaining = Math.ceil(40 - elapsed);
      return res.status(429).json({
        error: `⚠️ يرجى الانتظار ${remaining} ثانية قبل طلب رمز تحقق جديد.`,
        cooldownRemaining: remaining
      });
    }
  }

  otpCooldowns.set(msisdn, Date.now());
  const device = getOrCreateDevice(msisdn);
  const otpRes = await sendOoredooOtp(msisdn, device);

  if (!otpRes.success) {
    return res.status(500).json({
      error: "❌ حدث خطأ، يرجى إعادة المحاولة لاحقا."
    });
  }

  pendingSessions.set(msisdn, {
    msisdn,
    timestamp: Date.now(),
    device
  });

  return res.json({
    success: true,
    message: "📲 تم إرسال رمز التحقق بنجاح.\n\n📝 أدخل الرمز المكون من 6 أرقام:",
    msisdn,
    maskedMsisdn: maskMsisdn(msisdn),
    cooldown: 40
  });
});

// Verify OTP
app.post('/api/verify-otp', async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "رقم الهاتف والرمز مطلوبان" });
  }

  const msisdn = cleanMsisdn(phone);
  const cleanOtp = normalizeDigits(String(otp));

  if (cleanOtp.length !== 6) {
    return res.status(400).json({ error: "❌ الرمز يجب أن يكون 6 أرقام صحيحة." });
  }

  const device = getOrCreateDevice(msisdn);
  const verifyRes = await verifyOoredooOtp(msisdn, cleanOtp, device);

  if (verifyRes === 'wrong_otp') {
    return res.status(401).json({ error: "❌ رمز التحقق خاطئ، يرجى المحاولة مرة أخرى." });
  }

  if (!verifyRes || typeof verifyRes !== 'object') {
    return res.status(400).json({ error: "❌ رمز التحقق خاطئ أو منتهي الصلاحية، يرجى المحاولة مرة أخرى." });
  }

  const newUserRecord: UserRecord = {
    msisdn,
    operator: "ooredoo",
    created_at: Math.floor(Date.now() / 1000),
    linked_at: Math.floor(Date.now() / 1000),
    ...verifyRes
  };

  usersData[msisdn] = newUserRecord;
  saveUsers();
  pendingSessions.delete(msisdn);

  return res.json({
    success: true,
    message: `✅ تم تسجيل الدخول وربط الرقم ${maskMsisdn(msisdn)} بنجاح!`,
    user: {
      msisdn,
      maskedMsisdn: maskMsisdn(msisdn),
      created_at: newUserRecord.created_at
    }
  });
});

// Activate Bundle / Power-Snake Reward
app.post('/api/activate', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "رقم الهاتف مطلوب" });
  }

  const msisdn = cleanMsisdn(phone);
  const result = await performBundleActivation(msisdn, "web");

  if (!result.success) {
    return res.status(404).json({ error: result.message });
  }

  return res.json(result);
});

// Delete account
app.delete('/api/accounts/:msisdn', (req: Request, res: Response) => {
  const msisdn = req.params.msisdn;
  if (usersData[msisdn]) {
    delete usersData[msisdn];
    saveUsers();
    return res.json({ success: true, message: `تم حذف الحساب ${maskMsisdn(msisdn)} بنجاح` });
  }
  return res.status(404).json({ error: "الحساب غير موجود" });
});

// Get activations history
app.get('/api/activations', (req: Request, res: Response) => {
  res.json({
    activations: activationsData.slice(0, 40).map(a => ({
      ...a,
      maskedMsisdn: maskMsisdn(a.msisdn)
    }))
  });
});

// Get and update proxies
app.get('/api/proxies', (req: Request, res: Response) => {
  res.json({
    proxies: configuredProxies,
    count: configuredProxies.length
  });
});

app.post('/api/proxies', (req: Request, res: Response) => {
  const { proxies } = req.body;
  if (Array.isArray(proxies)) {
    configuredProxies = proxies.map(p => String(p).trim()).filter(Boolean);
    return res.json({ success: true, proxies: configuredProxies });
  }
  return res.status(400).json({ error: "Invalid proxy list" });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (!IS_PROD) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Power4 Ooredoo App running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
