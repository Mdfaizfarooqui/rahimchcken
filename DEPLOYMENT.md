# Vercel Deployment Guide

This guide explains how to deploy **Rahim's Chicken**, which consists of a React (Vite) frontend and an Express + SQLite backend.

> [!WARNING]
> **Important Architecture Note for Vercel**
> Vercel is designed for static frontends and stateless serverless functions. Because Vercel's environment is serverless and its filesystem is read-only, **local SQLite databases (`chicken_shop.db`) will not persist data across requests.** Any changes made (e.g., placing orders or adding users) will be erased when the serverless function spins down. 

To deploy this application successfully, you have two recommended paths:

---

## Path 1: Deploy Frontend to Vercel, Backend to a VPS/PaaS (Recommended for SQLite)

If you want to keep your current SQLite database setup without changing any code, you should host your frontend on Vercel, and host your Node/Express backend on a service that provides persistent storage (like Render, Railway, or Fly.io).

### 1. Deploy the Backend
1. Create a new service on **Render**, **Railway**, or **Fly.io**.
2. Connect your GitHub repository.
3. Set the Root Directory to `./` and the Start Command to `npm start --prefix server` (or `node server/server.js`).
4. Ensure the service has a **Persistent Disk Volume** mounted to the `server/` directory so the `chicken_shop.db` file isn't lost on restarts.
5. Note your live backend URL (e.g., `https://rahim-chicken-api.onrender.com`).

### 2. Deploy the Frontend to Vercel
1. In your `vite.config.js`, change the proxy target to point to your live backend URL instead of `http://localhost:3001` (or remove the proxy entirely and configure your `App.jsx` fetch calls to use an environment variable like `import.meta.env.VITE_API_URL`).
2. Push your code to GitHub.
3. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
4. Import your GitHub repository.
5. Vercel will automatically detect **Vite**.
6. Set the Build Command to `npm run build` and Output Directory to `dist`.
7. Click **Deploy**.

---

## Path 2: Deploy Everything to Vercel (Requires Database Migration)

If you want to host both the frontend and backend entirely on Vercel, you must migrate away from SQLite to a cloud database (like Vercel Postgres, Supabase, or Neon).

### 1. Migrate Database Code
1. Install the `pg` (PostgreSQL) package: `npm install pg`
2. Rewrite `server/database.js` to connect to a PostgreSQL connection string instead of a local SQLite file.
3. Update any SQL queries that are specific to SQLite (though standard `INSERT` and `SELECT` are mostly identical).

### 2. Add `vercel.json`
To tell Vercel how to route your API requests to your Express serverless functions, create a `vercel.json` file in your root directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/server.js"
    },
    {
      "src": "/uploads/(.*)",
      "dest": "/server/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 3. Deploy
1. Push your code to GitHub.
2. Import the project into Vercel.
3. Under Environment Variables, add your `DATABASE_URL` (your Postgres connection string).
4. Click **Deploy**. Vercel will build the React app and convert `server.js` into a serverless function.

---

## Important Considerations

- **Server-Sent Events (SSE)**: Standard SSE streams (like the one used in `server.js` for real-time tracking) can be problematic on serverless platforms because serverless functions have maximum execution timeouts (usually 10 to 60 seconds). If you go with Path 2, you may need to implement a third-party real-time service like Pusher or Supabase Realtime, or switch to short-polling on the frontend.
- **Image Uploads**: The current code uses `multer` to save images to a local `server/uploads` directory. On Vercel, this will fail. You must migrate image uploads to an object storage service like Amazon S3, Vercel Blob, or Cloudinary.
