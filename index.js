const connection = require("./database/connection");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config({ path: ".env.local" });
// BD connection with error handling
connection().catch((error) => {
  console.error("Error connecting to database:", error);
  process.exit(1); // Stop the application if it can't connect to the database
});

// Crear servidor node
const app = express();
const port = 3090;

// Configurar CORS para permitir credenciales (cookies)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Convertir datos del body a objetos js
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Convertir datos en formato form-url-encoded en objetos js

// Parser de cookies
app.use(cookieParser());

// Load route configuration
const UserRoutes = require("./routes/user");
const LetterRoutes = require("./routes/letter");
const FollowRoutes = require("./routes/follow");
const CorrectedLetterRoutes = require("./routes/correctedLetter");

app.use(
  "/uploads/profile_pictures",
  express.static("uploads/profile_pictures"),
);
app.use("/api/user", UserRoutes);
app.use("/api/letter", LetterRoutes);
app.use("/api/follow", FollowRoutes);
app.use("/api/corrected", CorrectedLetterRoutes);

// Middleware para manejar rutas no encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Arrancar servidor
app.listen(port, () => {
  console.log("Server listening in port ", port);
});
