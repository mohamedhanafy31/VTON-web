# MetaVR Virtual Try-On Web Application

A comprehensive virtual try-on system that allows users to virtually try on clothing items using AI-powered image processing.

## Features

### Enhanced User Registration & Security
- **Comprehensive Password Validation**: 
  - Minimum 8 characters
  - Must contain uppercase, lowercase, numbers, and special characters
  - Maximum 128 characters
  - Real-time password strength indicator
- **Username Validation**:
  - 3-30 characters
  - Alphanumeric, underscores, and hyphens only
  - Cannot start with numbers, underscores, or hyphens
- **Email Validation**:
  - RFC-compliant email format checking
  - Maximum 254 characters
  - Real-time availability checking
- **Phone Number Validation**:
  - 10-15 digits
  - International format support
- **Rate Limiting**: Maximum 5 registration attempts per 15 minutes per IP
- **Input Sanitization**: Automatic whitespace trimming and format normalization

### Core Functionality
- Virtual try-on with AI-powered image processing
- User management and authentication
- Admin dashboard for system management
- Store management system
- Order tracking and management
- Trial system with configurable limits

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see `env.example`)
4. Set up database and Firebase configuration
5. Run the application: `npm start`

## API Endpoints

### Authentication
- `POST /auth/register` - User registration with enhanced validation
- `POST /auth/login` - User login
- `GET /auth/check-email/:email` - Check email availability
- `GET /auth/check-username/:username` - Check username availability
- `POST /auth/logout` - User logout

### User Management
- `GET /auth/profile` - Get user profile
- `GET /auth/validate-session` - Validate user session

## Security Features

- **Password Security**: Strong password requirements with complexity validation
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive server-side and client-side validation
- **Session Management**: Secure session handling with expiration
- **Data Sanitization**: Automatic input cleaning and normalization
- **Access Control**: Role-based access control for admin functions

## Validation Rules

### Password Requirements
- Minimum length: 8 characters
- Maximum length: 128 characters
- Must contain at least one lowercase letter
- Must contain at least one uppercase letter
- Must contain at least one number
- Must contain at least one special character (@$!%*?&)

### Username Requirements
- Length: 3-30 characters
- Allowed characters: letters, numbers, underscores, hyphens
- Cannot start with numbers, underscores, or hyphens

### Email Requirements
- Valid RFC-compliant email format
- Maximum length: 254 characters
- Must be unique in the system

### Phone Requirements
- Length: 10-15 digits
- International format support
- Basic format validation

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License. 