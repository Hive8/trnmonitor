const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aroxnlnrnkophfcfugqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyb3hubG5ybmtvcGhmY2Z1Z3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2Mjg1MzQsImV4cCI6MjA5NjIwNDUzNH0.RsnBrpgs-8BlZP9CG77Yb7QGvs-aJmBTWJLceg4PsR0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  if (error) {
    console.log('Error querying tasks:', error);
  } else {
    console.log('Tasks table exists! Sample data:', data);
  }
}

check().catch(err => console.error(err));
