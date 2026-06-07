const supabaseUrl = 'https://aroxnlnrnkophfcfugqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyb3hubG5ybmtvcGhmY2Z1Z3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2Mjg1MzQsImV4cCI6MjA5NjIwNDUzNH0.RsnBrpgs-8BlZP9CG77Yb7QGvs-aJmBTWJLceg4PsR0';

async function querySchema() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.statusText}`);
  }
  const data = await res.json();
  
  // List all tables/endpoints from paths
  console.log('Endpoints/Tables available in Supabase:');
  const paths = Object.keys(data.paths);
  const tables = new Set();
  paths.forEach(p => {
    const parts = p.split('/');
    if (parts[1]) {
      tables.add(parts[1]);
    }
  });
  console.log(Array.from(tables));
  
  // Print RPC function paths specifically
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  console.log('\nRPC Functions:');
  console.log(rpcs);
}

querySchema().catch(err => console.error(err));
