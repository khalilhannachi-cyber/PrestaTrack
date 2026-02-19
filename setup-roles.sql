-- ============================================================================
-- CONFIGURATION DES POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- PrestaTrack - Système de gestion des dossiers d'assurance
-- ============================================================================
-- 
-- Ce fichier configure les politiques RLS pour protéger les données
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- 
-- IMPORTANT : Les politiques RLS doivent être configurées pour chaque table
-- afin d'autoriser les opérations CRUD selon les rôles des utilisateurs
-- ============================================================================

-- ============================================================================
-- AJOUT DE COLONNES MANQUANTES (si nécessaire)
-- ============================================================================

-- Ajouter la colonne is_urgent à la table dossiers si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'is_urgent'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN is_urgent BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN dossiers.is_urgent IS 'Indique si le dossier est urgent';
  END IF;
END $$;

-- Ajouter la colonne adresse à la table agences si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agences' AND column_name = 'adresse'
  ) THEN
    ALTER TABLE agences ADD COLUMN adresse TEXT;
    COMMENT ON COLUMN agences.adresse IS 'Adresse de l''agence';
  END IF;
END $$;

-- ============================================================================
-- NETTOYAGE : Suppression des politiques existantes
-- ============================================================================

DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir tous les dossiers" ON dossiers;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent créer des dossiers" ON dossiers;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent modifier les dossiers" ON dossiers;
DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer leurs propres dossiers" ON dossiers;

DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir tous les détails RC" ON dossier_details_rc;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent créer des détails RC" ON dossier_details_rc;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent modifier les détails RC" ON dossier_details_rc;
DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer les détails RC" ON dossier_details_rc;

DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir l'historique" ON historique_actions;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent ajouter à l'historique" ON historique_actions;

DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir les agences" ON agences;
DROP POLICY IF EXISTS "Les admins peuvent créer des agences" ON agences;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent créer des agences" ON agences;
DROP POLICY IF EXISTS "Les admins peuvent supprimer des agences" ON agences;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent supprimer des agences" ON agences;

DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir les utilisateurs" ON users;
DROP POLICY IF EXISTS "Les admins peuvent créer des utilisateurs" ON users;
DROP POLICY IF EXISTS "Les admins peuvent modifier les utilisateurs" ON users;

DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir les rôles" ON roles;


-- ============================================================================
-- TABLE: dossiers
-- Description: Dossiers principaux créés par les utilisateurs
-- ============================================================================

-- Activer RLS sur la table dossiers
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Les utilisateurs peuvent voir tous les dossiers
CREATE POLICY "Les utilisateurs authentifiés peuvent voir tous les dossiers"
ON dossiers FOR SELECT
TO authenticated
USING (true);

-- Politique INSERT : Les utilisateurs authentifiés peuvent créer des dossiers
CREATE POLICY "Les utilisateurs authentifiés peuvent créer des dossiers"
ON dossiers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Politique UPDATE : Les utilisateurs peuvent modifier tous les dossiers
CREATE POLICY "Les utilisateurs authentifiés peuvent modifier les dossiers"
ON dossiers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Politique DELETE : Les utilisateurs peuvent supprimer leurs propres dossiers
CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres dossiers"
ON dossiers FOR DELETE
TO authenticated
USING (auth.uid() = created_by);


-- ============================================================================
-- TABLE: dossier_details_rc
-- Description: Détails spécifiques au service Relation Client
-- ============================================================================

-- Activer RLS sur la table dossier_details_rc
ALTER TABLE dossier_details_rc ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Les utilisateurs peuvent voir tous les détails
CREATE POLICY "Les utilisateurs authentifiés peuvent voir tous les détails RC"
ON dossier_details_rc FOR SELECT
TO authenticated
USING (true);

-- Politique INSERT : Les utilisateurs authentifiés peuvent insérer des détails
CREATE POLICY "Les utilisateurs authentifiés peuvent créer des détails RC"
ON dossier_details_rc FOR INSERT
TO authenticated
WITH CHECK (true);

-- Politique UPDATE : Les utilisateurs peuvent modifier tous les détails
CREATE POLICY "Les utilisateurs authentifiés peuvent modifier les détails RC"
ON dossier_details_rc FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Politique DELETE : Les utilisateurs peuvent supprimer des détails
CREATE POLICY "Les utilisateurs peuvent supprimer les détails RC"
ON dossier_details_rc FOR DELETE
TO authenticated
USING (true);


-- ============================================================================
-- TABLE: historique_actions
-- Description: Historique des actions effectuées sur les dossiers
-- ============================================================================

-- Activer RLS sur la table historique_actions
ALTER TABLE historique_actions ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Les utilisateurs peuvent voir tout l'historique
CREATE POLICY "Les utilisateurs authentifiés peuvent voir l'historique"
ON historique_actions FOR SELECT
TO authenticated
USING (true);

-- Politique INSERT : Les utilisateurs authentifiés peuvent ajouter à l'historique
CREATE POLICY "Les utilisateurs authentifiés peuvent ajouter à l'historique"
ON historique_actions FOR INSERT
TO authenticated
WITH CHECK (true);

-- Pas de UPDATE ni DELETE sur l'historique (immutabilité)


-- ============================================================================
-- TABLE: agences
-- Description: Liste des agences d'assurance
-- ============================================================================

-- Activer RLS sur la table agences
ALTER TABLE agences ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Les utilisateurs peuvent voir toutes les agences
CREATE POLICY "Les utilisateurs authentifiés peuvent voir les agences"
ON agences FOR SELECT
TO authenticated
USING (true);

-- Politique INSERT : Tous les utilisateurs authentifiés peuvent créer des agences
-- (Vous pouvez restreindre cela aux admins plus tard)
CREATE POLICY "Les utilisateurs authentifiés peuvent créer des agences"
ON agences FOR INSERT
TO authenticated
WITH CHECK (true);

-- Politique DELETE : Tous les utilisateurs authentifiés peuvent supprimer des agences
-- (Vous pouvez restreindre cela aux admins plus tard)
CREATE POLICY "Les utilisateurs authentifiés peuvent supprimer des agences"
ON agences FOR DELETE
TO authenticated
USING (true);


-- ============================================================================
-- TABLE: users
-- Description: Utilisateurs de l'application
-- ⚠️ IMPORTANT : RLS DÉSACTIVÉ pour éviter les problèmes de connexion
-- ============================================================================

-- DÉSACTIVER RLS sur la table users pour le moment
-- Cette table contient les métadonnées critiques pour l'authentification
-- et doit être accessible pour vérifier les rôles lors de la connexion
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Vous pouvez activer RLS plus tard avec des politiques appropriées :
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Tout le monde peut voir les users" ON users 
-- FOR SELECT TO authenticated USING (true);
-- 
-- CREATE POLICY "Les admins peuvent modifier les users" ON users 
-- FOR ALL TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM users u 
--     INNER JOIN roles r ON u.role_id = r.id
--     WHERE u.id = auth.uid() AND r.name = 'ADMIN'
--   )
-- );


-- ============================================================================
-- TABLE: roles
-- Description: Rôles des utilisateurs (ADMIN, RELATION_CLIENT, etc.)
-- ============================================================================

-- Activer RLS sur la table roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Les utilisateurs peuvent voir tous les rôles
CREATE POLICY "Les utilisateurs authentifiés peuvent voir les rôles"
ON roles FOR SELECT
TO authenticated
USING (true);

-- Les rôles sont généralement créés manuellement et ne doivent pas être modifiés
-- Pas de politique INSERT/UPDATE/DELETE


-- ============================================================================
-- VÉRIFICATION DES POLITIQUES
-- ============================================================================
-- 
-- Pour vérifier que les politiques sont bien créées, exécutez :
-- 
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- 
-- ============================================================================
