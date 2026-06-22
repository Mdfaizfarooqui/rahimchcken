# Vercel Deployment Guide

This guide explains how to deploy **Rahim's Chicken**, which consists of a React (Vite) frontend and an Express + SQLite backend.

> [!WARNING]
> **Important Architecture Note for Vercel**
> Vercel is designed for static frontends and stateless serverless functions. Because Vercel's environment is serverless and its filesystem is read-only, **local SQLite databases (`chicken_shop.db`) will not persist data across requests.** Any changes made (e.g., placing orders or adding users) will be erased when the serverless function spins down. 

To deploy this application successfully, you have two recommended paths:

---

## Path 1: Deploy Frontend to Vercel, Backend to a VPS (Recommended for SQLite)

Because your backend uses **SQLite** for its database and **local file storage** for product images, it requires a **Persistent Disk Volume**. Without a disk, your database and uploaded images will be erased every time the server restarts.

**Fly.io** is a great option (up to 3GB free), but it requires a credit card for account verification. Here are other free persistent alternatives:

#### Alternative A: Alwaysdata (100MB Free Persistent Hosting)
- **Alwaysdata** offers a 100MB free hosting tier that supports Node.js and SQLite.
- Because it uses shared server environments, **all files written to the disk are naturally persistent** without having to mount separate volumes. 100MB is plenty for a lightweight SQLite database and menu files.
- Sign up at [alwaysdata.com](https://www.alwaysdata.com/) and follow their Node.js deployment guide.

#### Alternative B: Oracle Cloud Free Tier VPS (50GB Free Storage)
- Oracle Cloud offers an **Always Free tier** that includes two AMD Compute instances (VMs).
- It comes with **50 GB of persistent block volume storage** for free.
- You can launch a standard Ubuntu VM, install Node.js, clone your Git repository, and run your SQLite backend. It will never reset or lose files.

#### Alternative C: The "No-Disk" Architecture (Render Free Tier + Supabase + Cloudinary)
If you want to host on Render's free tier but don't want to pay for a persistent disk, you can modify the app to be **stateless**:
1. **Database**: Use a free PostgreSQL database on [Supabase](https://supabase.com/) or [Neon](https://neon.tech/) instead of SQLite.
2. **Images**: Modify your image upload endpoint in `server.js` to upload product images to [Cloudinary](https://cloudinary.com/) (which offers a generous free tier) instead of saving them locally.
3. Since no database or images are stored locally, you can deploy the backend on Render's free tier without needing any persistent disk!

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
