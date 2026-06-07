const { createClient } = require('@supabase/supabase-js')

// Copy this file to config.js and fill in your values.
// config.js is gitignored and will not be committed.

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'
const SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001'

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'adminpassword'
const USER_EMAIL = process.env.TEST_USER_EMAIL || 'user@test.com'
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'userpassword'

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function supabaseUser() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  BASE_URL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  USER_EMAIL,
  USER_PASSWORD,
  supabaseAdmin,
  supabaseUser,
}
