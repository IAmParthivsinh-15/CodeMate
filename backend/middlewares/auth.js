import jwt from "jsonwebtoken";
import User from "../model/user.js";

const protectRoutes = async (req, res, next) => {
  try {
    let token;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // If no token in header, check cookies
    if (!token && req.cookies) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({ 
        message: "Not authorized, no token provided",
        authHeader: req.headers.authorization,
        cookies: req.cookies 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({ 
      message: "Not authorized, token failed",
      error: error.message 
    });
  }
};

export default protectRoutes;
