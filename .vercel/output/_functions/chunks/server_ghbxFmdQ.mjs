import { createClient } from '@supabase/supabase-js';

function getServerClient() {
  return createClient(
    "https://lwtyzqemiipprusmdaor.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dHl6cWVtaWlwcHJ1c21kYW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4Nzk2MCwiZXhwIjoyMDg5ODYzOTYwfQ.r0UQrqkbQaVSXsdUktASqymg1_xqPXn_EFIhTirtEzM",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
function createServerClient(accessToken) {
  const client = createClient(
    "https://lwtyzqemiipprusmdaor.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dHl6cWVtaWlwcHJ1c21kYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODc5NjAsImV4cCI6MjA4OTg2Mzk2MH0.ZwDlD53iEtd9Oryzrq50UEfsX9zg-iEI6C-oNkpvWnM",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  client.auth.setSession({ access_token: accessToken, refresh_token: "" });
  return client;
}

export { createServerClient as c, getServerClient as g };
