const express = require('express');
const { ObjectId } = require('mongodb');

const router = express.Router();

let mongoClient;

function init(client) {
    mongoClient = client;
}

// Ruta para obtener todas las nóminas
// GET /api/nominas
router.get('/nominas', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('nominas');
        
        const nominas = await collection.aggregate([
            {
                $lookup: {
                    from: 'empleados',        // Colección con la que unir
                    localField: 'empleadoId', // Campo en la colección de nóminas
                    foreignField: '_id',      // Campo en la colección de empleados
                    as: 'empleado'            // Nombre del nuevo campo (será un array)
                }
            },
            {
                $unwind: { path: '$empleado', preserveNullAndEmptyArrays: true } // Deshace el array 'empleado'
            }
        ]).toArray();

        res.json(nominas);
    } catch (error) {
        console.error("Error al obtener nóminas:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener nóminas." });
    }
});

// Ruta para obtener una nómina por su ID
// GET /api/nominas/:id
router.get('/nominas/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('nominas');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nómina inválido." });
        }

        const nomina = await collection.aggregate([
            { $match: { _id: new ObjectId(id) } }, // Primero busca la nómina por ID
            {
                $lookup: {
                    from: 'empleados',
                    localField: 'empleadoId',
                    foreignField: '_id',
                    as: 'empleado'
                }
            },
            {
                $unwind: { path: '$empleado', preserveNullAndEmptyArrays: true }
            }
        ]).toArray();

        if (nomina.length === 0) { // Aggregate devuelve un array, verificamos si está vacío
            return res.status(404).json({ message: "Nómina no encontrada." });
        }

        res.json(nomina[0]); // Devolvemos el primer (y único) elemento del array
    } catch (error) {
        console.error(`Error al obtener nómina con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al obtener nómina." });
    }
});

// Ruta para crear una nueva nómina
// POST /api/nominas
router.post('/nominas', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('nominas');
        const { empleadoId, periodo, fechaEmision, salarioBruto, devengos, deducciones } = req.body;

        // Validaciones básicas
        if (!empleadoId || !periodo || !fechaEmision || salarioBruto === undefined) {
            return res.status(400).json({ message: "Faltan campos obligatorios para crear la nómina." });
        }
        if (!ObjectId.isValid(empleadoId)) {
            return res.status(400).json({ message: "ID de empleado inválido." });
        }

        // Calcular totales de devengos y deducciones
        let totalDevengos = 0;
        if (Array.isArray(devengos)) {
            devengos.forEach(d => {
                if (d.valor) totalDevengos += parseFloat(d.valor);
            });
        }

        let totalDeducciones = 0;
        if (Array.isArray(deducciones)) {
            deducciones.forEach(d => {
                if (d.valor) totalDeducciones += parseFloat(d.valor);
            });
        }

        const salarioNeto = parseFloat(salarioBruto) + totalDevengos - totalDeducciones;

        const newNomina = {
            empleadoId: new ObjectId(empleadoId),
            periodo,
            fechaEmision: new Date(fechaEmision),
            salarioBruto: parseFloat(salarioBruto),
            devengos: Array.isArray(devengos) ? devengos.map(d => ({ ...d, _id: new ObjectId(), valor: parseFloat(d.valor) })) : [],
            deducciones: Array.isArray(deducciones) ? deducciones.map(d => ({ ...d, _id: new ObjectId(), valor: parseFloat(d.valor) })) : [],
            totalDevengos,
            totalDeducciones,
            salarioNeto
        };

        const result = await collection.insertOne(newNomina);
        res.status(201).json({ _id: result.insertedId, ...newNomina });
    } catch (error) {
        console.error("Error al crear nómina:", error);
        res.status(500).json({ message: "Error interno del servidor al crear nómina." });
    }
});

// Ruta para actualizar una nómina por su ID
// PUT /api/nominas/:id
router.put('/nominas/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('nominas');
        const id = req.params.id;
        const { empleadoId, periodo, fechaEmision, salarioBruto, devengos, deducciones } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nómina inválido." });
        }
        if (!empleadoId || !periodo || !fechaEmision || salarioBruto === undefined) {
            return res.status(400).json({ message: "Faltan campos obligatorios para actualizar la nómina." });
        }
        if (!ObjectId.isValid(empleadoId)) {
            return res.status(400).json({ message: "ID de empleado inválido para actualización." });
        }

        // Calcular totales de devengos y deducciones
        let totalDevengos = 0;
        if (Array.isArray(devengos)) {
            devengos.forEach(d => {
                if (d.valor) totalDevengos += parseFloat(d.valor);
            });
        }

        let totalDeducciones = 0;
        if (Array.isArray(deducciones)) {
            deducciones.forEach(d => {
                if (d.valor) totalDeducciones += parseFloat(d.valor);
            });
        }

        const salarioNeto = parseFloat(salarioBruto) + totalDevengos - totalDeducciones;

        const updatedNomina = {
            empleadoId: new ObjectId(empleadoId),
            periodo,
            fechaEmision: new Date(fechaEmision),
            salarioBruto: parseFloat(salarioBruto),
            devengos: Array.isArray(devengos) ? devengos.map(d => ({ ...d, _id: d._id ? new ObjectId(d._id) : new ObjectId(), valor: parseFloat(d.valor) })) : [],
            deducciones: Array.isArray(deducciones) ? deducciones.map(d => ({ ...d, _id: d._id ? new ObjectId(d._id) : new ObjectId(), valor: parseFloat(d.valor) })) : [],
            totalDevengos,
            totalDeducciones,
            salarioNeto
        };

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedNomina }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Nómina no encontrada para actualizar." });
        }
        
        res.status(200).json({ _id: id, ...updatedNomina, message: "Nómina actualizada correctamente." });
    } catch (error) {
        console.error(`Error al actualizar nómina con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al actualizar nómina." });
    }
});

// Ruta para eliminar una nómina por su ID
// DELETE /api/nominas/:id
router.delete('/nominas/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('nominas');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nómina inválido." });
        }

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Nómina no encontrada para eliminar." });
        }

        res.status(200).json({ message: "Nómina eliminada correctamente." });
    } catch (error) {
        console.error(`Error al eliminar nómina con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al eliminar nómina." });
    }
});

module.exports = {
    router,
    init
};
