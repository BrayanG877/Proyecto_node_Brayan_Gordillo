// 1. Cargar variables de entorno al inicio de la aplicación
require('dotenv').config();

// 2. Importar módulos
// Módulos nativos de Node.js
const path = require('path');

// Módulos de terceros (instalados con npm)
const express = require('express');
const { MongoClient } = require('mongodb'); 

// Módulos locales de tu proyecto
const etlService = require('./services/etlService');
const areasRutas = require('./rutas/areasRutas'); // Asegúrate que el nombre de la variable coincide con el archivo
const cargosRutas = require('./rutas/cargosRutas'); // Asegúrate que el nombre de la variable coincide con el archivo
const empleadosRutas = require('./rutas/empleadosRutas'); // Nueva importación
const nominasRutas = require('./rutas/nominasRutas'); // Nueva importación
// 3. Crear una instancia de la aplicación Express
const app = express();

// 4. Configuración de la aplicación (Puerto y Conexión a DB)
const PORT = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri); // Cliente MongoDB

// 5. Función para conectar a la base de datos MongoDB
async function connectDB() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Conectado exitosamente a la base de datos!");
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        process.exit(1); // Salir si la conexión falla es crítica para una app de DB
    }
}

// 6. Configuración del motor de plantillas y vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 7. Middlewares para procesar solicitudes HTTP
app.use(express.urlencoded({ extended: true })); // Para datos de formularios HTML
app.use(express.json()); // Para datos JSON
app.use(express.static(path.join(__dirname, 'public'))); // Para servir archivos estáticos (CSS, JS del frontend, imágenes)

// 8. Inicializar y Usar las Rutas de la API
// Es crucial que esto esté ANTES de cualquier ruta general como app.get('/')
areasRutas.init(client); // Inicializa el enrutador de áreas con el cliente de MongoDB
cargosRutas.init(client); // Inicializa el enrutador de cargos con el cliente de MongoDB
empleadosRutas.init(client); // Inicializa el enrutador de empleados con el cliente de MongoDB
nominasRutas.init(client); // Inicializa el enrutador de nóminas con el cliente de MongoDB

// Todas las rutas definidas en areasRutas.js y cargosRutas.js
// serán accesibles bajo el prefijo /api
app.use('/api', areasRutas.router);
app.use('/api', cargosRutas.router);
app.use('/api', empleadosRutas.router); 
app.use('/api', nominasRutas.router);

// 9. Rutas de prueba y principales
// Ruta de prueba API para verificar el prefijo /api (puedes quitarla después de verificar)
app.get('/api/test', (req, res) => {
    res.json({ message: "API de prueba funcionando correctamente!" });
});

// Ruta para la página de visualización de áreas
app.get('/areas-page', (req, res) => {
    res.render('areas'); // Renderiza el archivo areas.ejs
});
// Ruta para la página de visualización de nominas
app.get('/nominas-page', (req, res) => {
    res.render('nominas'); // Renderiza el archivo nominas.ejs
});

// Ruta para la página de visualización de cargos
app.get('/cargos-page', (req, res) => {
    res.render('cargos'); // Renderiza el archivo cargos.ejs
});

// Ruta para la página de visualización de empleados
app.get('/empleados-page', (req, res) => {
    res.render('empleados'); // Renderiza el archivo empleados.ejs
});

// Ruta principal para la página de inicio (debe ir DESPUÉS de las rutas API más específicas)
app.get('/', (req, res) => {
    res.render('index', { title: 'Acme Corporate' });
});

// 10. Iniciar el servidor
// Primero intenta conectar a la base de datos, luego carga los datos ETL, y finalmente inicia el servidor Express
connectDB().then(async () => {
    try {
        console.log("[ETL] Iniciando proceso de carga de datos...");
        // Cargar áreas y cargos (ids)
        const areaMap = await etlService.loadAreas(client);
        const cargoMap = await etlService.loadCargos(client);
        // Cargar empleados
        await etlService.loadEmpleados(client, areaMap, cargoMap);
        // Cargar nóminas
        await etlService.loadNominas(client);
        console.log("[ETL] Proceso de carga de datos completado exitosamente.");
        
        app.listen(PORT, () => {
            console.log(`Cargando servidor.... ${PORT}`);
            console.log(`Abrir en el navegador: http://localhost:${PORT}`);
        });
    } catch (etlError) {
        console.error("[ETL] Error durante la carga de datos ETL:", etlError);
        process.exit(1); 
    }
});
