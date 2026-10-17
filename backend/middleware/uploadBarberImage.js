const fs     = require('fs');
const path   = require('path');
const multer = require('multer');

const BARBER_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'barbers');
fs.mkdirSync(BARBER_IMAGE_DIR, { recursive: true });

const ALLOWED_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BARBER_IMAGE_DIR),
  filename: (req, file, cb) => {
    const ext      = ALLOWED_MIME_EXT[file.mimetype];
    const barberId = req.user.barber_id;
    cb(null, `barber_${barberId}_${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_EXT[file.mimetype]) {
    return cb(new Error('Only JPG and PNG images are allowed.'));
  }
  cb(null, true);
};

const uploadBarberImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
});

module.exports = uploadBarberImage;
