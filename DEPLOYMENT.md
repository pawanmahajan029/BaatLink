# BaatLink - Deployment Guide for Render

This guide will help you deploy the BaatLink WebRTC video conferencing application to Render.

## Prerequisites

- A Render account (sign up at [render.com](https://render.com))
- Your MongoDB Atlas connection string
- Git repository with your code pushed to GitHub/GitLab

## Deployment Steps

### 1. Push Your Code to Git

Make sure all your changes are committed and pushed to your Git repository:

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create a New Web Service on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** button and select **"Web Service"**
3. Connect your Git repository (GitHub/GitLab)
4. Select the **BaatLink** repository

### 3. Configure the Web Service

Fill in the following settings:

- **Name**: `baatlink` (or your preferred name)
- **Region**: Choose the closest region to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (or `.` if required)
- **Environment**: `Node`
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Plan**: Select **Free** (or your preferred plan)

### 4. Set Environment Variables

Click on **"Advanced"** and add the following environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Sets the environment to production |
| `PORT` | `10000` | Render's default port (auto-set) |
| `MONGODB_URI` | `your-mongodb-connection-string` | **REQUIRED**: Your MongoDB Atlas connection string |
| `FRONTEND_URL` | `https://your-app-name.onrender.com` | Your Render app URL (update after deployment) |

**Important**: Replace `your-mongodb-connection-string` with your actual MongoDB Atlas connection string from the `.env.example` file.

### 5. Deploy

1. Click **"Create Web Service"**
2. Render will automatically build and deploy your application
3. Wait for the deployment to complete (usually 2-5 minutes)

### 6. Update FRONTEND_URL

After the first deployment:

1. Copy your Render app URL (e.g., `https://baatlink.onrender.com`)
2. Go to **Environment** tab in your Render dashboard
3. Update the `FRONTEND_URL` variable with your actual Render URL
4. Click **"Save Changes"** - this will trigger a redeployment

## Post-Deployment Verification

### Test the Application

1. **Open your app**: Navigate to `https://your-app-name.onrender.com`
2. **Register**: Create a new account on the register page
3. **Login**: Log in with your credentials
4. **Create Meeting**: Click "New Meeting" to create a video room
5. **Test WebRTC**: Open the meeting link in another browser/incognito window
6. **Verify Features**:
   - Video and audio streaming
   - Chat functionality
   - Screen sharing
   - Room code sharing

### Check Logs

If something doesn't work:

1. Go to your Render dashboard
2. Click on your service
3. Go to **"Logs"** tab
4. Look for any error messages

## Common Issues & Solutions

### Issue: "Cannot connect to MongoDB"

**Solution**: 
- Verify your `MONGODB_URI` is correct
- Ensure your MongoDB Atlas IP whitelist includes `0.0.0.0/0` (allow all IPs)
- Check that your MongoDB user has the correct permissions

### Issue: "API calls failing"

**Solution**:
- Verify `FRONTEND_URL` is set to your actual Render URL
- Check browser console for CORS errors
- Ensure the URL doesn't have a trailing slash

### Issue: "WebRTC not connecting"

**Solution**:
- WebRTC requires HTTPS (Render provides this automatically)
- Check browser permissions for camera/microphone
- Try in a different browser or incognito mode

### Issue: "Application crashes on startup"

**Solution**:
- Check Render logs for specific error messages
- Verify all dependencies are in `package.json`
- Ensure `start` command is correct

## Environment Variables Reference

### Required Variables

- **MONGODB_URI**: Your MongoDB Atlas connection string
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/database`
  - Get this from MongoDB Atlas dashboard

### Optional Variables

- **PORT**: Automatically set by Render to `10000`
- **NODE_ENV**: Set to `production` for production environment
- **FRONTEND_URL**: Your Render app URL for CORS configuration

## Updating Your Application

To deploy updates:

1. Make changes to your code locally
2. Commit and push to your Git repository:
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
3. Render will automatically detect the changes and redeploy

## Free Tier Limitations

Render's free tier has some limitations:

- **Spin down after inactivity**: Apps spin down after 15 minutes of inactivity
- **Cold starts**: First request after spin down may take 30-60 seconds
- **750 hours/month**: Free tier includes 750 hours of runtime

For production use, consider upgrading to a paid plan for better performance.

## Support

If you encounter issues:

1. Check the [Render Documentation](https://render.com/docs)
2. Review the application logs in Render dashboard
3. Verify all environment variables are set correctly
4. Test locally first with `npm run dev` in the backend directory

## Security Notes

- Never commit `.env` files to Git (already in `.gitignore`)
- Keep your MongoDB credentials secure
- Regularly update dependencies for security patches
- Use strong passwords for user accounts

---

**Congratulations!** Your BaatLink application should now be live on Render! 🎉
