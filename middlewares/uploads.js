const multer = require("multer");
const path = require("path");

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/profile_pictures"); // Folder where images will be saved
  },
  filename: (req, file, cb) => {
    // Usa el ID del usuario (desde el token) como nombre del archivo
    const ext = path.extname(file.originalname);
    const filename = `${req.user.id}${ext}`;
    cb(null, filename);
  },
});

// Verify extension and mimetype
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true); // Aceptar el archivo
  } else {
    cb(new Error("Formato de archivo no permitido. Solo JPEG, JPG y PNG."));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Maximum size of 5 MB
  fileFilter,
});

module.exports = upload;
