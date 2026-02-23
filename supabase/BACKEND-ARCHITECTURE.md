# 🏗️ Architecture Backend - PrestaTrack

## 📍 Où se trouve le Backend?

Le backend de PrestaTrack est entièrement basé sur **Supabase** (Backend-as-a-Service).

```
PrestaTrack/
├── supabase/                    ← 🎯 TOUT LE BACKEND EST ICI
│   ├── functions/               ← Edge Functions (serverless)
│   │   ├── create-user/         ← Fonction de création d'utilisateurs
│   │   │   └── index.ts         ← Code de la Edge Function
│   │   ├── deno.json            ← Configuration Deno
│   │   └── README.md            ← Doc de déploiement
│   └── .temp/                   ← Fichiers temporaires CLI
├── src/                         ← Frontend React
└── setup-roles.sql              ← Script SQL pour initialiser les rôles
```

## 🧩 Composants du Backend

### 1. **Base de Données PostgreSQL** 📊

Hébergée sur Supabase Cloud, accessible via l'URL du projet.

#### Tables principales:

```sql
-- Gestion des rôles
roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE,
  description TEXT
)

-- Utilisateurs de l'application (données métier)
users (
  id UUID PRIMARY KEY,              -- Même ID que auth.users
  email VARCHAR UNIQUE,
  full_name VARCHAR,
  role_id INTEGER → roles(id),      -- FK: admin, rc, prestation, qualite
  agence_id INTEGER → agences(id),  -- FK: agence de rattachement
  is_active BOOLEAN,
  created_at TIMESTAMP
)

-- Agences
agences (
  id SERIAL PRIMARY KEY,
  nom VARCHAR,
  adresse TEXT,
  telephone VARCHAR,
  created_at TIMESTAMP
)

-- Dossiers
dossiers (
  id SERIAL PRIMARY KEY,
  numero_dossier VARCHAR UNIQUE,
  date_reception DATE,
  statut VARCHAR,                   -- 'En RC', 'En Prestation', 'En Qualité', 'Terminé'
  type_prestation VARCHAR,
  courtier VARCHAR,
  assure_nom VARCHAR,
  assure_contact VARCHAR,
  vehicule_marque VARCHAR,
  vehicule_matricule VARCHAR,
  date_sinistre DATE,
  date_premier_contact DATE,
  lieu VARCHAR,
  degats TEXT,
  created_by UUID → users(id),      -- FK: créateur du dossier
  assigned_to UUID → users(id),     -- FK: utilisateur assigné
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### Sécurité: Row Level Security (RLS)

Chaque table a des policies RLS pour contrôler l'accès:

```sql
-- Exemple: Les utilisateurs ne peuvent voir que leurs propres dossiers
-- sauf les admins qui voient tout
CREATE POLICY "users_read_own_dossiers" ON dossiers
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR 
    auth.uid() IN (SELECT id FROM users WHERE role_id = 1) -- admin
  );
```

### 2. **Supabase Auth** 🔐

Système d'authentification intégré avec JWT.

#### Table: `auth.users`

Gérée automatiquement par Supabase:

```sql
auth.users (
  id UUID PRIMARY KEY,              -- ID unique de l'utilisateur
  email VARCHAR UNIQUE,
  encrypted_password VARCHAR,       -- Hash du mot de passe
  email_confirmed_at TIMESTAMP,
  user_metadata JSONB,              -- { "full_name": "..." }
  created_at TIMESTAMP
)
```

#### Flux d'authentification:

1. **Login**: `supabase.auth.signInWithPassword({ email, password })`
2. **JWT Token**: Supabase retourne un JWT (JSON Web Token)
3. **Vérification**: Le JWT est vérifié automatiquement par les RLS policies
4. **Session**: Le token est stocké dans localStorage côté client
5. **Expiration**: Le token expire après 1 heure, refresh automatique

### 3. **PostgREST API** 🌐

API REST auto-générée à partir du schéma PostgreSQL.

#### Exemple d'endpoints générés automatiquement:

```
GET    /rest/v1/users             → Liste tous les utilisateurs
GET    /rest/v1/users?id=eq.123   → Filtre par ID
POST   /rest/v1/users             → Créer un utilisateur
PATCH  /rest/v1/users?id=eq.123   → Mettre à jour
DELETE /rest/v1/users?id=eq.123   → Supprimer
```

#### Utilisation depuis le frontend:

```javascript
// Liste des dossiers
const { data, error } = await supabase
  .from('dossiers')
  .select('*, users(full_name)')  // JOIN automatique
  .eq('statut', 'En RC')
  .order('created_at', { ascending: false })
```

Pas besoin d'écrire des controllers ou des routes manuellement!

### 4. **Edge Functions** ⚡

Fonctions serverless hébergées sur Supabase (runtime Deno).

#### Fonction disponible: `create-user`

**Emplacement**: `supabase/functions/create-user/index.ts`

**But**: Créer un utilisateur de manière atomique dans `auth.users` ET `public.users`.

**Pourquoi une Edge Function?**
- Évite les conflits avec `AuthContext.onAuthStateChange`
- Utilise les privilèges admin (`service_role`)
- Confirmation automatique de l'email
- Rollback automatique en cas d'erreur

**Appel depuis le frontend**:

```javascript
const { data, error } = await supabase.functions.invoke('create-user', {
  body: {
    email: 'user@comar.tn',
    password: 'temp123',
    full_name: 'John Doe',
    role_id: 2  // RC
  }
})
```

**Déploiement**:

```bash
supabase functions deploy create-user --no-verify-jwt
```

Le flag `--no-verify-jwt` désactive la vérification JWT automatique car la fonction utilise déjà `service_role`.

### 5. **Storage** (Futur) 📁

Supabase propose aussi du stockage de fichiers (S3-compatible):

```javascript
// Upload d'un fichier
const { data, error } = await supabase.storage
  .from('dossiers-documents')
  .upload('dossier-123/photo.jpg', file)
```

**Note**: Pas encore implémenté dans PrestaTrack, mais disponible si besoin.

## 🔑 Variables d'Environnement

### Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Ces clés sont utilisées dans `src/lib/supabaseClient.js`.

### Edge Functions (Auto-injectées)

```
SUPABASE_URL              ← URL du projet
SUPABASE_SERVICE_ROLE_KEY ← Clé admin (⚠️ très sensible)
SUPABASE_ANON_KEY         ← Clé publique (optionnelle)
```

Ces variables sont disponibles automatiquement dans les Edge Functions via `Deno.env.get()`.

## 🔄 Flux de Données Complet

### Exemple: Création d'un utilisateur

```
┌──────────────┐
│  Frontend    │
│  NewUser.jsx │
└──────┬───────┘
       │ supabase.functions.invoke('create-user', { body: {...} })
       ▼
┌─────────────────────────────────────────────┐
│  Edge Function (Deno)                       │
│  supabase/functions/create-user/index.ts    │
│                                             │
│  1. Validation des données                  │
│  2. Création dans auth.users (admin API)    │
│  3. Insertion dans public.users             │
│  4. Rollback si erreur                      │
└──────┬──────────────────────────────────────┘
       │ { success: true, user: {...} }
       ▼
┌──────────────┐
│  Supabase    │
│              │
│  ┌────────┐  │   ┌──────────┐
│  │auth.   │  │   │public.   │
│  │users   │◄─┼───┤users     │
│  └────────┘  │   └──────────┘
│              │
└──────────────┘
       │
       ▼
┌──────────────┐
│  Frontend    │
│  Affiche     │
│  fiche PDF   │
└──────────────┘
```

### Exemple: Récupération des dossiers

```
┌──────────────┐
│  Frontend    │
│  DossiersList│
└──────┬───────┘
       │ supabase.from('dossiers').select()
       ▼
┌─────────────────────┐
│  PostgREST API      │
│  (Auto-généré)      │
│                     │
│  1. Vérifie JWT     │
│  2. Applique RLS    │
│  3. Execute SQL     │
└──────┬──────────────┘
       │
       ▼
┌──────────────┐
│  PostgreSQL  │
│  Database    │
└──────┬───────┘
       │ [ { id: 1, ... }, { id: 2, ... } ]
       ▼
┌──────────────┐
│  Frontend    │
│  Affiche     │
│  la liste    │
└──────────────┘
```

## 🛠️ Technologies Backend

| Composant | Technologie | Description |
|-----------|-------------|-------------|
| **Base de données** | PostgreSQL 15 | Base relationnelle avec RLS |
| **API REST** | PostgREST | Auto-générée depuis le schéma |
| **Auth** | Supabase Auth | JWT + Sessions |
| **Functions** | Deno + TypeScript | Runtime serverless |
| **Hosting** | Supabase Cloud | Hébergement géré |
| **CLI** | Supabase CLI | Déploiement et gestion |

## 🆚 Comparaison avec une architecture classique

### Architecture Classique (Node.js + Express)

```
Frontend → Express API → PostgreSQL
           ↓
           Controllers
           Routes
           Middlewares
           Auth JWT custom
           ORM (Prisma/Sequelize)
```

**Avantages**: Contrôle total, flexibilité maximale  
**Inconvénients**: Plus de code à écrire, maintenance, déploiement complexe

### Architecture PrestaTrack (Supabase)

```
Frontend → PostgREST API (auto) → PostgreSQL
           ↓
           RLS Policies
           Supabase Auth (géré)
           Edge Functions (si besoin)
```

**Avantages**: Développement rapide, sécurité intégrée, scaling automatique  
**Inconvénients**: Moins de contrôle, dépendance à Supabase

## 🔐 Sécurité

### Niveaux de sécurité:

1. **JWT Verification**: Tous les requêtes vérifient le JWT
2. **Row Level Security**: Chaque table a des policies RLS
3. **Service Role**: Utilisé uniquement côté serveur (Edge Functions)
4. **HTTPS**: Toutes les communications sont chiffrées
5. **Variables d'environnement**: Clés sensibles jamais exposées au frontend

### Clés Supabase:

- **ANON_KEY** (`VITE_SUPABASE_ANON_KEY`):
  - ✅ Peut être exposée au frontend
  - ✅ Respect les RLS policies
  - ❌ Ne peut pas bypass la sécurité

- **SERVICE_ROLE_KEY** (`SUPABASE_SERVICE_ROLE_KEY`):
  - ❌ NE JAMAIS exposer au frontend
  - ⚠️ Bypass TOUS les RLS
  - ✅ Utilisée uniquement dans les Edge Functions

## 📚 Ressources Utiles

- **Supabase Dashboard**: https://app.supabase.com
- **Documentation Supabase**: https://supabase.com/docs
- **PostgREST Docs**: https://postgrest.org
- **Deno Docs** (Edge Functions): https://deno.land/manual

## 🚀 Commandes Utiles

```bash
# Lier le projet
supabase link --project-ref <PROJECT_REF>

# Déployer une Edge Function
supabase functions deploy create-user --no-verify-jwt

# Voir les logs d'une fonction
supabase functions logs create-user --tail

# Voir les secrets configurés
supabase secrets list

# Configurer un secret
supabase secrets set MY_SECRET=value
```

## 📝 Notes Importantes

1. **Pas de Node.js backend**: Le projet n'utilise PAS Express/Fastify/Node.js pour le backend
2. **Vite utilise Node.js**: Uniquement pour le dev server frontend (localhost:5198)
3. **Deno pour les Edge Functions**: Runtime différent de Node.js, mais très similaire
4. **RLS est crucial**: Toute la sécurité des données repose sur les policies RLS
5. **Pas de serveur à gérer**: Supabase gère tout l'infrastructure backend

## 🆕 Ajouter une nouvelle Edge Function

```bash
# Créer une nouvelle fonction
supabase functions new ma-fonction

# Éditer le fichier
# supabase/functions/ma-fonction/index.ts

# Déployer
supabase functions deploy ma-fonction
```

## 🔄 Migration vers Node.js/Express (si nécessaire)

Si un jour le projet a besoin d'un backend custom Node.js:

### Architecture Hybride Possible:

```
Frontend → Express API (logique custom) → Supabase (DB + Auth)
           ↓
           Utilise supabase-js côté serveur
           Vérifie les JWT Supabase
           Complète les Edge Functions
```

Exemple:

```javascript
// server.js (Express)
import express from 'express'
import { createClient } from '@supabase/supabase-js'

const app = express()
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app.post('/api/complex-operation', async (req, res) => {
  // Logique complexe qui nécessite plusieurs tables
  // Ou intégrations avec APIs externes
  // Ou traitements lourds
})
```

**Mais pour PrestaTrack actuellement, Supabase seul suffit amplement!**

---

**Dernière mise à jour**: Février 2026  
**Auteur**: Équipe PrestaTrack
