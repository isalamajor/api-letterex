const connection = require("./database/connection");
const express = require("express");
const cors = require("cors");
require('dotenv').config({ path: '.env.local' }); // Cargar variables de entorno desde el archivo .env

// Conexión a BD con manejo de errores
connection().catch(error => {
    console.error("Error connecting to the database", error);
    process.exit(1); // Detiene la aplicación si no se puede conectar a la base de datos
});

// Crear servidor node
const app = express();
const port = 3090;

// Configurar CORS antes de cargar cualquier ruta
app.use(cors()); 

// Convertir datos del body a objetos js
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); // Convertir datos en formato form-url-encoded en objetos js

// Cargar configuración rutas
const UserRoutes = require("./routes/user");
const LetterRoutes = require("./routes/letter");
const FollowRoutes = require("./routes/follow");
const CorrectedLetterRoutes = require("./routes/correctedLetter");

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
