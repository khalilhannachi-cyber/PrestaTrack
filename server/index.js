require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Configuration Supabase avec Service Role (pour bypasser RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Helpers ---
function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function formatDateFr(isoValue) {
  try {
    return new Date(isoValue).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return String(isoValue || '');
  }
}

// --- SMTP ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseBool(process.env.SMTP_SECURE, false),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --- State Management (Anti-Spam) ---
const CACHE_DIR = path.join(__dirname, '.cache');
const STATE_FILE = path.join(CACHE_DIR, 'notifier-state.json');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

let state = {
  lastProcessedAt: new Date().toISOString(),
  processedIds: []
};

if (fs.existsSync(STATE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = {
      lastProcessedAt: data.lastProcessedAt || state.lastProcessedAt,
      processedIds: data.processedIds || []
    };
  } catch (e) {
    console.error('Erreur chargement etat:', e.message);
  }
}

function saveState() {
  state.processedIds = state.processedIds.slice(-2000); // Garder les 2000 derniers
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Email Templates ---
function buildEmailHtml(userName, message, type, date) {
  const isAlert = type === 'DOSSIER_BLOQUE';
  const title = isAlert ? '⚠️ ALERTE : DOSSIER BLOQUÉ' : 'Nouvelle Notification';
  const color = isAlert ? '#dc2626' : '#1e3a8a';
  const bgColor = isAlert ? '#fef2f2' : '#f0f9ff';

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: ${color}; margin: 0; font-size: 20px; font-weight: bold;">${title}</h2>
      </div>
      
      <p style="font-size: 16px; margin-bottom: 16px;">Bonjour <strong>${userName || 'Collaborateur'}</strong>,</p>
      
      <div style="background-color: ${bgColor}; border-left: 4px solid ${color}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 16px; color: ${isAlert ? '#991b1b' : '#1e40af'};">
          ${message}
        </p>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">
        Notification générée le : ${formatDateFr(date)}
      </p>

      <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f3f4f6;">
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">
          Veuillez vous connecter à votre interface <strong>PrestaTrack</strong> pour plus de détails.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          Ceci est un email automatique de votre système de gestion de dossiers.
        </p>
      </div>
    </div>
  `;
}

// --- Main Polling Function ---
async function checkNotifications() {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, user_id, message, type, created_at, users ( email, full_name )')
      .gte('created_at', state.lastProcessedAt)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    if (!notifications || notifications.length === 0) return;

    let maxDate = state.lastProcessedAt;

    for (const notif of notifications) {
      if (notif.created_at > maxDate) maxDate = notif.created_at;
      if (state.processedIds.includes(notif.id)) continue;

      const user = Array.isArray(notif.users) ? notif.users[0] : notif.users;
      const email = user?.email;

      if (email && email.includes('@')) {
        console.log(`[${new Date().toISOString()}] Envoi email à ${email}...`);
        
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: `[PrestaTrack] ${notif.type === 'DOSSIER_BLOQUE' ? '⚠️ Dossier Bloqué' : 'Notification'}`,
          html: buildEmailHtml(user.full_name, notif.message, notif.type, notif.created_at)
        });

        console.log(`[OK] Email envoyé avec succès.`);
      }

      state.processedIds.push(notif.id);
    }

    state.lastProcessedAt = maxDate;
    saveState();
  } catch (err) {
    console.error('Erreur lors du traitement:', err.message);
  }
}

// --- Start Loop ---
const pollInterval = parseInt(process.env.EMAIL_NOTIFIER_POLL_MS || '30000');
console.log(`\n🚀 Serveur de notifications PrestaTrack démarré`);
console.log(`   Polling : ${pollInterval}ms`);
console.log(`   SMTP User : ${process.env.SMTP_USER}\n`);

setInterval(checkNotifications, pollInterval);
checkNotifications();
