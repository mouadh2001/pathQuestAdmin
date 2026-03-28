import jwt from "jsonwebtoken";

const playerAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "player") {
      return res.status(403).json({ message: "Not authorized as player" });
    }
    req.player = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default playerAuthMiddleware;
