# Supabase live data setup

1. Create a project at https://supabase.com.
2. In Supabase, open **SQL Editor**, create a query, paste the contents of `supabase-schema.sql`, and click **Run**.
3. Open **Project Settings > API** and copy:
   - **Project URL**
   - **Publishable key** (or legacy **anon** key)
4. In Vercel, open the `trip-expense-manager` project and go to **Settings > Environment Variables**.
5. Add these variables for **Production**, **Preview**, and **Development**:

   ```text
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   ```

6. Redeploy the latest production deployment.

The app will then read and write the shared `trip_store` table, and Supabase Realtime will update open browsers when another user changes the trip data.

Do not add the Supabase `service_role` or secret key to Vercel client environment variables. Only use the public browser key.

## Important security note

The current app uses a shared client-side admin PIN. The SQL policies allow anonymous users to read and write the trip table, which is appropriate only for a private trip link where the PIN is treated as basic convenience protection. For stronger security, add Supabase Auth and user-scoped admin policies before using this for sensitive financial records.