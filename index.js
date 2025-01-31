const connection = require("./database/connection");
const express = require("express");
const cors = require("cors");

// Conexión a BD
connection();

// Crear servidor node
const app = express();
const port = 3090;

// Configurar CORS antes de cargar cualquier ruta
app.use(cors()); 

// Convertir datos del body a objetos js
app.use(express.json()); 
app.use(express.urlencoded({extended: true})); // Convertir datos en formato form-url-encoded en objetos js

// Cargar configuración rutas
const UserRoutes = require("./routes/user");
const LetterRoutes = require("./routes/letter");
const FollowRoutes = require("./routes/follow");
const CorrectedLetterRoutes = require("./routes/correctedLetter");

app.use("/api/user", UserRoutes);
app.use("/api/letter", LetterRoutes);
app.use("/api/follow", FollowRoutes);
app.use("/api/corrected", CorrectedLetterRoutes);


// Cargar rutas
app.get("/ruta-prueba", (req, res) => {
    return res.status(200).json(
        {
            "id": 1,
            "message": "Hola!!"
        }
    )
})

// Arrancar servidor
app.listen(port, () => {
    console.log("Server listening in port ", port);
})