const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aroxnlnrnkophfcfugqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyb3hubG5ybmtvcGhmY2Z1Z3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2Mjg1MzQsImV4cCI6MjA5NjIwNDUzNH0.RsnBrpgs-8BlZP9CG77Yb7QGvs-aJmBTWJLceg4PsR0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: messages, error } = await supabase.from('messages').select('*').order('timestamp', { ascending: false }).limit(5);
  console.log("Recent messages:", messages);
  const { data: employees } = await supabase.from('employees').select('id, first_name, device_id, role');
  console.log("Employees:", employees);
}
run();
