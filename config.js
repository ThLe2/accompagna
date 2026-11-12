/* ---------------------------------------------------------------
   Configuration — Supabase > Settings > API Keys
   Project URL      -> SUPABASE_URL
   Publishable key  -> SUPABASE_KEY  (commence par sb_publishable_)

   Cette clé est faite pour être publiée : ce sont les politiques
   RLS qui protègent les données. NE JAMAIS mettre ici une clé
   sb_secret_, elle contourne toutes les règles d'accès.
   --------------------------------------------------------------- */
const SUPABASE_URL = 'https://axgdlokgnsndshrahovg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Z2Rsb2tnbnNuZHNocmFob3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0OTY0NDcsImV4cCI6MjExMDA3MjQ0N30.jNjaDUAGd7A4EhftnDy2dZEMTMBauwRp99sVfISjzdw';

window.LMS_CONFIG = {
  SUPABASE_URL:      SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_KEY
};
