const multer = require("multer");

// Store the file in memory and upload it with the official Cloudinary SDK in the controller.
const storage = multer.memoryStorage();

// Verify file extension and MIME type
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype) {
    cb(null, true); // Accept the file
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
