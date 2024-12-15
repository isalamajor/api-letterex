const multer = require("multer");
const path = require("path");

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./uploads/profile_pictures"); // Carpeta donde se guardarán las imágenes
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Renombrar el archivo con un timestamp único
    }
});

// Verificar extensión y mimetype
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true); // Aceptar el archivo
    } else {
        cb(new Error("Formato de archivo no permitido. Solo JPEG, JPG y PNG."));
    }
};

const upload = multer({
    storage,
    //limits: { fileSize: 5 * 1024 * 1024 }, // Tamaño máximo de 5 MB
    fileFilter
});

module.exports = upload;
