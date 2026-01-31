require('@testing-library/jest-dom')

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long'
process.env.MONGODB_URI = 'mongodb://localhost:27017/test'
process.env.MONGODB_DB_NAME = 'test'
process.env.NODE_ENV = 'test'
