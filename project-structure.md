# Virtual Try-On Application - Project Structure

## Project Overview

This Virtual Try-On application allows users to virtually try on clothes using AI technology. It consists of a Node.js/Express backend and a JavaScript frontend.

## Directory Structure

```
/
├── src/                          # Backend source code
│   ├── config/                   # Configuration files
│   │   ├── cloudinary.js         # Cloudinary configuration
│   │   ├── db.js                 # Firebase/Firestore setup
│   │   ├── multer.js             # File upload configuration
│   │   ├── ngrok.js              # Ngrok tunnel setup
│   │   └── session.js            # Session management
│   │
│   ├── controllers/              # API controllers
│   │   ├── authController.js     # Authentication logic
│   │   ├── imageController.js    # Image processing
│   │   ├── miscController.js     # Miscellaneous functionality
│   │   ├── orderController.js    # Order management
│   │   ├── storeController.js    # Store management
│   │   └── tryonController.js    # Virtual try-on processing
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.js               # Authentication middleware
│   │   └── logger.js             # Request logging
│   │
│   ├── routes/                   # API routes
│   │   ├── authRoutes.js         # Authentication endpoints
│   │   ├── imageRoutes.js        # Image handling endpoints
│   │   ├── miscRoutes.js         # Miscellaneous endpoints
│   │   ├── orderRoutes.js        # Order management endpoints
│   │   ├── storeRoutes.js        # Store management endpoints
│   │   └── tryonRoutes.js        # Try-on processing endpoints
│   │
│   ├── utils/                    # Utility functions
│   │   └── jobManager.js         # Async job management
│   │
│   └── server.js                 # Main application entry point
│
├── static/                       # Frontend static files
│   ├── css/                      # Stylesheets
│   ├── js/                       # JavaScript files
│   │   ├── app.js                # Main application logic
│   │   ├── config.js             # Frontend configuration
│   │   ├── tryon.js              # Try-on specific functionality
│   │   ├── controllers/          # UI controllers
│   │   │   ├── camera-controller.js   # Camera functionality
│   │   │   ├── form-controller.js     # Form handling
│   │   │   └── ui-controller.js       # UI interactions
│   │   └── services/             # Frontend services
│   │       ├── auth-service.js        # Authentication
│   │       ├── firebase-service.js    # Firebase interactions
│   │       ├── garment-service.js     # Garment management
│   │       ├── store-service.js       # Store operations
│   │       └── tryon-service.js       # Try-on requests
│   │
│   ├── Media/                    # Media assets
│   ├── pages/                    # HTML pages
│   │   ├── admin/                # Admin pages
│   │   │   ├── AdminDashBoard.html
│   │   │   └── StoreDashBoard.html
│   │   ├── main/                 # Main application pages
│   │   │   ├── index.html
│   │   │   ├── VTON.html
│   │   │   └── tryon.html
│   │   └── other/                # Additional pages
│   │       ├── ai-courses.html
│   │       ├── ai-solutions.html
│   │       └── vr-solutions.html
│   │
│   ├── uploads/                  # User uploads
│   │   ├── TryOn_Results/        # Generated try-on images
│   │   ├── VirtualTryOn_UserPhotos/  # User photos
│   │   └── VirtualTryOn_Images/  # Garment images
│   │
│   ├── temp/                     # Temporary files
│   ├── logs/                     # Client-side logs
│   ├── descriptions.json         # Product descriptions
│   ├── firestore-rules.json      # Firestore security rules
│   └── hash.js                   # Hash utility
│
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
├── Dockerfile                    # Docker configuration
├── docker-compose.yml            # Docker Compose configuration
├── package.json                  # Node.js dependencies
├── package-lock.json             # Dependency lock file
├── project-structure.md          # This document
├── README.md                     # Project documentation
├── reorganization.md             # Reorganization details
├── requirements.txt              # Python dependencies (if any)
└── serviceAccountKey.json        # Firebase credentials
```

## Key Organizational Principles

1. **Backend/Frontend Separation**:
   - `src/` contains all server-side code (Node.js/Express)
   - `static/` contains all client-side code and assets (HTML/CSS/JS)

2. **MVC-like Pattern**:
   - Routes define API endpoints
   - Controllers contain business logic
   - Services handle external operations
   - Configuration is separated from application code

3. **Frontend Organization**:
   - Pages are organized by function (admin, main, other)
   - JavaScript follows a modular architecture with services and controllers
   - Static assets (Media, CSS) are properly separated

4. **Security Considerations**:
   - Sensitive credentials are stored in environment variables
   - Firebase rules are properly configured
   - Sessions are securely managed

## Maintenance Guidelines

1. **Adding New Features**:
   - Server-side logic goes in the appropriate controller in `src/controllers/`
   - New API endpoints should be added to the relevant route file in `src/routes/`
   - Frontend functionality should be organized into appropriate service/controller modules

2. **File Organization**:
   - Keep related functionality together
   - Maintain clear separation between frontend and backend code
   - Use appropriate directories for different asset types

3. **Configuration Management**:
   - All environment-specific configuration should use environment variables
   - Frontend configuration should be loaded dynamically
   - Avoid hardcoding sensitive information 