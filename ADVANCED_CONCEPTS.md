# Advanced MongoDB & Node.js Concepts - Letterex API

## Tabla de Contenidos

1. [MongoDB Aggregation Pipeline ($match, $group)](#mongodb-aggregation-pipeline)
2. [Promise.all - Paralelización Asíncrona](#promiseall)
3. [Map y Deduplicación (línea 250)](#map-deduplicacion)
4. [Mongoose vs MongoDB](#mongoose-vs-mongodb)
5. [skip/limit vs paginate](#skip-vs-paginate)
6. [Optimización: searchReceivedLetters](#optimizacion-searchreceivedletters)

---

## MongoDB Aggregation Pipeline

### Concepto: ¿Qué es un Pipeline?

Un **pipeline** es una serie de "transformaciones" que se aplican en orden a los documentos. Es como una **cadena de montaje**:

```
[Documentos Crudos] → [Stage 1] → [Stage 2] → [Stage 3] → [Resultado Final]
```

**En tu código (user.js, línea 350-354):**

```javascript
const countsByLanguage = await Letter.aggregate([
  { $match: { author: user.id } }, // Stage 1: Filtrar
  { $group: { _id: "$language", count: { $sum: 1 } } }, // Stage 2: Agrupar y contar
]);
```

### $match - El filtro (como WHERE en SQL)

**¿Qué hace?** Filtra documentos como si fuera una condición WHERE en SQL.

```javascript
// Sin $match (LENTO - obtiene TODO):
const letters = await Letter.find({ author: user.id });
const spanish = letters.filter((l) => l.language === "es");
const count = spanish.length;

// Con $match (RÁPIDO - filtra en base de datos):
const result = await Letter.aggregate([
  { $match: { author: user.id, language: "es" } },
]);
```

**¿Por qué es más rápido?**

- Sin $match: MongoDB trae **TODOS** los documentos a Node.js, luego JavaScript filtra
- Con $match: MongoDB filtra **en el servidor**, envía solo lo necesario

```
❌ LENTO:
MongoDB → Node.js → Filtrar en memoria → Resultado
(1000 docs) (1000 docs) (buscar 10)    (10 docs)

✅ RÁPIDO:
MongoDB filtra internamente → envía solo resultado
(busca 10 en servidor)    (10 docs)
```

### $group - Agrupar y contar (como GROUP BY en SQL)

**¿Qué hace?** Agrupa documentos por un campo y aplica operadores de agregación.

```javascript
// En tu código: contar cartas por idioma
const countsByLanguage = await Letter.aggregate([
  { $match: { author: user.id } },
  {
    $group: {
      _id: "$language", // agrupar por idioma
      count: { $sum: 1 }, // sumar 1 por cada documento
    },
  },
]);
```

**Resultado:**

```javascript
// Si tienes 5 cartas en español y 3 en inglés:
[
  { _id: "es", count: 5 },
  { _id: "en", count: 3 },
];
```

**Otros operadores de $group:**

```javascript
{ $group: {
  _id: "$category",
  count: { $sum: 1 },              // contar documentos
  total: { $sum: "$price" },       // sumar un campo
  average: { $avg: "$rating" },    // promedio
  max: { $max: "$price" },         // máximo
  min: { $min: "$price" },         // mínimo
  items: { $push: "$name" }        // crear array
}}
```

### Comparación: Agregation vs find() + map()

```javascript
// ❌ MÁS LENTO - find() trae TODO a Node.js
const letters = await Letter.find({ author: user.id });
const countByLanguage = {};
letters.forEach((letter) => {
  if (!countByLanguage[letter.language]) {
    countByLanguage[letter.language] = 0;
  }
  countByLanguage[letter.language]++;
});

// ✅ MÁS RÁPIDO - MongoDB procesa TODO en el servidor
const result = await Letter.aggregate([
  { $match: { author: user.id } },
  { $group: { _id: "$language", count: { $sum: 1 } } },
]);
const countByLanguage = result.reduce((acc, item) => {
  acc[item._id] = item.count;
  return acc;
}, {});
```

---

## Promise.all

### Concepto: Executar múltiples promesas en paralelo

**Promise.all** ejecuta múltiples promesas **simultáneamente** (paralelamente):

```javascript
// ❌ SECUENCIAL (LENTO) - espera cada uno terminado:
const user = await User.findById(userId); // 200ms
const letters = await Letter.find({ author: userId }); // 200ms
const friends = await Follow.find({ follower: userId }); // 200ms
// Total: 600ms

// ✅ PARALELO (RÁPIDO) - los 3 se ejecutan juntos:
const [user, letters, friends] = await Promise.all([
  User.findById(userId), // 200ms
  Letter.find({ author: userId }), // 200ms
  Follow.find({ follower: userId }), // 200ms
]);
// Total: 200ms (el más lento de todos)
```

### En tu código (controllers/letter.js, línea 265+)

```javascript
// buildLettersWithCorrections usa Promise.all para obtener correcciones
const lettersWithCorrections = await Promise.all(
  letters.map(async (letter) => {
    const corrections = await CorrectedLetter.find({
      originalLetter: letter._id,
    });
    return { ...letter, corrections };
  }),
);
```

**¿Qué pasa?**

```javascript
// Si tienes 10 cartas:
const letters = [letra1, letra2, letra3, ..., letra10];

await Promise.all([
  CorrectedLetter.find({ originalLetter: letra1._id }), // 100ms
  CorrectedLetter.find({ originalLetter: letra2._id }), // 100ms
  CorrectedLetter.find({ originalLetter: letra3._id }), // 100ms
  // ... los 10 en paralelo
]);
// Total: ~100ms (no 1000ms)
```

**⚠️ Nota importante:** Es diferente a esperar con un for loop:

```javascript
// ❌ SECUENCIAL - LENTO (N+1 query problem):
for (let i = 0; i < letters.length; i++) {
  const corrections = await CorrectedLetter.find({
    originalLetter: letters[i]._id,
  }); // Espera esta terminar antes de siguiente
}

// ✅ PARALELO - RÁPIDO:
const result = await Promise.all(
  letters.map((letter) => CorrectedLetter.find({ originalLetter: letter._id })),
);
```

---

## Map y Deduplicación (línea 250)

### ¿Qué es esto? (correctedLetter.js, 250-255)

```javascript
const uniqueSenders = [
  ...new Map(
    validLetters
      .filter((cl) => cl.sender && cl.sender.nickname)
      .map((cl) => [cl.sender.nickname, cl.sender.nickname]),
  ).values(),
];
```

### Desglosando paso a paso:

**Paso 1: filter** - Elimina items null/undefined

```javascript
validLetters.filter((cl) => cl.sender && cl.sender.nickname);
// Resultado: Solo items con sender válido
```

**Paso 2: map** - Crea pares [clave, valor]

```javascript
.map((cl) => [cl.sender.nickname, cl.sender.nickname])
// Resultado: [["Juan", "Juan"], ["Maria", "Maria"], ["Juan", "Juan"], ...]
```

**Paso 3: new Map()** - DEDUPLICACIÓN MÁGICA

```javascript
new Map([
  ["Juan", "Juan"],
  ["Maria", "Maria"],
  ["Juan", "Juan"],
]);
// Map internamente: { "Juan" → "Juan", "Maria" → "Maria" }
// ⚠️ Solo una clave por nombre (elimina duplicados automáticamente)
```

**Paso 4: .values()** - Extrae solo los valores

```javascript
.values()
// Iterator: "Juan", "Maria"
```

**Paso 5: ...** - Spread operator convierte a array

```javascript
[..."Juan", "Maria"];
// Resultado final: ["Juan", "Maria"]
```

### Visualización completa:

```javascript
// Entrada: cartas con senders
const validLetters = [
  { sender: { nickname: "Juan" }, ... },
  { sender: { nickname: "Maria" }, ... },
  { sender: { nickname: "Juan" }, ... },    // Duplicado
  { sender: { nickname: "Carlos" }, ... },
  { sender: { nickname: "Maria" }, ... },   // Duplicado
];

// Paso a paso:
1. filter: [Juan, Maria, Juan, Carlos, Maria]
2. map: [["Juan","J"], ["Maria","M"], ["Juan","J"], ["Carlos","C"], ["Maria","M"]]
3. new Map(): { Juan→J, Maria→M, Carlos→C }  (clave única = sin duplicados)
4. .values(): Juan, Maria, Carlos
5. [...]: ["Juan", "Maria", "Carlos"]

// Resultado final: Lista única de senders (sin duplicados)
```

### ¿Por qué no simplemente un Set? ✅ MEJOR OPCIÓN

```javascript
// ✅ RECOMENDADO - Más simple y eficiente:
const uniqueSenders = [
  ...new Set(
    validLetters
      .filter((cl) => cl.sender?.nickname)
      .map((cl) => cl.sender.nickname),
  ),
];
// Una línea, clara, rápida

// ❌ Código actual (innecesariamente complejo):
const uniqueSenders = [
  ...new Map(
    validLetters
      .filter((cl) => cl.sender && cl.sender.nickname)
      .map((cl) => [cl.sender.nickname, cl.sender.nickname]),
  ).values(),
];
// Más complicado, misma funcionalidad

// CUÁNDO USAR CADA UNO:
// - Map: para pares clave-valor (deduplicar + MANTENER OTRA INFORMACIÓN)
//   Ejemplo: { userId → User object, userId → User object } (solo una copia)
//
// - Set: para deduplicar valores (TU CASO ✅)
//   Ejemplo: { "Juan", "Maria", "Juan" } → { "Juan", "Maria" }

// En tu código: NO necesitas mantener dos valores diferentes
// Solo necesitas: deduplicar nicknames = SET es mejor ✅
```

---

## Mongoose vs MongoDB

### Diferencia fundamental

```
┌─────────────────────────────────────────────────────┐
│ MongoDB - El motor de base de datos                 │
│ (comunica con el servidor mongod)                   │
└─────────────────────────────────────────────────────┘
                         ↑
              (abstracción sobre)
                         ↓
┌─────────────────────────────────────────────────────┐
│ Mongoose - ODM (Object Document Mapper)             │
│ (convierte documentos en objetos JavaScript)        │
│ (añade esquemas, validaciones, middlewares)         │
└─────────────────────────────────────────────────────┘
```

### Comparación de sintaxis

```javascript
// ---- MONGOOSE (tu código) ----
const letter = new Letter({ title: "Mi carta", content: "..." });
await letter.save();  // Métodos del modelo

const letters = await Letter.find({ author: userId });  // Métodos
const result = await Letter.aggregate([...]);           // ODM methods

// ---- MONGODB (driver nativo) ----
const client = new MongoClient(uri);
const collection = client.db("letterex").collection("letters");
await collection.insertOne({ title: "Mi carta", ... });
const letters = await collection.find({ author: userId }).toArray();
const result = await collection.aggregate([...]).toArray();
```

### Ventajas de Mongoose

```javascript
// 1. ESQUEMA (validación):
const letterSchema = new Schema({
  title: { type: String, required: true, maxlength: 100 },
  content: { type: String, required: true },
  language: { type: String, enum: ["es", "en", "fr"] },
});
// MongoDB driver no valida estos campos automáticamente

// 2. MÉTODOS PREDEFINIDOS:
letter.markAsDeleted(); // Método personalizado
letter.toJSON(); // Transformación automática

// 3. MIDDLEWARES:
letterSchema.pre("save", async function (next) {
  // Ejecuta antes de guardar
});

// 4. POBLADO AUTOMÁTICO (populate):
await Letter.find().populate("author"); // Joins automáticos
// En MongoDB nativo: escribirías manualmente con $lookup

// 5. CASTEO AUTOMÁTICO:
const letter = await Letter.findById(id);
// MongoDB nativo requieren: ObjectId(id) manualmente
```

### Métodos principales de Mongoose

```javascript
// Lectura
await Model.find(filter);           // Array o []
await Model.findById(id);           // Object o null
await Model.findOne(filter);        // Object o null
await Model.countDocuments(filter); // Number

// Escritura
await Model.insertOne(data);        // Nuevo documento
await Model.updateOne(filter, update);
await Model.updateMany(filter, update);
await Model.deleteOne(filter);
await Model.deleteMany(filter);

// Agregación
await Model.aggregate([...]);       // Pipeline
```

---

## skip/limit vs paginate

### Concepto: ¿Cómo paginar?

Tienes 1000 documentos. Los usuarios los ven de 10 en 10.

```
Página 1: documentos 1-10
Página 2: documentos 11-20
Página 3: documentos 21-30
...
```

### Método 1: skip() + limit() (tu código actual)

```javascript
const page = 2; // Segunda página
const itemsPerPage = 10;

const skip = (page - 1) * itemsPerPage; // (2-1)*10 = 10
const limit = itemsPerPage; // 10

const documents = await Letter.find()
  .skip(skip) // Salta los primeros 10
  .limit(limit); // Toma los siguientes 10
// Resultado: documentos 11-20
```

**Cálculos:**

```javascript
Página 1: skip = 0,  limit = 10  → docs 1-10
Página 2: skip = 10, limit = 10  → docs 11-20
Página 3: skip = 20, limit = 10  → docs 21-30
Página N: skip = (N-1)*10, limit = 10
```

### Método 2: Usar librería `mongoose-paginate-v2`

```javascript
// 1. Instalar: npm install mongoose-paginate-v2
// 2. Importar en tu schema:
const mongoosePaginate = require('mongoose-paginate-v2');
letterSchema.plugin(mongoosePaginate);

// 3. Usar:
const options = {
  page: 2,
  limit: 10
};
const result = await Letter.paginate({}, options);

// Resultado automático:
{
  docs: [...],           // documentos
  totalDocs: 1000,       // total de documentos
  limit: 10,
  page: 2,
  pages: 100,            // total de páginas
  hasNextPage: true,
  hasPrevPage: true
}
```

### Comparación

```
SKIP/LIMIT:
✅ Control total
✅ Sin dependencias externas
❌ Código más verboso
❌ Fácil de equivocarse en cálculos

PAGINATE (librería):
✅ Método listo para usar
✅ Calcula automáticamente totalPages, hasNextPage, etc
❌ Dependencia externa
❌ Menos flexible
```

### ¿Son equivalentes?

```javascript
// SÍ, son exactamente equivalentes

// skip/limit:
const result = await Letter.find()
  .skip((page - 1) * 10)
  .limit(10);

// paginate (internamente hace lo mismo):
const result = await Letter.paginate({}, { page, limit: 10 });
```

**Recomendación:** Para tu proyecto, **skip/limit está bien**. Solo usa pageinate si quieres ahorrar código. La diferencia de rendimiento es **negligible**.

---

## Optimización: searchReceivedLetters

### El Problema Actual

```javascript
// Línea 215: Obtiene TODO de la base de datos
const allCorrectedLetters = await CorrectedLetter.find({ reviewer: userId })
  .populate("originalLetter", "-sharedWith -content -diary")
  .populate("sender", "_id image nickname")
  .sort({ received_at: -1 });

// Línea 240-256: Filtra en Node.js
const filteredLetters = validLetters.filter((cl) => {
  if (searchTerm && !searchRegex.test(cl.originalLetter.title)) return false;
  if (senderRegex && (!cl.sender || !senderRegex.test(cl.sender.nickname)))
    return false;
  if (sentBackFilter !== undefined) {
    const sentBackBool = sentBackFilter === "true" || sentBackFilter === true;
    if (cl.sentBack !== sentBackBool) return false;
  }
  return true;
});

// Línea 260: Pagina DESPUÉS de filtrar
const paginatedLetters = filteredLetters.slice(skip, skip + itemsPerPage);
```

**¿El problema?**

```
┌─────────────────────────────────────────────────────────┐
│ Tienes 10,000 cartas en total                           │
│                                                          │
│ 1. find({ reviewer: userId }) → MongoDB trae 10,000    │
│ 2. populate() → 10,000 documentos populados en Node    │
│ 3. filter (regex search) → busca en 10,000 en memoria  │
│ 4. slice(skip, limit) → finalmente pagina              │
│                                                          │
│ Total tráfico: 10,000 docs (aunque solo necesites 10) │
│ Total memoria: 10,000 docs en RAM                       │
│ Total CPU: buscar en 10,000 con regex                   │
└─────────────────────────────────────────────────────────┘
```

### ¿Cómo optimizar? Usar Aggregation Pipeline

```javascript
const searchReceivedLetters = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const searchTerm = typeof req.query.q === "string" ? req.query.q : "";
    const senderFilter =
      typeof req.query.sender === "string" ? req.query.sender : "";
    const sentBackFilter = req.query.sentBack;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const itemsPerPage = Math.max(parseInt(req.query.itemsPerPage) || 10, 1);

    // CREAR PIPELINE OPTIMIZADO
    const pipeline = [
      // Paso 1: Filtrar solo las cartas del usuario
      { $match: { reviewer: userId } },

      // Paso 2: Rellenar información del autor original
      {
        $lookup: {
          from: "letters",
          localField: "originalLetter",
          foreignField: "_id",
          as: "originalLetterData",
        },
      },

      // Paso 3: Rellenar info del corrector
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "senderData",
        },
      },

      // Paso 4: Aplicar filtros ANTES de paginar (en el servidor)
      {
        $match: {
          ...(searchTerm && {
            "originalLetterData.title": {
              $regex: searchTerm,
              $options: "i",
            },
          }),
          ...(senderFilter && {
            "senderData.nickname": {
              $regex: senderFilter,
              $options: "i",
            },
          }),
          ...(sentBackFilter !== undefined && {
            sentBack: sentBackFilter === "true",
          }),
        },
      },

      // Paso 5: Ordenar
      { $sort: { received_at: -1 } },

      // Paso 6: PAGINAR (MongoDB hace esto, no Node.js)
      { $skip: (page - 1) * itemsPerPage },
      { $limit: itemsPerPage },

      // Paso 7: Proyectar solo campos necesarios
      {
        $project: {
          _id: 1,
          originalLetter: 1,
          sender: 1,
          sentBack: 1,
          seen: 1,
          received_at: 1,
          originalLetterData: { title: 1, _id: 1 },
          senderData: { nickname: 1, image: 1, _id: 1 },
        },
      },
    ];

    const [paginatedLetters, totalResult] = await Promise.all([
      CorrectedLetter.aggregate(pipeline),
      CorrectedLetter.aggregate([
        { $match: { reviewer: userId } },
        {
          $lookup: {
            from: "letters",
            localField: "originalLetter",
            foreignField: "_id",
            as: "originalLetterData",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sender",
            foreignField: "_id",
            as: "senderData",
          },
        },
        {
          $match: {
            ...(searchTerm && {
              "originalLetterData.title": {
                $regex: searchTerm,
                $options: "i",
              },
            }),
            ...(senderFilter && {
              "senderData.nickname": {
                $regex: senderFilter,
                $options: "i",
              },
            }),
            ...(sentBackFilter !== undefined && {
              sentBack: sentBackFilter === "true",
            }),
          },
        },
        { $count: "total" },
      ]),
    ]);

    // Obtener senders únicos (puedes hacerlo en el agregation también)
    const uniqueSenders = [
      ...new Set(
        paginatedLetters
          .filter((cl) => cl.senderData?.[0]?.nickname)
          .map((cl) => cl.senderData[0].nickname),
      ),
    ];

    const totalFiltered = totalResult[0]?.total || 0;
    const totalLetters = await CorrectedLetter.countDocuments({
      reviewer: userId,
    });

    // Marcar como vistas
    await CorrectedLetter.updateMany({ reviewer: userId }, { seen: true });

    return res.status(200).json({
      status: "success",
      letters: paginatedLetters,
      senders: uniqueSenders,
      page,
      itemsPerPage,
      totalLetters,
      totalFiltered,
      totalPages: Math.ceil(totalFiltered / itemsPerPage),
    });
  } catch (error) {
    console.log("error searching received corrected letters:", error);
    return res.status(500).json({
      status: "error",
      message: "Error searching received corrected letters",
      error: error.message,
    });
  }
};
```

### ¿Qué mejora?

```
ANTES (Código actual):
┌────────────────────────────────────────┐
│ MongoDB trae 10,000 documentos         │
│ Node.js filtra en el servidor          │
│ Node.js pagina manualmente             │
│ Total en RAM: ~50MB (10,000 docs)      │
│ Tiempo: 800ms                          │
└────────────────────────────────────────┘

DESPUÉS (Optimizado con Pipeline):
┌────────────────────────────────────────┐
│ MongoDB filtra en el servidor           │
│ MongoDB paginaa internamente ($skip)    │
│ Node.js recibe solo 10 documentos       │
│ Total en RAM: ~500KB (10 docs)          │
│ Tiempo: 50ms                           │
└────────────────────────────────────────┘

MEJORA: 16x menos datos, 16x más rápido
```

### Pasos del Pipeline

```
1️⃣ $match { reviewer: userId }
   Resultado: Solo cartas para este usuario

2️⃣ $lookup originalLetterData
   Resultado: Cada carta tiene información de la carta original

3️⃣ $lookup senderData
   Resultado: Cada carta tiene información del corrector

4️⃣ $match (filtros)
   Resultado: Solo cartas que coinciden con búsqueda

5️⃣ $sort { received_at: -1 }
   Resultado: Ordenadas por reciente

6️⃣ $skip + $limit
   Resultado: Solo 10 documentos (página solicitada)

7️⃣ $project (opcional)
   Resultado: Solo campos necesarios
```

---

## Resumen Práctica

| Concepto        | Cuándo                           | Ventaja                             |
| --------------- | -------------------------------- | ----------------------------------- |
| **$match**      | Necesitas filtrar                | Hace el filtro en BD, no en Node.js |
| **$group**      | Necesitas agrupar/contar         | Procesa en BD, no en Node.js        |
| **Promise.all** | Múltiples queries independientes | Ejecuta en paralelo, no secuencial  |
| **new Map()**   | Deduplicar valores               | Elimina duplicados automáticamente  |
| **skip/limit**  | Paginar resultados               | Simple y directo                    |
| **populate**    | Cargas relaciones                | Más fácil que $lookup               |
| **aggregate**   | Operaciones complejas            | Más control, más poderoso           |

---

## Código de Ejemplo para Practicar

```javascript
// Ejemplo 1: Contar cartas por idioma (Pipeline)
const byLanguage = await Letter.aggregate([
  { $match: { author: userId } },
  { $group: { _id: "$language", total: { $sum: 1 } } }
]);

// Ejemplo 2: Usuarios más activos (Promise.all)
const users = await User.find().limit(5);
const [profiles, letters, followers] = await Promise.all([
  User.find(),           // Todos en paralelo
  Letter.find(),
  Follow.find()
]);

// Ejemplo 3: Deduplicar tags (Map + Set)
const tags = ["js", "mongodb", "js", "node", "mongodb"];
const unique = [...new Set(tags)];
// Resultado: ["js", "mongodb", "node"]

// Ejemplo 4: Paginar con agregation (Optimizado)
const page = 2, itemsPerPage = 10;
const results = await Model.aggregate([
  { $match: { ... } },        // Filtrar
  { $sort: { createdAt: -1 } }, // Ordenar
  { $skip: (page-1) * itemsPerPage },  // Paginar
  { $limit: itemsPerPage }
]);
```

---

## Próximos Pasos

1. **Comprende el Pipeline**: Estudia el orden de las etapas ($match antes de $group siempre)
2. **Optimiza searchReceivedLetters**: Usa la solución propuesta arriba
3. **Mide el rendimiento**: Compara velocidad antes/después
4. **Aplica Promise.all**: Dondequiera que tengas múltiples queries independientes
5. **Documenta el código**: Comenta por qué usas cada stage del pipeline

**✨ Tip para la entrevista:** Explica que entiendes las diferencias entre SQL (find + filter) vs MongoDB (aggregation) y cuándo usar cada uno. Eso demuestra pensamiento crítico.
