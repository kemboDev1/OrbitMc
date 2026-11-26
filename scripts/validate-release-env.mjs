const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_REDIRECT_URL',
];

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Desktop release is missing required GitHub Actions secrets: ${missing.join(', ')}`);
  process.exit(1);
}

for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_REDIRECT_URL']) {
  let url;
  try {
    url = new URL(process.env[key]);
  } catch {
    console.error(`${key} must be a valid HTTPS URL.`);
    process.exit(1);
  }
  if (url.protocol !== 'https:') {
    console.error(`${key} must be a valid HTTPS URL.`);
    process.exit(1);
  }
}
