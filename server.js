require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const User = require('./models/User');

// ---------- Routes ----------
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/ProductRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const staffRoutes = require('./routes/staff');
const leaveRoutes = require('./routes/leaves');
const resignationRoutes = require('./routes/resignation');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// ---------- Middleware ----------
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Allow both local and deployed frontends to access backend
app.use(cors({
  origin: [
    'https://cochinlive-frontend.onrender.com', // deployed frontend
    'http://localhost:8080' // local dev
  ],
  credentials: true,
}));

// ---------- Session & Passport Setup ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true only in production
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ✅ Passport serialize/deserialize setup
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// ---------- MongoDB Connection ----------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Create default admin if not exists
    const adminEmail = 'admincd@gmail.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      const adminUser = new User({
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
      });
      await adminUser.save();
      console.log('🟢 Default admin user created');
    } else {
      console.log('ℹ️ Admin user already exists');
    }
  })
  .catch((err) => console.error('❌ MongoDB Error:', err.message));

// ---------- Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/resignations", resignationRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);

// ---------- Test Route ----------
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
