En construcción

http://localhost:4000


### Endpoints para almuerzos
GET /api/lunches -> devuelve todos los lunch registrados
status 200 ok

respuesta ejemplo:

[
  {
    "id": "abfadc01-d89f-4480-b237-2491ae1b1d51",
    "title": "Pollo Asado",
    "imagen": "pollo.png",
    "price": 12.5,
    "tags": ["pollo", "combo"]
  },
  { ... }
]

curl http://localhost:4000/api/lunches



POST /api/lunches -> Crea un nuevo lunch y lo añade como una fila al CSV
status 201 created

ejemplo:

{
  "title": "Pollo Asado",
  "imagen": "pollo.png",
  "price": 12.5,
  "tags": ["pollo","combo"]
}

respuesta ejemplo:

{
  "ok": true,
  "lunch": {
    "id": "abfadc01-d89f-4480-b237-2491ae1b1d51",
    "title": "Pollo Asado",
    "imagen": "pollo.png",
    "price": 12.5,
    "tags": ["pollo","combo"]
  }
}


curl -X POST http://localhost:4000/api/lunches \
  -H "Content-Type: application/json" \
  -d '{"title":"Pollo Asado","imagen":"pollo.png","price":12.5,"tags":["pollo","combo"]}'


PUT /api/lunches/:id -> Actualiza un lunch existente y reescribe todo el CSV internamente
status 200 ok o 404 not found si ID no existe

ejemplo:

{
  "title": "Pollo Asado - Actualizado",
  "price": 14.0
}

respuesta ejemplo:

{ "ok": true, "updated": { /* objeto lunch actualizado */ } }

curl -X PUT http://localhost:4000/api/lunches/<ID_AQUI> \
  -H "Content-Type: application/json" \
  -d '{"price":14.0}'


DELETE /api/lunches/:id -> Elimina el lunch con id y reescribe el CSV
status 200 ok

ejemplo:

{ "ok": true }

curl -X DELETE http://localhost:4000/api/lunches/<ID_AQUI>



### Endpoints para pedidos

GET /api/orders -> devuelve todos los pedidos registrados 
status 200 ok

respuesta ejemplo:

[
  {
    "id": "uuid",
    "towerNum": "A",
    "apto": 101,
    "customer": "Juan",
    "phoneNum": 3001234567,
    "payMethod": { "id":"pm1","label":"Efectivo","image":"" },
    "lunch": [ /* array LunchType */ ],
    "details": "Sin picante",
    "time": "12:30",
    "date": "2025-09-17T12:30:00.000Z",
    "orderState": "pendiente"
  }
]


curl http://localhost:4000/api/orders


POST /api/orders -> crea un pedido y lo añade al CSV
status 201 created

ejemplo:

{
  "towerNum":"T2",
  "apto":1011,
  "customer":"Juan",
  "phoneNum":3001234567,
  "payMethod": {"id":"pm1","label":"Efectivo","image":""},
  "lunch": [ { "id":"l1","title":"Pollo","imagen":"","price":10,"tags":["pollo"] } ],
  "details":"Sin picante",
  "time":"12:30",
  "date":"2025-09-17T12:30:00.000Z",
  "orderState":"pendiente"
}

respuesta ejemplo:

{ "ok": true, "order": { /* order guardado con id */ } }


curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"towerNum":"A","apto":101,"customer":"Juan","phoneNum":3001234567,"payMethod":{"id":"pm1","label":"Efectivo","image":""},"lunch":[{"id":"l1","title":"Pollo","imagen":"","price":10,"tags":["pollo"]}],"details":"Sin picante","time":"12:30","date":"2025-09-17T12:30:00.000Z","orderState":"pendiente"}'


PUT /api/orders/:id -> actualiza un pedido por id 
status 200 ok o 4040 not found

ejemplo: campos a actualizar

curl -X PUT http://localhost:4000/api/orders/<ID_AQUI> \
  -H "Content-Type: application/json" \
  -d '{"orderState":"pagado"}'


DELETE /api/orders/:id -> elimina un pedido por id
  status 200 ok

curl -X DELETE http://localhost:4000/api/orders/<ID_AQUI>



### esquemas / types para referencia

// LunchType
type LunchType = {
  id: string;
  title: string;
  imagen: string;
  price: number;
  tags: string[];
}

// PayMethod
type PayMethod = {
  id: string;
  label: string;
  image: string;
}

// OrderType
type OrderType = {
  id: string;
  towerNum: string;
  apto: number;
  customer: string;
  phoneNum: number;
  payMethod: PayMethod;
  lunch: LunchType[];
  details: string;
  time: string;
  date: string; // ISO string in CSV
  orderState: 'pendiente' | 'pagado';
}


### Resumen

#### Ejecutar en dev
npm install
npm run dev

#### Endpoints
GET  /api/lunches
POST /api/lunches
PUT  /api/lunches/:id
DELETE /api/lunches/:id

GET  /api/orders
POST /api/orders
PUT  /api/orders/:id
DELETE /api/orders/:id
