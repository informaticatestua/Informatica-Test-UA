// Extend Astro locals to include the authenticated user
declare namespace App {
  interface Locals {
    user?: import('@supabase/supabase-js').User;
  }
}
