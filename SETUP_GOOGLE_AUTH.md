# Google OAuth Setup Guide

This guide will help you configure Google OAuth for your StudyMate AI application.

## Prerequisites
- A Google Cloud Platform account
- Access to your Supabase project dashboard
- The StudyMate AI application code

---

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 1.2 Create or Select a Project
- Click on the project dropdown at the top
- Click "New Project" or select an existing one
- Name it something like "StudyMate AI"

### 1.3 Enable Google+ API
- Go to "APIs & Services" > "Library"
- Search for "Google+ API"
- Click "Enable"

### 1.4 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" for user type
   - Fill in required fields:
     - App name: "StudyMate AI"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes (optional): email, profile, openid
   - Add test users if needed

4. Create OAuth Client ID:
   - Application type: "Web application"
   - Name: "StudyMate AI Web Client"
   
5. **Add Authorized JavaScript origins:**
   ```
   http://localhost:5173
   https://your-production-domain.com
   ```

6. **Add Authorized redirect URIs:**
   ```
   https://cmcbkatdyhunlvlktwlv.supabase.co/auth/v1/callback
   http://localhost:5173/auth/callback
   ```
   
   ⚠️ **Important**: Replace `cmcbkatdyhunlvlktwlv.supabase.co` with your actual Supabase project URL

7. Click "Create"
8. **Save your credentials:**
   - Client ID (starts with something like `123456789-abc...googleusercontent.com`)
   - Client Secret (keep this secure!)

---

## Step 2: Configure Supabase

### 2.1 Open Supabase Dashboard
Visit: https://app.supabase.com/project/YOUR_PROJECT_ID

### 2.2 Enable Google Provider
1. Go to "Authentication" in the left sidebar
2. Click on "Providers"
3. Find "Google" in the list
4. Toggle it to "Enabled"

### 2.3 Add Google OAuth Credentials
1. Paste your **Client ID** from Step 1.4
2. Paste your **Client Secret** from Step 1.4
3. Click "Save"

### 2.4 Configure Site URLs
1. Still in Authentication settings, go to "URL Configuration"
2. Set **Site URL**:
   - Development: `http://localhost:5173`
   - Production: `https://your-domain.com`

3. Add **Redirect URLs** (under "Redirect URLs"):
   ```
   http://localhost:5173/auth/callback
   https://your-domain.com/auth/callback
   ```

4. Click "Save"

---

## Step 3: Update Environment Variables

Edit your `.env` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL="https://cmcbkatdyhunlvlktwlv.supabase.co"
ANON_KEY="your_supabase_anon_key_here"

# Other variables...
```

⚠️ **Important**: 
- Replace with your actual Supabase project URL
- Never commit `.env` to Git
- The ANON_KEY should be your actual key from Supabase

---

## Step 4: Test the Integration

### 4.1 Start Development Server
```bash
npm run dev
# or
yarn dev
# or
bun dev
```

### 4.2 Test Sign-In Flow
1. Navigate to `http://localhost:5173/auth`
2. Click "Continue with Google" (on either Sign In or Sign Up tab)
3. You should be redirected to Google's sign-in page
4. Select your Google account
5. Grant permissions if prompted
6. You should be redirected back to the app and signed in

### 4.3 Check Developer Console
Open browser DevTools (F12) and check:
- No error messages in Console
- OAuth redirect URL is logged correctly
- Session is established successfully

---

## Troubleshooting

### Error: "Redirect URI mismatch"
**Solution**: 
- The redirect URL in your app must exactly match what's configured in Google Cloud Console
- Check for trailing slashes, http vs https, localhost port numbers

### Error: "OAuth state mismatch"
**Solution**:
- Clear browser cookies and cache
- Try in incognito/private mode
- Check that your Supabase project is using the correct redirect URLs

### Error: "Google sign in failed"
**Solution**:
- Verify Google OAuth credentials in Supabase dashboard
- Check that Google+ API is enabled in Google Cloud Console
- Ensure your Supabase project has Google provider enabled

### Error: "No session created"
**Solution**:
- Check your internet connection
- Verify Supabase project is accessible
- Check browser console for specific error messages
- Ensure `.env` has the correct Supabase URL

### Google Sign-In Button Does Nothing
**Solution**:
- Check browser console for JavaScript errors
- Verify the `handleGoogleSignIn` function is being called
- Check network tab for failed API calls
- Ensure Supabase client is initialized correctly

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Update Google Cloud Console with production domain
- [ ] Add production redirect URIs to Google OAuth credentials
- [ ] Update Supabase Site URL to production domain
- [ ] Add production redirect URL to Supabase settings
- [ ] Update `.env` or environment variables with production values
- [ ] Test OAuth flow on production domain
- [ ] Verify SSL/HTTPS is working correctly
- [ ] Remove test users from Google OAuth consent screen (if any)
- [ ] Consider submitting OAuth consent screen for verification (for production apps)

---

## Security Best Practices

1. **Never expose your Client Secret**
   - Keep it in `.env` file
   - Never commit to Git
   - Use environment variables in production

2. **Use HTTPS in production**
   - OAuth requires secure connections
   - Configure SSL certificates properly

3. **Limit OAuth scopes**
   - Only request necessary permissions
   - Users are more likely to grant limited access

4. **Monitor OAuth usage**
   - Check Supabase Analytics for auth events
   - Set up alerts for unusual activity

5. **Keep dependencies updated**
   - Regularly update `@supabase/supabase-js`
   - Monitor security advisories

---

## Support & Resources

- **Supabase Documentation**: https://supabase.com/docs/guides/auth/social-login/auth-google
- **Google OAuth Documentation**: https://developers.google.com/identity/protocols/oauth2
- **Project Issues**: Check CHANGELOG.md for known issues and fixes

---

## Quick Reference

### Important URLs:
- Google Cloud Console: https://console.cloud.google.com/
- Supabase Dashboard: https://app.supabase.com/
- Your Supabase Project: https://cmcbkatdyhunlvlktwlv.supabase.co

### Key Files:
- `.env` - Environment configuration
- `src/components/auth/AuthProvider.tsx` - Auth logic
- `src/components/auth/AuthCallback.tsx` - OAuth callback handler
- `src/components/auth/SignInPage.tsx` - Sign in UI

### Commands:
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Check for TypeScript errors
npm run type-check

# Lint code
npm run lint
```
