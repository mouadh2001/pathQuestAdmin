import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";

const authMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : authorization;

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;

    // Fetch admin email and attach to request
    const admin = await Admin.findById(decoded.id);
    if (admin) {
      req.adminEmail = admin.email;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;
