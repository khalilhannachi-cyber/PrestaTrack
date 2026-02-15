# 🧪 Guide de Tests Manuels - PrestaTrack

## 📋 Prérequis

1. **Supabase configuré** avec :
   - Un utilisateur créé dans Auth
   - Une table `users` avec une colonne `role`
   - Une entrée dans `users` correspondant à l'ID de l'utilisateur Auth

2. **Variables d'environnement** dans `.env` :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Console du navigateur ouverte** (F12) pour voir les logs de debug

---

## ✅ Test 1 : Chargement Initial de l'App

### Étapes :
1. Ouvrir http://localhost:5173
2. Observer la console

### Logs attendus :
```
🔍 [AuthContext] Vérification de la session...
📝 [AuthContext] Session récupérée: Pas de session
✅ [AuthContext] Vérification terminée
```

### Résultat attendu :
- Redirection automatique vers `/login`
- Formulaire de connexion affiché

---

## ✅ Test 2 : Login avec Identifiants Invalides

### Étapes :
1. Sur `/login`, entrer un email invalide (ex: `test@test.com`)
2. Mot de passe : `wrongpassword`
3. Cliquer sur "Se connecter"
4. Observer la console

### Logs attendus :
```
📝 [Login] Soumission du formulaire
✅ [Login] Validation réussie, tentative de connexion...
🔑 [AuthContext] Tentative de connexion pour: test@test.com
❌ [AuthContext] Échec de connexion: Invalid login credentials
❌ [Login] Erreur: Invalid login credentials
```

### Résultat attendu :
- Message d'erreur rouge affiché : "Invalid login credentials"
- Aucune redirection
- Champs du formulaire toujours remplis

---

## ✅ Test 3 : Login Réussi

### Étapes :
1. Entrer un email valide (ex: `admin@prestatrack.com`)
2. Entrer le bon mot de passe
3. Cliquer sur "Se connecter"
4. Observer la console

### Logs attendus :
```
📝 [Login] Soumission du formulaire
✅ [Login] Validation réussie, tentative de connexion...
🔑 [AuthContext] Tentative de connexion pour: admin@prestatrack.com
✅ [AuthContext] Connexion réussie
👤 [AuthContext] Utilisateur connecté: admin@prestatrack.com
🔍 [AuthContext] Récupération du rôle pour: [uuid]
✅ [AuthContext] Rôle récupéré: Admin
🎉 [Login] Connexion réussie ! Redirection dans 1s...
🔀 [Login] Redirection vers /dashboard
```

### Résultat attendu :
1. Message vert affiché : "Connexion réussie ! Redirection..."
2. Spinner sur le bouton
3. Après 1 seconde → redirection vers `/dashboard`

---

## ✅ Test 4 : Affichage du Dashboard selon le Rôle

### Étapes :
1. Après le login réussi, observer le dashboard
2. Observer la console

### Logs attendus :
```
🛡️ [ProtectedRoute] État: { loading: false, authenticated: true }
✅ [ProtectedRoute] Accès autorisé
📊 [Dashboard] Rendu avec: { email: 'admin@prestatrack.com', role: 'Admin' }
```

### Résultat attendu selon le rôle :

| Rôle | Titre affiché | Icône |
|------|---------------|-------|
| **RC** | Espace Responsable Commercial | 💼 |
| **Finance** | Espace Finance | 💰 |
| **Admin** | Espace Administrateur | ⚙️ |

- Email de l'utilisateur visible
- Rôle affiché

---

## ✅ Test 5 : Protection des Routes (Non Connecté)

### Étapes :
1. Déconnectez-vous (ou ouvrez en navigation privée)
2. Tentez d'accéder directement à http://localhost:5173/dashboard
3. Observer la console

### Logs attendus :
```
🔍 [AuthContext] Vérification de la session...
📝 [AuthContext] Session récupérée: Pas de session
✅ [AuthContext] Vérification terminée
🛡️ [ProtectedRoute] État: { loading: false, authenticated: false }
🚫 [ProtectedRoute] Non authentifié, redirection vers /login
```

### Résultat attendu :
- Redirection immédiate vers `/login`
- Impossible d'accéder au dashboard sans authentification

---

## ✅ Test 6 : Déconnexion

### Étapes :
1. Depuis le dashboard, cliquer sur "Se déconnecter"
2. Observer la console

### Logs attendus :
```
🚪 [Dashboard] Déconnexion demandée
🚪 [AuthContext] Déconnexion en cours...
✅ [AuthContext] Déconnexion réussie
🔀 [Dashboard] Redirection vers /login
```

### Résultat attendu :
- Retour immédiat à la page `/login`
- Si on tente d'accéder à `/dashboard`, redirection vers `/login`

---

## ✅ Test 7 : Validation des Champs (Frontend)

### Étapes :
1. Sur `/login`, tester les cas suivants :

#### Cas 1 : Email vide
- Email : (vide)
- Password : `test123`
- **Attendu** : Erreur "L'email est requis"

#### Cas 2 : Email invalide
- Email : `notemail`
- Password : `test123`
- **Attendu** : Erreur "Email invalide"

#### Cas 3 : Mot de passe trop court
- Email : `test@test.com`
- Password : `12345` (5 caractères)
- **Attendu** : Erreur "6 caractères minimum"

### Logs attendus :
```
📝 [Login] Soumission du formulaire
⚠️ [Login] Erreurs de validation: { email: 'L'email est requis' }
```

---

## ✅ Test 8 : Persistance de la Session

### Étapes :
1. Connectez-vous
2. Rafraîchissez la page (F5) sur `/dashboard`
3. Observer la console

### Logs attendus :
```
🔍 [AuthContext] Vérification de la session...
📝 [AuthContext] Session récupérée: Utilisateur connecté
👤 [AuthContext] Utilisateur: admin@prestatrack.com
🔍 [AuthContext] Récupération du rôle pour: [uuid]
✅ [AuthContext] Rôle récupéré: Admin
✅ [AuthContext] Vérification terminée
```

### Résultat attendu :
- Pas de redirection vers login
- Dashboard toujours affiché avec les mêmes infos
- Session maintenue

---

## 🐛 Problèmes Courants

### Erreur : "Failed to fetch user role"
**Cause** : Table `users` inexistante ou ligne manquante  
**Solution** :
```sql
-- Créer la table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('RC', 'Finance', 'Admin'))
);

-- Insérer un utilisateur
INSERT INTO users (id, role) 
VALUES ('[ID_UTILISATEUR_AUTH]', 'Admin');
```

### Erreur : "Invalid login credentials"
**Cause** : Email/password incorrects ou utilisateur n'existe pas  
**Solution** : Créer un utilisateur dans **Supabase Dashboard → Authentication → Users**

### Redirection infinie
**Cause** : AuthContext ne détecte pas l'utilisateur  
**Solution** : Vérifier les logs console et la session Supabase

---

## 📝 Checklist Complète

- [ ] Chargement initial redirige vers `/login`
- [ ] Validation frontend fonctionne (email, password)
- [ ] Login avec mauvais identifiants affiche une erreur
- [ ] Login réussi affiche le message de succès
- [ ] Redirection vers `/dashboard` après 1 seconde
- [ ] Dashboard affiche le bon rôle et l'email
- [ ] Route `/dashboard` protégée (redirection si non connecté)
- [ ] Déconnexion redirige vers `/login`
- [ ] Session persistante après F5
- [ ] Logs de debug visibles dans la console

---

## 🎯 Pour Supprimer les Logs en Production

Chercher et supprimer tous les `console.log` contenant :
- `[AuthContext]`
- `[Login]`
- `[ProtectedRoute]`
- `[Dashboard]`

Ou utiliser un outil comme `vite-plugin-remove-console` pour les retirer automatiquement.
