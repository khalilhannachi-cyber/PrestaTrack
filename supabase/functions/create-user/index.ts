/**
 * Edge Function: create-user
 * Crée un utilisateur dans auth.users ET public.users de manière atomique
 * Utilise service_role pour bypasser les RLS et éviter les conflits avec AuthContext
 * Déployement: supabase functions deploy create-user --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// En-têtes CORS pour permettre les appels depuis le frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gestion des requêtes CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📝 Début de la fonction create-user')
    
    // Client Supabase avec privilèges admin (service_role)
    // ⚠️ IMPORTANT: Bypass tous les RLS, ne jamais exposer cette clé au frontend
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    console.log('✅ Client admin créé')

    // Extraction des données de la requête
    const { email, password, full_name, role_id } = await req.json()

    // Validation des champs requis
    if (!email || !password || !full_name || !role_id) {
      return new Response(
        JSON.stringify({ error: 'Tous les champs sont requis' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Format d\'email invalide' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation longueur mot de passe
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Le mot de passe doit contenir au moins 6 caractères' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📝 Création de l\'utilisateur:', email)

    // Création dans auth.users avec auth.admin.createUser()
    // email_confirm: true pour confirmation automatique (pas de lien par email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name
      }
    })

    if (authError) {
      console.error('❌ Erreur Auth:', authError)
      throw authError
    }

    if (!authData.user) {
      throw new Error('Aucun utilisateur créé')
    }

    console.log('✅ Utilisateur créé dans Auth:', authData.user.id)

    // Insertion dans public.users avec le même ID pour maintenir la cohérence
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        role_id: role_id,
        is_active: true
      })

    // Si l'insertion échoue, supprimer l'utilisateur Auth (rollback manuel)
    if (insertError) {
      console.error('❌ Erreur insertion users:', insertError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw insertError
    }

    console.log('✅ Utilisateur inséré dans la table users')

    // Retour de la réponse de succès
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: email,
          full_name: full_name
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Erreur globale:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création de l\'utilisateur'
    
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
