# PathQuest Email Notifications & Player Registration Implementation

## ✅ What's Been Implemented

### 1. **Email Notifications with Resend**

- Admins now receive email notifications when they create player accounts
- Emails include the player's email and password credentials
- Professional HTML email templates

### 2. **Player Self-Registration Endpoint**

- Players can now create their own accounts directly from the game
- Includes validation for email format and password strength
- Automatic welcome email sent to new players
- Players automatically receive a JWT token upon successful registration

### 3. **Enhanced Admin Middleware**

- Captures admin email from the database during authentication
- Stores admin email in request for use in email notifications

---

## 🔧 Setup Instructions

### 1. **Install Resend**

Already done! Dependencies are installed. Resend v3.5.0 is available.

### 2. **Configure Environment Variables**

Create or update your `.env` file with the following:

```env
# MongoDB Connection
MONGO_URI=your_mongodb_connection_string

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Resend Email Service
RESEND_API_KEY=your_resend_api_key_from_resend.com
RESEND_FROM_EMAIL=noreply@pathoquest.com

# Admin Email (receives notifications when creating players)
ADMIN_EMAIL=admin@yourdomain.com

# Server Port
PORT=5000
```

**How to get Resend API Key:**

1. Go to [resend.com](https://resend.com)
2. Sign up/Login
3. Navigate to API Keys section
4. Create a new API key and copy it
5. Add it to your `.env` file

---

## 📧 New API Endpoints

### 1. **Player Self-Registration** (Public)

**Endpoint:** `POST /api/player/register`

**Request Body:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "confirmPassword": "securePassword123"
}
```

**Response (Success):**

```json
{
  "message": "Account created successfully! Welcome to PathQuest.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "player": {
    "id": "65d4c8a9f1b2c3d4e5f6g7h8",
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

**Response (Error):**

```json
{
  "message": "Email already registered"
}
```

**Validation Rules:**

- Username and email must be unique
- Email must be in valid format
- Password must be at least 6 characters
- Password and confirmPassword must match

---

### 2. **Admin Create Player** (Admin Only - Enhanced)

**Endpoint:** `POST /api/player/create`
**Auth:** Required (Bearer token)

**Request Body:**

```json
{
  "username": "jane_smith",
  "email": "jane@example.com",
  "password": "tempPassword456"
}
```

**What Happens:**

1. Player account is created in database
2. Admin receives email with player credentials
3. Email sent to admin's registered email address

**Response:**

```json
{
  "message": "Player created successfully",
  "player": {
    "id": "65d4c8a9f1b2c3d4e5f6g7h8",
    "username": "jane_smith",
    "email": "jane@example.com",
    "stats": { ... }
  }
}
```

---

## 📁 Files Modified/Created

### Created:

- **`server/services/emailService.js`** - Email sending utility with Resend
- **`.env.example`** - Environment variable template

### Modified:

- **`package.json`** - Added `resend` dependency
- **`server/routes/playerRoutes.js`** - Added register endpoint & enhanced create endpoint
- **`server/middleware/authMiddleware.js`** - Enhanced to capture admin email

---

## 🎯 Email Templates

### Admin Notification Email

Sent when admin creates a player account. Contains:

- Player email address
- Temporary password
- Note to share credentials with player
- Reminder to change password on first login

### Player Welcome Email

Sent when player registers. Contains:

- Welcome message
- Account activation confirmation
- Link to start learning (optional)
- Support contact information

---

## 🚀 Usage Examples

### Frontend - Player Registration (JavaScript)

```javascript
async function registerPlayer() {
  const response = await fetch("/api/player/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "player_name",
      email: "player@example.com",
      password: "password123",
      confirmPassword: "password123",
    }),
  });

  const data = await response.json();
  if (response.ok) {
    // Store token for future requests
    localStorage.setItem("token", data.token);
    // Redirect to game
    window.location.href = "/game";
  } else {
    alert(data.message);
  }
}
```

### Frontend - Admin Create Player (JavaScript)

```javascript
async function createPlayerFromAdmin() {
  const token = localStorage.getItem("adminToken");

  const response = await fetch("/api/player/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: "new_player",
      email: "newplayer@example.com",
      password: "temporaryPass123",
    }),
  });

  const data = await response.json();
  if (response.ok) {
    alert("Player created! Admin will receive email with credentials.");
  }
}
```

---

## ⚠️ Important Notes

1. **Email Sending**: Make sure you have a valid Resend API key and the `RESEND_FROM_EMAIL` is a verified domain in Resend
2. **Password Handling**: In production, consider:
   - Generating random temporary passwords instead of user-provided ones
   - Implementing password reset flows
   - Using password strength requirements
3. **Email Verification**: Consider adding email verification for self-registration (optional enhancement)
4. **Admin Email Storage**: The system uses `ADMIN_EMAIL` env var. You can also store it in the Admin model for more flexibility

---

## 🔍 Testing

### Test Player Registration:

```bash
curl -X POST http://localhost:5000/api/player/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123",
    "confirmPassword": "test123"
  }'
```

### Test Admin Create Player:

```bash
curl -X POST http://localhost:5000/api/player/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "username": "created_player",
    "email": "created@example.com",
    "password": "tempPass123"
  }'
```

---

## 📝 Future Enhancements

1. **Email Verification**: Add email verification before account activation
2. **Password Reset**: Implement forgot password flow with email link
3. **Custom Email Templates**: Store templates in database for easy customization
4. **Email History**: Track sent emails in database for audit purposes
5. **Bulk Player Creation**: Admin endpoint to create multiple players from CSV
6. **Two-Factor Authentication**: Optional email-based 2FA

---

## 🆘 Troubleshooting

**Issue**: Emails not sending

- Check `RESEND_API_KEY` is correct
- Verify `RESEND_FROM_EMAIL` is verified in Resend dashboard
- Check admin email is set in `.env`

**Issue**: "Email already registered" error

- The email already exists in database
- Suggest password reset instead

**Issue**: Player registration returns 500 error

- Check server logs for detailed error
- Verify MongoDB connection
- Ensure all env variables are set

---

For more information on Resend: https://resend.com/docs
