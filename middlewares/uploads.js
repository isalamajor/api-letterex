const multer = require("multer");

// Store file in memory and upload with Cloudinary official SDK in controller.
const storage = multer.memoryStorage();

// Verify extension and mimetype
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype) {
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
