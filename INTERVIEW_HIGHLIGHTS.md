# Letterex API - Puntos Clave para Entrevista

## 1. FLUJO DE VERIFICACIÓN CON CÓDIGO TEMPORAL ⭐⭐⭐

**Por qué es interesante:**

- Demuestra manejo de seguridad (hashing con bcrypt)
- Lógica reutilizable con parámetros flexibles
- Gestión de estados (usado/no usado, expiración)
- Validación en tiempo real

**Ubicación:** `controllers/user.js` (líneas 100-155)

```javascript
const _validateVerificationCode = async (
  email,
  code,
  purpose,
  markAsUsed = true,
  allowAlreadyUsed = false,
) => {
  // 1. Valida propósito permitido (register, password_reset)
  // 2. Compara código (bcrypt.compare) - tiempo constante
  // 3. Verifica expiración (7 minutos)
  // 4. Marca como usado opcionalmente (reutilizable)
  // 5. Retorna resultado con error o éxito
};
```

**Preguntas esperadas:**

- "¿Por qué usar Set en lugar de array?" → De-duplicación, O(1) lookup
- "¿Para qué sirven los parámetros opcionales?" → Diferenciar entre verificación inicial y reseteo
- "¿Cómo mejorías la seguridad?" → Rate limiting, IP throttling, logs de intentos

---

## 2. AGREGACIÓN MONGODB CON GROUPING ⭐⭐⭐

**Por qué es interesante:**

- Pipeline MongoDB complejo
- Trasformación de datos al vuelo
- Usado en múltiples endpoints (login, profile)
- Optimización (aggregation framework vs loops)

**Ubicación:** `controllers/user.js` (líneas 419-428)

```javascript
// PROBLEMA: Contar cartas por idioma
const countsByLanguage = await Letter.aggregate([
  { $match: { author: user.id } }, // Filtro
  { $group: { _id: "$language", count: { $sum: 1 } } }, // Agrupar y contar
]);

// TRANSFORMAR resultado a objeto
const countLetters = countsByLanguage.reduce((acc, item) => {
  acc[item._id] = item.count; // { "Spanish": 5, "French": 2 }
  return acc;
}, {});
```

**Preguntas esperadas:**

- "¿Qué ventajas tiene aggregation vs .find() + loops?" → Performance, menos datos en memoria
- "¿Por qué "\_id"?" → Resultado por defecto de MongoDB
- "¿Cómo optimizarías esto?" → Índices en author + language

---

## 3. AUTENTICACIÓN CON JWT EN COOKIES ⭐⭐

**Por qué es interesante:**

- Seguridad (httpOnly, SameSite)
- Validación con expiración
- Extrae datos del token en middleware

**Ubicación:**

- JWT crear: `services/jwt.js` (líneas 6-20)
- JWT verificar: `middlewares/auth.js` (líneas 1-41)
- JWT usar: `controllers/user.js` (línea 357)

```javascript
// CREAR TOKEN
const payload = {
  id: user._id,
  nickname: user.nickname,
  iat: moment().unix(),
  ex: moment().add(10, "days").unix()  // Expira en 10 días
};
return jwt.encode(payload, secret);

// VERIFICAR TOKEN (Middleware)
const token = req.cookies.authToken;  // De la cookie
let payload = jwt.decode(token, secret);
if (payload.exp <= moment().unix()) {
  return res.status(401).json({ message: "Token expirado" });
}
req.user = payload;  // Disponible en controladores

// USAR EN RESPUESTA
.cookie("authToken", token, {
  httpOnly: true,        // No accesible desde JavaScript (XSS protection)
  secure: process.env.NODE_ENV === "production",  // Solo HTTPS
  sameSite: "strict",    // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000  // 30 días
})
```

**Preguntas esperadas:**

- "¿Por qué httpOnly?" → Prevenir robo por JavaScript
- "¿Diferencia entre session vs JWT?" → JWT es stateless, escalable
- "¿Y refresh tokens?" → Posible mejora: access token corto + refresh token largo

---

## 4. VALIDACIÓN INTELIGENTE CON DUPLICADOS + LÍMITES ⭐⭐

**Por qué es interesante:**

- Evita duplicados en compartir cartas
- Valida límites (máx 2 personas)
- Reutilizable en otros contextos

**Ubicación:** `controllers/letter.js` (líneas 367-405)

```javascript
// PROBLEMA: Compartir carta solo con 2 personas, sin duplicados
const existingSharedWith = letter.sharedWith.map((id) => id.toString());
const newUsersToShare = sharedWith.filter(
  (friendId) => !existingSharedWith.includes(friendId.toString()),
);

// Validar límite
const totalSharedWith = existingSharedWith.length + newUsersToShare.length;
if (totalSharedWith > 2) {
  return res.status(400).json({
    message: `Cannot share with more than 2 people...`,
  });
}

// Solo crear CorrectedLetter para nuevos usuarios
newUsersToShare.map(async (friendId) => {
  // crear correctedLetter
});
```

**Preguntas esperadas:**

- "¿Por qué .toString()?" → Comparar ObjectId con string
- "¿Qué pasa con validación de IDs válidos?" → Mejora: validar con ObjectId.isValid()
- "¿Y si alguien intenta manipular el array?" → Validación en frontend + backend

---

## 5. BÚSQUEDA CON REGEX + PAGINACIÓN ⭐⭐

**Por qué es interesante:**

- Case-insensitive search
- Paginación correcta
- Método personalizado de Mongoose

**Ubicación:** `controllers/user.js` (líneas 740-775)

```javascript
// BÚSQUEDA
const searchRegex = new RegExp(searchTerm, "i"); // "i" = no case sensitive
const users = await User.find({
  $or: [{ nickname: searchRegex }, { email: searchRegex }],
})
  .select("-password -role") // Excluir sensibles
  .sort("_id")
  .paginate(page, itemsPerPage); // Método personalizado

// CONTAR TOTAL (importante para UI)
const totalUsers = await User.countDocuments({
  $or: [{ nickname: searchRegex }, { email: searchRegex }],
});

return res.status(200).json({
  users,
  page,
  itemsPerPage,
  totalUsers,
  totalPages: Math.ceil(totalUsers / itemsPerPage), // Para UI
});
```

**Preguntas esperadas:**

- "¿Qué son operadores MongoDB?" → $or, $and, $nin, etc.
- "¿Performance con muchos usuarios?" → Índices en nickname, email
- "¿SQL injection aquí?" → RegExp protege contra eso (pattern matching)

---

## 6. MANEJO DE ARCH IVOS CON MULTER ⭐⭐

**Por qué es interesante:**

- Validación multi-nivel (extensión + mimetype)
- Naming con info del usuario
- Limpieza de archivos antiguos

**Ubicación:** `middlewares/uploads.js` (líneas 1-38)

```javascript
// STORAGE: guardar en carpeta con nombre = usuario ID
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/profile_pictures");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${req.user.id}${ext}`; // UserId + extension
    cb(null, filename);
  },
});

// VALIDACIÓN: doble check (extensión + mimetype)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Solo JPEG, JPG y PNG"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máx
  fileFilter,
});
```

**Dentro del controlador:**

```javascript
// Eliminar archivo anterior (actualizar foto)
const folder = path.resolve("./uploads/profile_pictures");
const files = fs.readdirSync(folder);
const oldFiles = files.filter(
  (f) => f.startsWith(userId) && f !== req.file.filename,
);
oldFiles.forEach((file) => fs.unlinkSync(path.join(folder, file)));
```

**Preguntas esperadas:**

- "¿Por qué double check (ext + mime)?" → Seguridad, el usuario puede mentir un mimetype
- "¿Qué sucede si alguien carga 1GB?" → Límite de 5MB lo detiene
- "¿Y si dos usuarios suben al mismo tiempo?" → Nombre incluye userId, no hay conflicto

---

## 7. SUGERENCIAS INTELIGENTES CON SAMPLING ⭐⭐⭐

**Por qué es interesante:**

- Lógica compleja multi-paso
- Combinación de usuarios para aprender + para enseñar
- Uso de $sample para aleatoriedad
- $concat para URL dinámicas

**Ubicación:** `controllers/follow.js` (líneas 500-650, parcial)

```javascript
// PASO 1: Usuarios que pueden enseñarme mi idioma de aprendizaje
let usersToLearn = await User.aggregate([
  {
    $match: {
      _id: { $nin: excludedIds },
      $or: [
        { masterLanguage: learningLanguage },
        { masterLanguage2: learningLanguage },
        { masterLanguage3: learningLanguage },
      ],
    },
  },
  { $sample: { size: minLimit } }, // Muestra aleatoria
  {
    $project: {
      id: "$_id",
      nickname: 1,
      profilePictureUrl: {
        $concat: ["/api/users/profile-picture/", { $toString: "$_id" }],
      },
    },
  },
]);

// PASO 2: Usuarios a los que pueda enseñarles MI idioma
// (similar pero diferente $or condition)

// PASO 3: Combinar sin duplicados
suggestedUsers = [...new Set([...usersToLearn, ...usersToTeach])];

// PASO 4: Rellenar con usuarios random si es necesario
if (remaining > 0) {
  const randomUsers = await User.aggregate([
    { $match: { _id: { $nin: excludedIds } } },
    { $sample: { size: remaining } },
  ]);
}
```

**Preguntas esperadas:**

- "¿Por qué usar $sample?" → Pedir LIMIT usuarios seria, sample es aleatorio
- "¿Y si no hay suficientes usuarios?" → Rellenar con random
- "¿Cómo optimizaría para 1M usuarios?" → Índices, pipeline optimizado

---

## 8. VALIDACIÓN PERSONALIZADA DEL UPDATE ⭐

**Por qué es interesante:**

- Seguridad: no permite campos sensibles
- Limpieza de datos: delete campos peligrosos
- Patrón de "allowlist" implícito

**Ubicación:** `controllers/user.js` (líneas 514-528)

```javascript
// RECOGER DATOS (desestructuración)
const { image, ...updateData } = req.body; // Excluir 'image' de entrada

// LIMPIAR: eliminar el ID del body
delete updateData.id;

// VALIDAR: campos que NUNCA se pueden editar
if (updateData.password || updateData.email || updateData.nickname) {
  return res.status(401).json({
    status: "error",
    message: "No puedes actualizar password, nickname o email",
  });
}

// ACTUALIZAR
const updatedUser = await User.findByIdAndUpdate(
  userId,
  updateData,
  { new: true }, // Retorna el documento actualizado
);
```

**Preguntas esperadas:**

- "¿Por qué no permitir email?" → Prevenir cambios masivos de email
- "¿Y si quiero cambiar email?" → Crear endpoint separado con verificación
- "¿Es suficiente front-end validation?" → No, siempre validar backend

---

## 9. EMAIL + CÓDIGO TEMPORAL AUTOMÁTICO ⭐⭐

**Por qué es interesante:**

- Integración con servicio externo (Gmail SMTP)
- Template dinámico con HTML
- Manejo de upsert en BD

**Ubicación:** `controllers/user.js` (líneas 26-92)

```javascript
// GENERAR CÓDIGO + HASH
const code = Math.floor(100000 + Math.random() * 900000); // 6 dígitos
const hashedCode = await bcrypt.hash(code.toString(), 10);
const expiresAt = new Date(Date.now() + 7 * 60 * 1000); // 7 minutos

// UPSERT en BD (crear si no existe, actualizar si existe)
const verificationCode = await VerificationCode.findOneAndUpdate(
  { email },
  { code: hashedCode, expiresAt, verified: false, purpose },
  { new: true, upsert: true }, // upsert = insert if not found
);

// ENVIAR EMAIL
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let html = fs.readFileSync(templatePath, "utf8");
html = html
  .replace("${code}", code)
  .replace("${message}", messageByPurpose[purpose]);

await transporter.sendMail({
  from: `"Letterex 🐸" <${process.env.EMAIL_USER}>`,
  to: email,
  subject: subjectByPurpose[purpose],
  html: html,
});
```

**Preguntas esperadas:**

- "¿Por qué hasear el código?" → La BD no almacena valores en limpio
- "¿Qué es upsert?" → Update si existe, Insert si no existe
- "¿Y si falla el email?" → Manejo de errores con try/catch, retornar error 500
- "¿Cómo mejorar?" → Rate limiting por email, queue de emails async

---

## 10. POPULATE Y TRANSFORMACIÓN DE DATOS ⭐⭐

**Por qué es interesante:**

- Relaciones en Mongoose (populate)
- Transformación de datos post-query
- Añadir URLs dinámicas

**Ubicación:** `controllers/follow.js` (líneas 280-320)

```javascript
// OBTENER solicitudes con populado
const requests = await FriendRequest.find({ receiver: userId })
  .sort({ created_at: -1 })
  .populate("sender", "_id nickname image"); // Solo estos campos

// TRANSFORMAR datos
const requestDetails = requests.map((request) => {
  const reqObj = request.toObject();
  return {
    ...reqObj,
    sender: {
      ...reqObj.sender,
      profilePictureUrl: `/api/users/profile-picture/${reqObj.sender.id}`,
    },
  };
});
```

**Preguntas esperadas:**

- "¿Qué es populate?" → Reemplazar ID con documento completo (SQL JOIN)
- "¿Performance?" → Requiere queries adicionales, alternativa: aggregation $lookup
- "¿Por qué añadir profilePictureUrl?" → Evitar que frontend construya URLs

---

## TEMAS PARA PRACTICAR

### Seguridad

- [ ] Validación input/output
- [ ] XSS (httpOnly cookies)
- [ ] CSRF (SameSite)
- [ ] SQL Injection / NoSQL Injection
- [ ] Rate limiting

### Performance

- [ ] Índices en MongoDB
- [ ] N+1 queries
- [ ] Agregation pipelines
- [ ] Caching

### Arquitectura

- [ ] RESTful conventions
- [ ] Error handling
- [ ] Middleware pattern
- [ ] Separation of concerns (routes/controllers/models)

### Testing

- [ ] Unit tests (controladores)
- [ ] Integration tests (API)
- [ ] Mocking (JWT, email)

---

## POSIBLES PREGUNTAS DE ENTREVISTA

1. **"¿Cómo manejas la autenticación?"**
   → JWT en cookies httpOnly, validación en middleware

2. **"¿Qué haces si una consulta es lenta?"**
   → Agregation pipeline, índices, populate vs lookup

3. **"¿Cómo validas que solo el usuario correcto actualice sus datos?"**
   → Comparar req.user.id del token vs datos de la BD

4. **"¿Qué sucede si falla el env email?"**
   → try/catch, retornar error 500 con mensaje

5. **"¿Cómo prevenis ataques?"**
   → Validation, hashing, httpOnly cookies, SameSite, limpieza de data

6. **"¿Escalabilidad: qué cambiarías con 1M usuarios?"**
   → Índices, caché (Redis), queue async (email), microservicios

---

## DEMO RÁPIDA

Si te piden que expliques código en vivo:

1. **Flujo login:**
   - Buscar usuario por email/nickname
   - Verificar contraseña con bcrypt.compare
   - Generar JWT
   - Obtener countLetters con agregation
   - Devolver userData en cookie

2. **Flujo compartir carta:**
   - Validar autor
   - Filtrar usuarios nuevos
   - Validar límite (máx 2)
   - Crear CorrectedLetter para cada nuevo usuario

3. **Flujo código reset:**
   - Generar código, hashear, guardar
   - Enviar por email
   - Usuario valida código
   - Cambiar contraseña
