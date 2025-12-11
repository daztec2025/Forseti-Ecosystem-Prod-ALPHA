# Forseti - Esports Performance Analytics Platform

Forseti is a comprehensive esports performance analytics platform designed for racing simulators, with initial support for iRacing. It provides real-time telemetry recording, lap analysis, and performance insights to help drivers improve their skills.

## 🚀 Features

### Core Functionality
- **Real-time Telemetry Recording**: Automatic session recording with iRacing integration
- **Lap Analysis**: Detailed telemetry analysis with turn-by-turn breakdowns
- **Performance Tracking**: Track improvements over time with engagement points and levels
- **Social Features**: Follow other drivers, share activities, and comment on sessions
- **Forseti Analyst**: Advanced telemetry visualization and reference lap comparisons

### Technical Features
- **Cross-Platform**: Desktop (Electron), Web (Next.js), and Mobile (React Native)
- **Real-time Overlay**: Non-intrusive overlay that works in fullscreen mode
- **Secure API**: JWT authentication, rate limiting, and input validation
- **Scalable Database**: SQLite with Prisma ORM and optimized indexes
- **Type Safety**: Full TypeScript implementation across all applications

## 🏗️ Architecture

```
forseti-app/
├── apps/
│   ├── api/          # Node.js/Express API server
│   ├── web/          # Next.js web application
│   ├── electron/     # Electron desktop application
│   ├── mobile/       # React Native mobile app
│   └── mobile-expo/  # Expo React Native app
├── packages/
│   ├── telemetry-recorder/  # Shared telemetry recording logic
│   ├── types/               # Shared TypeScript types
│   ├── ui/                  # Shared UI components
│   └── eslint-config/       # Shared ESLint configuration
└── forseti-iracing-bridge/  # Python bridge for iRacing integration
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (for iRacing bridge)
- iRacing installed (for telemetry recording)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd forseti-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   cd apps/api
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. **Configure environment variables**
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your configuration
   ```

5. **Start the development servers**
   ```bash
   # API Server
   cd apps/api && npm run dev

   # Web Application
   cd apps/web && npm run dev

   # Electron App
   cd apps/electron && npm run dev
   ```

## 🔧 Configuration

### API Configuration (`apps/api/config.js`)

Key configuration options:

- **Database**: SQLite database path
- **JWT**: Secret key for authentication tokens
- **Rate Limiting**: Request limits per IP address
- **CORS**: Allowed origins for cross-origin requests
- **Security**: Bcrypt rounds and validation rules

### Environment Variables

Create a `.env` file in `apps/api/`:

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET="your-super-secret-jwt-key"

# Server Configuration
PORT=4000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

## 🔒 Security Features

### API Security
- **Helmet.js**: Security headers and XSS protection
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: Comprehensive request validation and sanitization
- **CORS Configuration**: Controlled cross-origin access
- **JWT Authentication**: Secure token-based authentication

### Data Protection
- **Password Hashing**: Bcrypt with configurable rounds
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **XSS Prevention**: Input sanitization and output encoding
- **CSRF Protection**: Same-origin policy enforcement

## 📊 Performance Optimizations

### Database
- **Indexes**: Optimized indexes on frequently queried fields
- **Query Optimization**: Efficient Prisma queries with proper includes
- **Connection Pooling**: Managed database connections
- **Migration Management**: Versioned database schema changes

### Frontend
- **Code Splitting**: Dynamic imports for better bundle sizes
- **Image Optimization**: Next.js automatic image optimization
- **Caching**: API response caching and static asset caching
- **Lazy Loading**: Component and route-based lazy loading

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   JWT_SECRET="your-production-secret"
   ALLOWED_ORIGINS="https://your-domain.com"
   ```

2. **Database Migration**
   ```bash
   npm run prisma:migrate:deploy
   ```

3. **Build Applications**
   ```bash
   # API
   cd apps/api && npm install --production

   # Web
   cd apps/web && npm run build

   # Electron
   cd apps/electron && npm run build
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]
```

## 🧪 Testing

### Running Tests
```bash
# API Tests
cd apps/api && npm test

# Web Tests
cd apps/web && npm test

# All Tests
npm run test
```

### Test Coverage
```bash
npm run test:coverage
```

## 📈 Monitoring

### Health Checks
- **API Health**: `GET /api/health`
- **Database Status**: Automatic connection monitoring
- **Performance Metrics**: Request timing and error rates

### Logging
- **Request Logging**: All API requests with timestamps
- **Error Logging**: Detailed error information (sanitized in production)
- **Performance Logging**: Slow query detection and optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Consistent code formatting and style
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Standardized commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discord**: Join our community Discord for real-time support

## 🔮 Roadmap

### Upcoming Features
- [ ] Additional simulator support (Assetto Corsa, F1 2024)
- [ ] Advanced analytics and machine learning insights
- [ ] Team management and collaboration features
- [ ] Mobile app with offline capabilities
- [ ] Cloud sync and backup
- [ ] Custom dashboard widgets
- [ ] Integration with streaming platforms

### Performance Improvements
- [ ] Database query optimization
- [ ] Real-time WebSocket connections
- [ ] Progressive Web App (PWA) features
- [ ] Advanced caching strategies
- [ ] CDN integration for static assets