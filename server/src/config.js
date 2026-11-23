import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const PORT = Number(process.env.PORT || 3000);
export const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'server/data');
export const DB_FILE = path.join(DATA_DIR, 'tickmark.db');
export const CLIENT_DIST = path.join(ROOT, 'client', 'dist');
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:tickmark@example.com';
export const ALERT_CHECK_SECONDS = Number(process.env.ALERT_CHECK_SECONDS || 30);

fs.mkdirSync(DATA_DIR, { recursive: true });
