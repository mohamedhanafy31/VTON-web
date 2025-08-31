# Virtual Try-On Application

This application allows users to virtually try on clothes using AI technology. It consists of a Node.js backend server and a JavaScript frontend.

## Project Structure

The project is organized into two main components:

### Backend (Node.js)

```
/
├── src/
│   ├── config/          # Configuration files
│   │   ├── cloudinary.js
│   │   ├── db.js
│   │   ├── multer.js
│   │   ├── ngrok.js
│   │   └── session.js
│   │
│   ├── controllers/     # API controllers
│   │   ├── authController.js
│   │   ├── imageController.js
│   │   ├── miscController.js
│   │   ├── orderController.js
│   │   ├── storeController.js
│   │   └── tryonController.js
│   │
│   ├── middleware/      # Middleware functions
│   │   ├── auth.js
│   │   └── logger.js
│   │
│   ├── routes/          # API routes
│   │   ├── authRoutes.js
│   │   ├── imageRoutes.js
│   │   ├── miscRoutes.js
│   │   ├── orderRoutes.js
│   │   ├── storeRoutes.js
│   │   └── tryonRoutes.js
│   │
│   ├── utils/           # Utility functions
│   │   └── jobManager.js
│   │
│   └── server.js        # Main application file
```

### Frontend (Static files)

```
/static/
├── js/
│   ├── config.js                  # Centralized configuration
│   ├── app.js                     # Main application & state manager
│   ├── services/
│   │   ├── firebase-service.js    # Firebase data operations
│   │   ├── auth-service.js        # Authentication functionality
│   │   ├── store-service.js       # Store-related operations
│   │   ├── garment-service.js     # Garment-related operations
│   │   └── tryon-service.js       # Try-on request handling
│   └── controllers/
│       ├── ui-controller.js       # UI interactions & notifications
│       ├── camera-controller.js   # Camera functionality
│       └── form-controller.js     # Form handling
├── css/                           # Stylesheets
├── Media/                         # Media files
├── uploads/                       # User uploads
├── temp/                          # Temporary files
├── pages/                         # Organized HTML files
│   ├── main/                      # Main application pages
│   │   ├── index.html             # Landing page
│   │   ├── VTON.html              # Virtual try-on main page
│   │   └── tryon.html             # Try-on experience
│   ├── admin/                     # Admin interface pages
│   │   ├── AdminDashBoard.html    # Admin dashboard
│   │   └── StoreDashBoard.html    # Store management dashboard
│   └── other/                     # Additional pages
│       ├── ai-courses.html        # AI courses info
│       ├── ai-solutions.html      # AI solutions info
│       └── vr-solutions.html      # VR solutions info
```

## Features

- Store management (admin, customer)
- Image upload and management
- Virtual Try-On processing with external API
- Order handling
- Authentication and authorization

## Application URLs

### Main Pages
- `/` - Landing page (index.html)
- `/vton` - Virtual Try-On main page
- `/tryon` - Try-On experience

### Admin Pages
- `/admin/dashboard` - Admin dashboard
- `/store/dashboard` - Store dashboard

## Prerequisites

- Node.js (v16 or higher)
- Firebase account (for Firestore database)
- Cloudinary account (for image storage, optional but recommended)
- Artificial Studio API key (for virtual try-on functionality)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_session_secret_key

# Firebase configuration
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Cloudinary configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# NGROK configuration (optional)
NGROK_AUTHTOKEN=your_ngrok_authtoken

# TryOn API
TRYON_API_KEY=your_tryon_api_key

# Public URL (production only)
PUBLIC_URL=https://your-production-url.com
```

## Installation

1. **Clone the repository and navigate to the project directory**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   ```

4. **Set up Firebase:**
   - Create a Firebase project
   - Download the service account key as `serviceAccountKey.json`
   - Place it in the root directory

5. **Set up Cloudinary (optional but recommended):**
   - Create a Cloudinary account
   - Add your credentials to the `.env` file

6. **Get Artificial Studio API key:**
   - Visit [Artificial Studio](https://www.artificialstudio.ai/)
   - Create an account and get your API key
   - Add it to the `.env` file

7. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on the specified port (default: 3000) and automatically validate your configuration.

## Production Deployment

For production deployment, use the Docker configuration provided:

```
docker-compose up -d
```

## API Endpoints

### Authentication
- `POST /store/login` - Store login
- `POST /store/logout` - Store logout
- `POST /admin/login` - Admin login
- `POST /admin/logout` - Admin logout

### Store Management
- `GET /stores` - Get all stores (admin only)
- `POST /stores` - Create new store (admin only)
- `PUT /stores/:storeName` - Update store (admin only)
- `DELETE /stores/:storeName` - Delete store (admin only)
- `GET /store/profile` - Get store profile
- `GET /store/garments/:storeName` - Get store garments
- `GET /store/orders/:storeName` - Get store orders
- `GET /active-stores` - Get active stores (public)

### Image Management
- `POST /upload` - Upload images
- `POST /store/upload-logo` - Upload store logo
- `GET /images` - Get images
- `GET /descriptions` - Get image descriptions
- `DELETE /delete/:publicId` - Delete image
- `POST /test-image` - Test image URL

### TryOn Processing
- `POST /tryon` - Process try-on request
- `POST /webhook` - Process webhook from AI service
- `POST /manual-webhook` - Process manual webhook
- `GET /get-result/:jobId` - Get job result
- `GET /trials` - Get trials count
- `POST /update-trials` - Update trials count

### Order Management
- `POST /save-order` - Save order
- `POST /update-order-wanted` - Update order wanted status 