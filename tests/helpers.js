const { createClient } = require('@supabase/supabase-js')
const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD } = require('./config')

async function getUserIds() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  const { data: adminSession } = await adminClient.auth.getSession()
  const adminId = adminSession.session?.user?.id

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await userClient.auth.signInWithPassword({ email: USER_EMAIL, password: USER_PASSWORD })
  const { data: userSession } = await userClient.auth.getSession()
  const userId = userSession.session?.user?.id

  return { adminId, userId }
}

async function signInUserClient() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await client.auth.signInWithPassword({ email: USER_EMAIL, password: USER_PASSWORD })
  return client
}

async function signInAdminClient() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  return client
}

module.exports = { getUserIds, signInUserClient, signInAdminClient }
