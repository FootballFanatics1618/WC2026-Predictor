const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://pqmjkggmcodjwyiceczi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODY4MTUsImV4cCI6MjA5NjE2MjgxNX0.7EOh4gkJ97DRLdf5IG3VB3gabtKMor02775ONuIhZ40'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWprZ2dtY29kand5aWNlY3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU4NjgxNSwiZXhwIjoyMDk2MTYyODE1fQ.VfSbrGc77hc-ubzP4CSv6ittF537ZngF75B5ZvhNd7w'

const BASE_URL = 'http://localhost:3001'

const ADMIN_EMAIL = 'test123@gmail.com'
const ADMIN_PASSWORD = 'test123'
const USER_EMAIL = 'achintyakarapurkar@gmail.com'
const USER_PASSWORD = 'worldcup2026'

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
