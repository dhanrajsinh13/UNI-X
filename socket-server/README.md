# UNI-X Socket.IO Server

Standalone Socket.IO server for real-time messaging and notifications.

## Environment Variables

Create a `.env` file with:

```env
PORT=3001
JWT_SECRET=your-jwt-secret-key
FRONTEND_URL=https://your-app.vercel.app
API_BASE_URL=https://your-app.vercel.app
```

## Local Development

```bash
npm install
npm run dev
```

## Production Deployment (Render)

1. Push this folder to GitHub
2. Create a new Web Service on Render
3. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `JWT_SECRET`: (same as your main app)
     - `FRONTEND_URL`: Your Vercel URL
     - `API_BASE_URL`: Your Vercel URL

## Testing

Test the server is running:
```
curl https://your-render-url.onrender.com/health
```

## CORS Configuration

The server accepts connections from:
- Local development: `http://localhost:3000`
- Production: URLs specified in `FRONTEND_URL` environment variable
- Additional Vercel URLs can be added in `server.js`
