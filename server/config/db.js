// MongoDB Mongoose Connection Module
// If MONGODB_URI is provided in environment variables, connects to real MongoDB database.
// Otherwise falls back smoothly to in-memory JSON store.

export const connectDB = async () => {
  if (process.env.MONGODB_URI) {
    try {
      const mongoose = await import('mongoose');
      const conn = await mongoose.default.connect(process.env.MONGODB_URI);
      console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ MongoDB connection error: ${error.message}. Running in dual in-memory mode.`);
      return false;
    }
  } else {
    console.log(`ℹ️ No MONGODB_URI configured. Operating with high-performance memory store.`);
    return false;
  }
};

