# Slidecraft - AI-Powered Presentation Generator

Slidecraft is an authenticated web application that generates professional PowerPoint presentations using AI. It features user authentication, admin-controlled account management, and user-specific presentation storage.

## Features

- **User Authentication**: Secure login system with JWT tokens (8-hour sessions)
- **Admin Panel**: Web-based interface for managing employee accounts
- **AI-Powered**: Uses Ollama AI models to generate presentation content
- **Automatic Conversion**: Converts AI-generated Markdown to PowerPoint (.pptx)
- **User Isolation**: Each user sees only their own presentations
- **Role-Based Access**: Admin and Employee roles with different permissions

## Prerequisites

Before running Slidecraft, ensure you have the following installed:

1. **Node.js** (v14 or higher)
2. **MongoDB** (v4.4 or higher) - Running on localhost:27017
3. **Ollama** - Running on localhost:11434
4. **Pandoc** - For Markdown to PowerPoint conversion

### Installing Prerequisites

#### MongoDB
- **Windows**: Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
- **Mac**: `brew install mongodb-community`
- **Linux**: Follow [official installation guide](https://docs.mongodb.com/manual/administration/install-on-linux/)

#### Ollama
- Download from [Ollama website](https://ollama.ai)
- Install and pull a model: `ollama pull llama3.1:latest`

#### Pandoc
- **Windows**: Download from [Pandoc releases](https://github.com/jgm/pandoc/releases)
- **Mac**: `brew install pandoc`
- **Linux**: `sudo apt-get install pandoc`

## Installation

You can run Slidecraft using **Docker** (recommended) or install it manually.

### Option 1: Docker Installation (Recommended)

Docker automatically sets up MongoDB, Ollama, the backend, and frontend - everything you need!

**Prerequisites:**
- Docker Desktop installed and running
- That's it! No need to install Node.js, MongoDB, Ollama, or Pandoc separately

**Steps:**

1. **Clone the repository**
   ```bash
   cd Slidecraft
   ```

2. **Start all services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   This single command starts:
   - MongoDB (port 27017)
   - Ollama AI (port 11434)
   - Backend server (port 4000)
   - Frontend app (port 3000)

3. **Wait for Ollama to download the AI model** (first time only, ~4GB)
   ```bash
   docker-compose logs -f ollama-init
   ```
   Wait until you see "ready"

4. **Create your first admin account**
   ```bash
   docker-compose exec backend node scripts/createAdmin.mjs
   ```

5. **Open the app**
   Navigate to http://localhost:3000 and login!

**Docker Commands:**
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend

# Create admin user
docker-compose exec backend node scripts/createAdmin.mjs
```

---

### Option 2: Manual Installation

If you prefer to install everything manually without Docker:

**Prerequisites:**
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Ollama
- Pandoc

**Steps:**

1. **Clone the repository**
   ```bash
   cd Slidecraft
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   The `.env` file should already contain the necessary configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/slidecraft
   JWT_SECRET=your-secret-key-change-this-in-production
   JWT_EXPIRES_IN=8h
   SESSION_SECRET=your-session-secret-change-this-in-production
   ```

   **IMPORTANT**: Change the JWT_SECRET and SESSION_SECRET to strong random values in production!

4. **Start MongoDB**
   ```bash
   # Windows
   net start MongoDB

   # Mac/Linux
   brew services start mongodb-community
   # or
   sudo systemctl start mongod
   ```

5. **Start Ollama**
   ```bash
   ollama serve
   ```

## First-Time Setup

### Create Your First Admin Account

Before using the application, you need to create at least one admin account.

**With Docker:**
```bash
docker-compose exec backend node scripts/createAdmin.mjs
```

**Without Docker:**
```bash
npm run create-admin
```

You will be prompted to enter:
- Admin username (minimum 3 characters)
- Admin password (minimum 6 characters)
- Password confirmation

Example:
```
Enter admin username: admin
Enter admin password: ********
Confirm admin password: ********
✅ Admin user created successfully!
```

## Running the Application

### With Docker (Recommended)

Simply run:
```bash
docker-compose up -d
```

That's it! Everything is running. Access the app at http://localhost:3000

To stop:
```bash
docker-compose down
```

---

### Without Docker (Manual)

You need to run TWO separate processes:

#### 1. Start the Backend Server (Terminal 1)
```bash
npm run server
```

This starts the Express server on http://localhost:4000

#### 2. Start the Frontend (Terminal 2)
```bash
npm start
```

This starts the React development server on http://localhost:3000

## Using the Application

### Logging In

1. Navigate to http://localhost:3000
2. Enter your username and password
3. Click "Login"

### Admin Features

If you're logged in as an admin, you'll see additional options:

#### Admin Panel Access
- Click on your username in the top-right corner
- Select "Admin Panel" from the dropdown menu

#### Creating Employee Accounts
1. Open the Admin Panel
2. Click "+ Create New User"
3. Enter:
   - Username
   - Password (minimum 6 characters)
   - Role (Admin or Employee)
4. Click "Create"

#### Managing Users
In the Admin Panel, you can:
- View all users and their statistics
- Change user passwords (🔑 icon)
- Delete users (🗑️ icon)
- View total presentations and recent activity

### Generating Presentations

1. Log in to the application
2. Type your presentation request in the chat input
   - Example: "Create a 5-slide presentation about climate change"
3. The AI will generate Markdown content
4. A PowerPoint file will automatically download
5. The presentation is saved to your account history

### User Isolation

- Each employee sees only their own presentations
- Presentations are stored in user-specific directories: `uploads/{userId}/`
- No shared presentation history between users

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt (10 rounds)
- **JWT Authentication**: 8-hour session tokens
- **Protected API Endpoints**: All routes require authentication
- **Admin-Only Routes**: User management requires admin privileges
- **No Self-Registration**: Only admins can create accounts

## Project Structure

```
Slidecraft/
├── db/
│   └── connection.js          # MongoDB connection
├── middleware/
│   └── auth.js                # Authentication middleware
├── models/
│   ├── User.js                # User schema
│   └── Conversion.js          # Presentation schema
├── routes/
│   ├── auth.js                # Authentication routes
│   └── admin.js               # Admin management routes
├── scripts/
│   └── createAdmin.mjs         # Admin creation script
├── src/
│   ├── components/            # React components
│   │   ├── Login.js
│   │   ├── AdminPanel.js
│   │   ├── UserMenu.js
│   │   ├── ChatMessage.js
│   │   ├── ChatInput.js
│   │   └── ModelSelector.js
│   ├── context/
│   │   └── AuthContext.js     # Authentication state
│   ├── server.js              # Express backend
│   ├── convertToPPTX.js       # Pandoc conversion logic
│   └── App.js                 # Main React app
├── templates/
│   └── template.pptx          # PowerPoint template
├── uploads/                   # User presentations (organized by userId)
└── .env                       # Environment variables
```

## API Endpoints

### Authentication Routes (Public)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Admin Routes (Admin Only)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - System statistics
- `PUT /api/auth/change-password/:userId` - Change user password

### Protected Routes (Authenticated Users)
- `POST /convert` - Generate presentation
- `GET /history` - Get user's presentations
- `GET /conversion/:id` - Get specific presentation

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Ensure MongoDB is running:
```bash
# Check if MongoDB is running
mongo --version
# Start MongoDB service
```

### Ollama Not Responding
```
Error: fetch failed to http://localhost:11434
```
**Solution**: Ensure Ollama is running:
```bash
ollama serve
```

### Pandoc Not Found
```
Error: pandoc not found
```
**Solution**: Install Pandoc or add it to your system PATH

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::4000
```
**Solution**: Kill the process using port 4000:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:4000 | xargs kill -9
```

## Production Deployment Notes

Before deploying to production:

1. **Change JWT_SECRET and SESSION_SECRET** to strong random values
2. **Update MONGODB_URI** to your production MongoDB instance
3. **Configure CORS** in server.js for your production domain
4. **Enable HTTPS** for secure authentication
5. **Set up MongoDB authentication** with username/password
6. **Configure firewall rules** to restrict database access
7. **Set up regular backups** for MongoDB

## Support

For issues or questions, please contact your system administrator.

## License

Private use only - Internal company application
