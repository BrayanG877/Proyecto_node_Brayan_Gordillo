//cargar variables de entorno al inicio de la aplicacion
require('dotenv').config();

//importar express y path
const express = require('express');
const path = require('path');

//importar MongoClient de MongoDB para la conexion a la base de datos
const { MongoClient } = require('mongodb'); 

//crear una instancia de la aplicacion Express
const app = express();

//configuracion del puerto
const PORT = process.env.PORT || 3000;

//la uri de conexion se toma de las variables de entorno
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri); //cliente MongoDB

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


//configurar ejs como motor de plantillas
app.set('view engine', 'ejs');

//configurar la carpeta donde estaran las vistas (archivos.ejs)
app.set('views', path.join(__dirname, 'views'));

//middlewares para procesar solicitudes http
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

//middleware para servir archivos estaticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));


//ruta principal para la pagina de inicio
app.get('/', (req, res) => {
    res.render('index', { title: 'Acme Corporate' });
});

//iniciar el servidor

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`cargando servidor.... ${PORT}`);
        console.log(`abrir en el navegador= http://localhost:${PORT}`);
    });
});