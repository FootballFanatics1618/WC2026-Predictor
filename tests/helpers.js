const { createClient } = require('@supabase/supabase-js')
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY } = require('./config')

async function getUserIds() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await adminClient.auth.signInWithPassword({ email: 'test123@gmail.com', password: 'test123' })
  const { data: adminSession } = await adminClient.auth.getSession()
  const adminId = adminSession.session?.user?.id

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await userClient.auth.signInWithPassword({ email: 'achintyakarapurkar@gmail.com', password: 'worldcup2026' })
  const { data: userSession } = await userClient.auth.getSession()
  const userId = userSession.session?.user?.id

  return { adminId, userId }
}

async function signInUserClient() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await client.auth.signInWithPassword({ email: 'achintyakarapurkar@gmail.com', password: 'worldcup2026' })
  return client
}

async function signInAdminClient() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await client.auth.signInWithPassword({ email: 'test123@gmail.com', password: 'test123' })
  return client
}

module.exports = { getUserIds, signInUserClient, signInAdminClient }
