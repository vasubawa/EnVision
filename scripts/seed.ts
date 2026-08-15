import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'
import * as dotenv from 'dotenv'

// Load environment variables from .env and .env.local
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const NUM_USERS = 3
const WORKSPACES_PER_USER = 2

async function main() {
  console.log('🌱 Starting database seed...')

  // 1. Delete existing test users to prevent duplicates
  console.log('🧹 Cleaning up old test users...')
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError)
    process.exit(1)
  }

  for (const user of users) {
    if (user.email && user.email.startsWith('seed_user_')) {
      await supabase.auth.admin.deleteUser(user.id)
      console.log(`   Deleted old test user: ${user.email}`)
    }
  }

  // 2. Create new test users
  console.log(`\n👤 Creating ${NUM_USERS} test users...`)
  const createdUserIds: string[] = []

  for (let i = 1; i <= NUM_USERS; i++) {
    const email = `seed_user_${i}@example.com`
    const password = 'Password123!'

    const {
      data: { user },
      error: createError,
    } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        display_name: faker.person.fullName(),
      },
    })

    if (createError || !user) {
      console.error(`Error creating user ${email}:`, createError)
      continue
    }

    createdUserIds.push(user.id)
    console.log(`   Created user: ${email} (Password: ${password})`)

    // Note: The handle_new_user trigger in the DB automatically inserts into the `profiles` table.
  }

  // 3. Create workspaces for each user
  console.log(`\n📁 Creating workspaces and chat messages...`)

  for (const userId of createdUserIds) {
    for (let w = 0; w < WORKSPACES_PER_USER; w++) {
      // Create Workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          user_id: userId,
          title: `${faker.hacker.adjective()} ${faker.hacker.noun()} project`,
          is_auto_check_enabled: faker.datatype.boolean(),
          created_at: faker.date.recent({ days: 30 }).toISOString(),
        })
        .select()
        .single()

      if (workspaceError || !workspace) {
        console.error('Error creating workspace:', workspaceError)
        continue
      }

      console.log(`   Created workspace: "${workspace.title}" for user ${userId}`)

      // Create Chat Messages for this workspace
      const numMessages = faker.number.int({ min: 2, max: 6 })
      const messagesToInsert = []

      for (let m = 0; m < numMessages; m++) {
        const isUserMsg = m % 2 === 0
        messagesToInsert.push({
          workspace_id: workspace.id,
          role: isUserMsg ? 'user' : 'assistant',
          kind: isUserMsg ? 'chat' : faker.helpers.arrayElement(['chat', 'feedback']),
          content: isUserMsg ? faker.lorem.sentence() : faker.lorem.paragraph(),
          created_at: faker.date.recent({ days: 1 }).toISOString(),
        })
      }

      const { error: messagesError } = await supabase.from('messages').insert(messagesToInsert)

      if (messagesError) {
        console.error('Error inserting messages:', messagesError)
      }
    }
  }

  console.log('\n✅ Seeding complete!')
}

main().catch(console.error)
