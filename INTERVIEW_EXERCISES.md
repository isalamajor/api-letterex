# ENTREVISTA TÉCNICA - Ejercicios y Preguntas Esperadas

## SECCIÓN 1: PREGUNTAS CONCEPTUALES

### Sobre JWT y Autenticación

**P1: ¿Cuál es la diferencia entre JWT almacenado en LocalStorage vs Cookie?**

```
Your answer guide:
- Cookie httpOnly:
  • No es accesible desde JavaScript (previene XSS)
  • Se envía automáticamente en cada request
  • Vulnerable a CSRF (por eso SameSite)

- LocalStorage:
  • Accesible desde JS (más flexible pero riesgo XSS)
  • No se envía automáticamente
  • Vulnerable a XSS (script malicioso accede localStorage)

Tu API: Usas cookies httpOnly (decisión correcta)
```

**P2: ¿Qué es un "payload" en JWT?**

```
Response esperado:
- Datos codificados en el JWT: id, nickname, email, idiomas, rol...
- NO son secretos (está en base64, fácil de decodificar)
- Se valida la FIRMA (no que no haya sido modificado)
- Típico: { id, email, role, iat (creación), exp (expiración) }
```

**P3: ¿Por qué es importante la expiración del token?**

```
Razones:
- Si se roba, no es válido forever
- Fuerza re-autenticación periódica
- Mejor con refresh tokens: access token corto (15m) + refresh token largo (30d)
```

---

### Sobre Bases de Datos

**P4: ¿Qué es un "upsert" y cuándo lo usarías?**

```
Tu código:
VerificationCode.findOneAndUpdate(
  { email },
  { code, expiresAt, verified: false, purpose },
  { new: true, upsert: true }  ← AQUÍ
)

Explicación:
- Intenta buscar y actualizar
- Si no existe, CREATE uno nuevo
- Caso de uso perfecto: códigos de verificación (siempre hay 1 por email)
- Evita duplicados y lógica if-else compleja
```

**P5: ¿Qué diferencia hay entre .findByIdAndUpdate() y .updateOne()?**

```
.findByIdAndUpdate():
- Retorna el documento (viejo o nuevo según { new: true })
- Más lento (requiere otra consulta)
- Útil cuando necesitas retornar datos

.updateOne() / .updateMany():
- NO retorna el documento
- Más rápido
- Útil para actualizaciones masivas silenciosas

Tu ejemplo es correcto (necesitas retornar el usuario actualizado)
```

**P6: ¿Cómo evitarías N+1 queries en getFriends()?**

```
Tu código ACTUAL (problema):
getFriends:
  1. await Follow.find() → 1 query
  2. friendDetails = Promise.all(friendIds.map(...))  ← forEach su propia query

MEJOR con aggregation pipeline $lookup:
await Follow.aggregate([
  { $match: { user1: userId } },
  {
    $lookup: {
      from: "users",
      localField: "user2",
      foreignField: "_id",
      as: "friendData"
    }
  }
])

1 query en lugar de N+2
```

---

## SECCIÓN 2: PROBLEMAS Y SOLUCIONES

### Problema 1: Security Vulnerability (REAL)

**P7: En login, ¿hay vulnerabilidad si alguien intenta múltiples contraseñas?**

```javascript
// Tu código
let pwd = await bcrypt.compare(params.password, user.password); // ✓ OK
if (!pwd) {
  return res.status(200).json({ status: 2, message: "Wrong password" });
}
```

**Respuesta esperada:**

```
VULNERABILIDAD: Falta rate limiting
- Alguien puede hacer brute force (probar 10,000 contraseñas/segundo)
- bcrypt.compare tarda ~100ms (propósito), pero sin límite es débil

SOLUCIÓN:
- IP-based rate limiting (máx 5 intentos por IP en 15 minutos)
- User-based rate limiting (máx 3 intentos por usuario)
- Usar express-rate-limit middleware
- Lockear cuenta después de N intentos

Código de ejemplo:
const rateLimit = require("express-rate-limit");
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de login, intenta más tarde"
});
router.post("/login", loginLimiter, UserController.login);
```

---

### Problema 2: Email Validation

**P8: ¿Cómo validarías emails de forma segura?**

```javascript
// Tu código ACTUAL
if (!email) return res.status(400).json({ message: "Email requerido" });
// ✗ No valida que sea email válido

// DEBERÍA SER:
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ message: "Email inválido" });
}

// O usar librería (mejor):
const validator = require("validator");
if (!validator.isEmail(email)) {
  return res.status(400).json({ message: "Email inválido" });
}
```

**Respuesta esperada:**

```
Mejores prácticas:
- Validar formato (regex o librería)
- Verificar que NO sea TLD temporal (.temp, .test)
- Enviar email con link de confirmación (double opt-in)
- En producción: verificar DNS MX records
```

---

### Problema 3: File Upload Security

**P9: ¿Está segura la subida de archivos en profile-picture?**

```javascript
// Tu código
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true); // ✓ Bueno
  }
};
```

**Vulnerabilidades posibles y soluciones:**

```javascript
// PROBLEMA 1: Alguien renombra .exe a .jpg
// SOLUCIÓN: Ya estás haciendo validación dual ✓

// PROBLEMA 2: Malicious JPEG contiene código JS
// SOLUCIÓN: Usar librería sharp para re-encodificar
const sharp = require("sharp");
const processedImage = await sharp(req.file.path)
  .resize(200, 200) // Fuerza re-encoding
  .toFile(destPath);

// PROBLEMA 3: Alguien sube 1GB
// SOLUCIÓN: límite en multer (ya tienes 5MB) ✓

// PROBLEMA 4: Path Traversal: usuario.jpg/../../../etc/passwd
// SOLUCIÓN: Usar UUID en lugar de userId
const filename = `${uuid()}${ext}`; // ← Mejor

// PROBLEMA 5: Disk fill with million uploads
// SOLUCIÓN: Quota por usuario, limpieza automática
```

---

## SECCIÓN 3: CÓDIGO CHALLENGE

### Challenge 1: Implementar Cursor-based Pagination

**P10: Tu paginación actual (offset/limit) tiene problemas con datos que cambian. Implementa cursor-based pagination.**

```javascript
// TU ACTUAL (offset/limit):
const users = await User.find()
  .skip((page - 1) * itemsPerPage)
  .limit(itemsPerPage);
// PROBLEMA: Si elemento se elimina entre páginas, datos se saltan

// SOLUCIÓN - Cursor Based:
const ITEMS_PER_PAGE = 10;

app.get("/users", async (req, res) => {
  const cursor = req.query.cursor || null;
  let query = {};

  if (cursor) {
    query._id = { $gt: cursor }; // Mayor que el último ID visto
  }

  const users = await User.find(query)
    .limit(ITEMS_PER_PAGE + 1) // Traer 1 más para saber si hay siguiente página
    .sort({ _id: 1 });

  const hasNextPage = users.length > ITEMS_PER_PAGE;
  if (hasNextPage) users.pop(); // Remover el extra

  const nextCursor = users.length > 0 ? users[users.length - 1]._id : null;

  return res.json({
    users,
    nextCursor, // En lugar de nextPage
    hasNextPage,
  });
});

// CLIENTE:
// Primera página: GET /users
// Segunda: GET /users?cursor=<id_del_último_usuario>
```

---

### Challenge 2: Implementar Soft Delete

**P11: En Letter, tienes un campo `deleted: boolean` pero no lo usas. Implementa soft delete.**

```javascript
// ACTUAL
const deleteLetters = async (req, res) => {
  const { letterIds } = req.body;
  const deleted = await Letter.deleteMany({ _id: { $in: letterIds } });
  // PROBLEMA: Se elimina PERMANENTEMENTE
};

// MEJOR - Soft Delete:
const deleteLetters = async (req, res) => {
  const { letterIds } = req.body;
  const userId = req.user.id;

  // Verificar que el usuario es propietario de TODAS las cartas
  const letters = await Letter.find({ _id: { $in: letterIds } });
  for (let letter of letters) {
    if (letter.author.toString() !== userId) {
      return res.status(403).json({ message: "No authorized" });
    }
  }

  // Marcar como eliminadas (soft delete)
  const deleted = await Letter.updateMany(
    { _id: { $in: letterIds } },
    { deleted: true, deleted_at: new Date() }
  );

  return res.json({ status: "success", deletedCount: deleted.modifiedCount });
};

// IMPORTANTE: Actualizar todos los queries:
// En listLetters:
const letters = await Letter.find({
  author: userId,
  deleted: { $ne: true }  // ← NO mostrar eliminadas
});

// En profile / countLetters:
{{ $match: { author: userId, deleted: { $ne: true } } }
```

---

### Challenge 3: Implementar Rol-based Access Control (RBAC)

**P12: Actualmente todos los usuarios tienen el mismo rol. Implementa RBAC.**

```javascript
// MODELO
const userSchema = new Schema({
  role: {
    type: String,
    enum: ["user", "moderator", "admin"],
    default: "user",
  },
});

// MIDDLEWARE
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Requiere role: ${allowedRoles.join(" o ")}`,
      });
    }
    next();
  };
};

// USO EN RUTAS
router.delete(
  "/users/:id",
  auth.authentificate,
  requireRole(["admin"]),
  UserController.adminDeleteUser,
);

router.post(
  "/community",
  auth.authentificate,
  requireRole(["moderator", "admin"]),
  CommunityController.createCommunity,
);
```

---

### Challenge 4: Logging y Auditoría

**P13: ¿Cómo implementarías logging de acciones sensibles?**

```javascript
// CREAR modelo de Audit
const auditSchema = new Schema({
  userId: String,
  action: String, // "delete_account", "change_password", "share_letter"
  resource: String, // "Letter", "User", "Community"
  resourceId: String,
  before: Object, // Estado anterior
  after: Object, // Estado nuevo
  ip: String,
  timestamp: { type: Date, default: Date.now },
});

// USAR en deleteAccount:
const { deleteAccount } = req.body;
const audit = new Audit({
  userId,
  action: "delete_account",
  resource: "User",
  resourceId: userId,
  before: { email: user.email }, // Qué había
  after: { deleted: true }, // Qué quedó
  ip: req.ip,
});
await audit.save();

// VERIFICAR AUDITORÍA
router.get(
  "/admin/audit",
  auth.authentificate,
  requireRole(["admin"]),
  async (req, res) => {
    const logs = await Audit.find().sort({ timestamp: -1 });
    return res.json(logs);
  },
);
```

---

## SECCIÓN 4: DISEÑO Y ARQUITECTURA

### P14: ¿Cómo organizarías la API si creciera a 50 endpoints?

```
ESTRUCTURA RECOMENDADA:

api-letterex/
├── src/
│   ├── config/
│   │   └── database.js
│   │   └── env.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validation.js
│   │   ├── errorHandler.js
│   │   └── cors.js
│   ├── models/
│   │   └── ...
│   ├── controllers/
│   │   ├── v1/
│   │   │   ├── userController.js
│   │   │   ├── letterController.js
│   │   └── v2/
│   │   │   └── userController.js (versión nueva)
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── users.js
│   │   │   └── index.js
│   │   └── v2/
│   ├── services/
│   │   ├── emailService.js
│   │   ├── jwtService.js
│   │   ├── userService.js
│   ├── utils/
│   │   ├── validators.js
│   │   ├── helpers.js
│   │   └── logger.js
│   ├── constants/
│   │   └── errors.js
│   └── app.js
├── tests/
│   ├── unit/
│   └── integration/
└── package.json

BENEFICIOSVersioning: /api/v1 vs /api/v2
- Services: lógica reutilizable
- Separación clara de concerns
- Fácil testear componentes individuales
- Escalable
```

---

## SECCIÓN 5: TESTING

### P15: ¿Cómo testearías el login?

```javascript
// test/integration/login.test.js
const request = require("supertest");
const app = require("../../src/app");

describe("POST /api/user/login", () => {
  test("Login exitoso con email", async () => {
    const res = await request(app).post("/api/user/login").send({
      email: "test@example.com",
      password: "Password123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(0);
    expect(res.body.userData).toHaveProperty("id");
    expect(res.body.userData).toHaveProperty("countLetters");
    expect(res.headers["set-cookie"][0]).toContain("authToken"); // Cookie presente
  });

  test("Fallo con contraseña incorrecta", async () => {
    const res = await request(app).post("/api/user/login").send({
      email: "test@example.com",
      password: "WrongPassword",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(2); // Wrong password code
  });

  test("Fallo sin usuario registrado", async () => {
    const res = await request(app).post("/api/user/login").send({
      email: "nonexistent@example.com",
      password: "Password123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(1); // Not registered code
  });
});
```

---

## CHECKLIST ANTES DE ENTREVISTA

- [ ] Entender COMPLETAMENTE el flujo de login
- [ ] Practicar explicar JWT en 2 minutos
- [ ] Conocer diferencia SQL vs NoSQL y cuándo usar cada una
- [ ] Saber qué es aggregation pipeline de MongoDB
- [ ] Entender CORS, SameSite, httpOnly
- [ ] Tener ejemplos de cómo mejorar performance
- [ ] Conocer al menos 3 vulnerabilidades de seguridad
- [ ] Practicar escribir un endpoint completo en 10 minutos
- [ ] Saber explicar por qué usas bcrypt vs md5
- [ ] Tener preguntas PARA ellos (cultura, tech stack, desafíos)
