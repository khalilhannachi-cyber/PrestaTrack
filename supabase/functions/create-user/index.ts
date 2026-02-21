import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📝 Début de la fonction create-user')
    
    // Créer un client Supabase avec la clé service_role (admin)
    // pour créer le nouvel utilisateur
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

    // Récupérer les données de la requête
    const { email, password, full_name, role_id } = await req.json()

    // Validation des champs
    if (!email || !password || !full_name || !role_id) {
      return new Response(
        JSON.stringify({ error: 'Tous les champs sont requis' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validation email format
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

    // Validation mot de passe
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

    // Créer l'utilisateur dans auth.users avec la clé admin (pas de limite d'emails)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmer automatiquement l'email
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

    // Insérer dans la table public.users
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        role_id: role_id,
        is_active: true
      })

    if (insertError) {
      console.error('❌ Erreur insertion users:', insertError)
      
      // Supprimer l'utilisateur Auth si l'insertion dans users échoue
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      
      throw insertError
    }

    console.log('✅ Utilisateur inséré dans la table users')

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
