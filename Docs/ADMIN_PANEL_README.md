# Admin Panel - White Label Configuration

Complete admin panel for managing white-label configuration, credentials, API keys, and branding assets.

## 🚀 Features

### 1. **Admin Authentication**
- Secure JWT-based authentication
- HTTP-only cookie sessions (7-day expiration)
- First-login detection with forced credential change
- Password hashing with bcrypt

### 2. **Credentials Management**
- Change admin email
- Change admin password
- Forced first-time credential update for security

### 3. **Environment Variables Management**
- Configure Nodemailer (email & app password)
- Configure API keys (Finnhub, Gemini)
- Configure application URLs (Better Auth URL)
- Automatic `.env` file updates
- Database backup of all settings

### 4. **White Label Branding**
- Upload custom logos (app logo, email logo)
- Upload profile images
- Upload dashboard preview images
- Automatic image optimization
- Dynamic image loading throughout the app

## 📋 Setup Instructions

### Step 1: Add Environment Variables

Add these to your `.env` file:

```env
# Admin Panel
ADMIN_EMAIL=admin@email.com
ADMIN_PASSWORD=admin123
ADMIN_JWT_SECRET=your-super-secret-admin-key-change-in-production-make-it-long-and-random
```

### Step 2: Install Dependencies

The required dependencies are already installed:
- `bcryptjs` - Password hashing
- `jose` - JWT handling
- `@types/bcryptjs` - TypeScript types

### Step 3: Access Admin Panel

1. **Navigate to Admin Login:**
   ```
   http://localhost:3000/admin/login
   ```

2. **Default Credentials:**
   - Email: `admin@email.com`
   - Password: `admin123`

3. **First Login:**
   - You'll be prompted to change credentials immediately
   - This is enforced for security

## 🔐 Security Features

### Password Security
- Bcrypt hashing with salt rounds (10)
- Minimum 6 characters enforced
- Current password verification required for changes

### Session Security
- HTTP-only cookies (cannot be accessed by JavaScript)
- Secure flag in production
- SameSite: Lax (CSRF protection)
- 7-day expiration

### Route Protection
- Middleware authentication check
- Automatic redirect to login if unauthorized
- Token verification on every protected route

## 📱 Admin Dashboard Sections

### 1. Credentials Tab

**Change Admin Email:**
- Update login email address
- Requires current password confirmation
- Auto-logout if email changes

**Change Admin Password:**
- Enter current password
- New password (min 6 chars)
- Confirm new password
- Optional (leave blank to keep current)

### 2. Environment Tab

**Email Configuration:**
- Nodemailer Email (Gmail address)
- App Password (generate at accounts.google.com/apppasswords)

**API Keys:**
- Finnhub API Key (get at finnhub.io)
- Gemini API Key (get at makersuite.google.com/app/apikey)

**Application URLs:**
- Better Auth URL (base URL for auth and emails)

**⚠️ Important:** After saving environment variables, **restart your application** for changes to take effect.

### 3. Branding Tab

**Uploadable Assets:**

| Asset | Usage | Recommended Size |
|-------|-------|-----------------|
| **App Logo** | Header, navigation | 150x50px, PNG |
| **Email Logo** | All email templates | 150x50px, PNG |
| **Profile Image** | Default user avatar | 200x200px, Square, PNG |
| **Dashboard Preview** | Welcome email | 600x400px, JPEG/PNG |

**Upload Process:**
1. Click "Upload New" button
2. Select image file (max 5MB)
3. Preview updates automatically
4. Click "Save Image Configuration"
5. Refresh page to see changes

## 🎨 How White Label Works

### Dynamic Image Loading

**Server-Side (Emails):**
```typescript
import { getEmailLogo, getDashboardPreview } from '@/lib/admin/images';

// In email function
const emailLogoPath = await getEmailLogo();
const logoUrl = `${baseUrl}${emailLogoPath}`;
```

**Client-Side (React Components):**
```typescript
import { useWhiteLabelImages } from '@/hooks/useWhiteLabelImages';

function MyComponent() {
  const { images } = useWhiteLabelImages();
  
  return <img src={images.profileImage} />;
}
```

### Image Storage

- **Location:** `public/assets/images/`
- **Database:** Paths stored in `WhiteLabel` collection
- **Caching:** 1-minute cache for performance
- **Fallback:** Default images if uploads fail

## 🔄 Database Models

### Admin Model
```typescript
{
  email: string;
  password: string (bcrypt hashed);
  isFirstLogin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### WhiteLabel Model
```typescript
{
  // Branding
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  
  // Email Config
  nodemailerEmail: string;
  nodemailerPassword: string;
  
  // API Keys
  finnhubApiKey: string;
  geminiApiKey: string;
  
  // URLs
  betterAuthUrl: string;
}
```

## 📁 File Structure

```
app/
├── (root)/
│   └── admin/
│       ├── login/
│       │   └── page.tsx          # Admin login page
│       └── dashboard/
│           └── page.tsx          # Admin dashboard page
├── api/
    └── admin/
        ├── auth/
        │   ├── login/route.ts    # Login endpoint
        │   └── logout/route.ts   # Logout endpoint
        ├── credentials/route.ts   # Update credentials
        ├── environment/route.ts   # Manage env vars
        └── images/
            ├── route.ts          # Get/set image config
            └── upload/route.ts   # Upload images

components/
└── admin/
    ├── AdminDashboard.tsx        # Main dashboard layout
    ├── CredentialsSection.tsx    # Credentials tab
    ├── EnvironmentSection.tsx    # Environment tab
    └── ImagesSection.tsx         # Branding tab

database/
└── models/
    ├── admin.model.ts            # Admin user model
    └── whitelabel.model.ts       # White label settings

lib/
├── admin/
│   ├── auth.ts                   # Auth helpers
│   └── images.ts                 # Image loader helpers
└── nodemailer/
    └── index.ts                  # Email functions (use dynamic logos)

hooks/
└── useWhiteLabelImages.ts        # Client-side image hook
```

## 🛠️ API Endpoints

### Authentication
- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/logout` - Admin logout

### Credentials
- `PUT /api/admin/credentials` - Update email/password

### Environment
- `GET /api/admin/environment` - Get env vars
- `PUT /api/admin/environment` - Update env vars

### Images
- `GET /api/admin/images` - Get image paths
- `PUT /api/admin/images` - Update image paths
- `POST /api/admin/images/upload` - Upload image file

### Public
- `GET /api/whitelabel/images` - Get white label images (no auth)

## 🚨 Important Notes

### First-Time Setup
1. Login with default credentials
2. **Immediately** change email and password
3. Configure environment variables
4. Upload custom branding assets
5. Restart application

### Production Deployment
1. Change `ADMIN_JWT_SECRET` to a strong random string
2. Use strong admin password (not default)
3. Set `BETTER_AUTH_URL` to your production domain
4. Ensure `.env` file is in `.gitignore`
5. Consider using environment-specific secrets management

### Email Configuration
- For Gmail, use App Passwords, not your regular password
- Enable 2FA on your Google account
- Generate app password at: accounts.google.com/apppasswords
- Use format: `xxxx xxxx xxxx xxxx` (without spaces in .env)

### Image Uploads
- Max file size: 5MB
- Supported formats: PNG, JPEG, GIF, WebP
- Images saved to: `public/assets/images/`
- Original filenames replaced with field names (e.g., `appLogo.png`)

## 🔧 Troubleshooting

### "Unauthorized" Error
- Check if admin-token cookie is set
- Try logging out and back in
- Clear browser cookies
- Verify JWT_SECRET matches

### Images Not Showing
- Check file uploaded to `public/assets/images/`
- Verify database has correct path
- Clear browser cache
- Check file permissions

### Environment Variables Not Updating
- **You must restart the application**
- Check `.env` file was updated
- Verify file write permissions
- Check for syntax errors in `.env`

### Email Not Sending
- Verify Nodemailer credentials in environment tab
- Check Gmail app password is correct
- Ensure 2FA is enabled on Google account
- Check spam folder

## 📚 Usage Examples

### Example 1: Complete First-Time Setup

```bash
# 1. Start your app
npm run dev

# 2. Navigate to admin panel
http://localhost:3000/admin/login

# 3. Login with defaults
Email: admin@email.com
Password: admin123

# 4. Change credentials (forced on first login)
New Email: admin@yourcompany.com
Current Password: admin123
New Password: SecurePassword123!
Confirm Password: SecurePassword123!
[Save Credentials]

# 5. Configure environment variables
Tab: Environment
- Nodemailer Email: yourcompany@gmail.com
- App Password: xxxx xxxx xxxx xxxx
- Finnhub API Key: your-key-here
- Gemini API Key: your-key-here
- Better Auth URL: https://yourapp.com
[Save Environment Variables]

# 6. Restart application
Ctrl+C
npm run dev

# 7. Upload branding
Tab: Branding
- Upload App Logo (your-logo.png)
- Upload Email Logo (your-logo.png)
- Upload Profile Image (default-avatar.png)
[Save Image Configuration]

# 8. Refresh page - Done!
```

### Example 2: Update Logo After Launch

```typescript
// 1. Login to admin panel
// 2. Go to Branding tab
// 3. Upload new logo
// 4. Save configuration
// 5. Refresh your application

// The new logo will automatically appear in:
// - Email templates (welcome, alerts, summaries)
// - Client components using useWhiteLabelImages hook
```

## 🎉 Success!

Your admin panel is now fully configured and ready for white-label deployment!

**Next Steps:**
- Test all email functionalities
- Verify branding appears correctly
- Set up production environment variables
- Document your custom setup

**Support:**
- Check `ADMIN_PANEL_README.md` for detailed documentation
- Review code comments in admin components
- Test each feature thoroughly before production

---

**Security Reminder:** Always change default credentials in production! 🔒

