//cargar variables de entorno 
require('dotenv').config();

//importar modulos
const path = require('path');
const express = require('express');
const { MongoClient } = require('mongodb'); 

// modulos locales
const etlService = require('./services/etlService');
const areasRutas = require('./rutas/areasRutas'); 
const cargosRutas = require('./rutas/cargosRutas'); 
const empleadosRutas = require('./rutas/empleadosRutas'); 
const nominasRutas = require('./rutas/nominasRutas'); 

//instanciar la aplicación Express
const app = express();

//puerto y conexion con mongo
const PORT = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

//conectar a mongo
async function connectDB() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Conectado exitosamente a la base de datos!");
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        process.exit(1); 
    }
}

//vistas(frontend)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//procesar solicitudes
app.use(express.urlencoded({ extended: true }));  //formularios html
app.use(express.json());               // Para datos json
app.use(express.static(path.join(__dirname, 'public')));//archivos estaticos


//inizializar y usar las rutas api
areasRutas.init(client); 
cargosRutas.init(client); 
empleadosRutas.init(client); 
nominasRutas.init(client); 

//todo dentro de rutas sera accesible con api
app.use('/api', areasRutas.router);
app.use('/api', cargosRutas.router);
app.use('/api', empleadosRutas.router); 
app.use('/api', nominasRutas.router);


//pagina de areas
app.get('/areas-page', (req, res) => {
    res.render('areas'); 
});
//pagina de nominas
app.get('/nominas-page', (req, res) => {
    res.render('nominas'); 
});

//pagina de cargos
app.get('/cargos-page', (req, res) => {
    res.render('cargos'); 
});

//pagina de empleados
app.get('/empleados-page', (req, res) => {
    res.render('empleados');
});

//ruta pagina de inicio 
app.get('/', (req, res) => {
    res.render('index', { title: 'Acme Corporate' });
});

//iniciar el server
connectDB().then(async () => {
    try {
        console.log("[ETL] Iniciando proceso de carga de datos...");
        //carga areas y cargos (ids)
        const areaMap = await etlService.loadAreas(client);
        const cargoMap = await etlService.loadCargos(client);
        //carga empleados
        await etlService.loadEmpleados(client, areaMap, cargoMap);
        //carga nominas
        await etlService.loadNominas(client);
        console.log("[ETL] Proceso de carga de datos completado exitosamente.");
        
        app.listen(PORT, () => {
            console.log(`Cargando servidor, esperese prb.... ${PORT}`);
            console.log(`Abrir en el navegador: http://localhost:${PORT}`);
        });
    } catch (etlError) {
        console.error("[ETL] Error durante la carga de datos ETL:", etlError);
        process.exit(1); 
    }
});
