import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  console.log("Looking for user Vagner Oliveira...");
  
  // Find user by name
  const { data: users, error: findErr } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', '%Vagner%');
    
  if (findErr) {
    console.error("Error finding user:", findErr);
    process.exit(1);
  }
  
  if (!users || users.length === 0) {
    console.log("User Vagner Oliveira not found in 'profiles' table.");
    // Fallback: try to list all and just update the first one
    const { data: allUsers } = await supabase.from('profiles').select('*').limit(1);
    if (allUsers && allUsers.length > 0) {
      console.log(`Setting first user (${allUsers[0].email || allUsers[0].id}) as admin...`);
      await updateRole(allUsers[0].id);
    } else {
      console.log("No users found in database at all. Please create an account first.");
    }
  } else {
    console.log(`Found user: ${users[0].full_name} (${users[0].id})`);
    await updateRole(users[0].id);
  }
}

async function updateRole(id) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'admin', plan: 'premium', tokens_limit: 5000000 })
    .eq('id', id);
    
  if (error) {
    console.error("Error updating role:", error);
  } else {
    console.log("Successfully updated user to ADMIN and PREMIUM plan!");
  }
}

setAdmin();
