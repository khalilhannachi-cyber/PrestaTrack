# Déploiement de l'Edge Function `create-user`

## 📋 Prérequis

1. Installer Supabase CLI :
```bash
npm install -g supabase
```

2. Se connecter à Supabase :
```bash
supabase login
```

## 🚀 Déploiement

### Étape 1 : Lier votre projet Supabase

```bash
# Depuis la racine du projet PrestaTrack
supabase link --project-ref <VOTRE_PROJECT_REF>
```

Trouvez votre `project-ref` dans le dashboard Supabase : Settings > General > Reference ID

### Étape 2 : Déployer la fonction

```bash
supabase functions deploy create-user
```

### Étape 3 : Vérifier le déploiement

1. Allez sur votre **Supabase Dashboard** → **Edge Functions**
2. Vous devriez voir `create-user` dans la liste
3. Cliquez dessus pour voir les logs

## 🔐 Variables d'environnement

Les variables suivantes sont automatiquement disponibles :
- `SUPABASE_URL` - URL de votre projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clé service_role (admin)

Ces variables sont configurées automatiquement par Supabase.

## 🧪 Tester la fonction

Depuis votre dashboard Supabase ou avec curl :

```bash
curl -i --location --request POST 'https://<PROJECT_REF>.supabase.co/functions/v1/create-user' \
  --header 'Authorization: Bearer <ANON_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","password":"test123","full_name":"Test User","role_id":"<ROLE_UUID>"}'
```

## ✅ Avantages

- ✅ Pas de limite d'emails de confirmation
- ✅ Confirmation automatique de l'email
- ✅ Utilisation de la clé admin (service_role)
- ✅ Gestion d'erreurs et rollback automatique
- ✅ CORS configuré pour l'app React

## 🐛 Debug

Pour voir les logs en temps réel :

```bash
supabase functions logs create-user --tail
```
