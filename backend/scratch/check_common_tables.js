const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aroxnlnrnkophfcfugqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyb3hubG5ybmtvcGhmY2Z1Z3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2Mjg1MzQsImV4cCI6MjA5NjIwNDUzNH0.RsnBrpgs-8BlZP9CG77Yb7QGvs-aJmBTWJLceg4PsR0';
const supabase = createClient(supabaseUrl, supabaseKey);

const commonTables = [
  'tasks', 'todos', 'jobs', 'projects', 'issues', 'tickets', 'assignments', 'work_items', 'task_logs', 'notifications'
];

async function check() {
  for (const table of commonTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        console.log(`Table '${table}' does not exist.`);
      } else {
        console.log(`Table '${table}' exists but failed with error:`, error.message);
      }
    } else {
      console.log(`Table '${table}' EXISTS! Sample data:`, data);
    }
  }
}

check().catch(err => console.error(err));
