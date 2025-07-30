const express = require('express');
const { ObjectId } = require('mongodb');

const router = express.Router();

let mongoClient;

function init(client) {
    mongoClient = client;
}

// Ruta para obtener todos los cargos
// GET /api/cargos
router.get('/cargos', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('cargos');
        const cargos = await collection.find({}).toArray();
        res.json(cargos);
    } catch (error) {
        console.error("Error al obtener cargos:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener cargos." });
    }
});

// Ruta para obtener un cargo por su ID
// GET /api/cargos/:id
router.get('/cargos/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('cargos');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de cargo inválido." });
        }

        const cargo = await collection.findOne({ _id: new ObjectId(id) });

        if (!cargo) {
            return res.status(404).json({ message: "Cargo no encontrado." });
        }

        res.json(cargo);
    } catch (error) {
        console.error(`Error al obtener cargo con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al obtener cargo." });
    }
});

// Ruta para crear un nuevo cargo
// POST /api/cargos
router.post('/cargos', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('cargos');
        const { nombre } = req.body; // Obtiene el nombre del cuerpo de la solicitud

        if (!nombre) {
            return res.status(400).json({ message: "El nombre del cargo es requerido." });
        }

        // Opcional: Verificar si el cargo ya existe para evitar duplicados exactos
        const existingCargo = await collection.findOne({ nombre: nombre });
        if (existingCargo) {
            return res.status(409).json({ message: "El cargo con este nombre ya existe." });
        }

        const result = await collection.insertOne({ nombre: nombre });
        const newCargo = { _id: result.insertedId, nombre: nombre };
        
        res.status(201).json(newCargo); // 201 Created
    } catch (error) {
        console.error("Error al crear cargo:", error);
        res.status(500).json({ message: "Error interno del servidor al crear cargo." });
    }
});

// Ruta para actualizar un cargo por su ID
// PUT /api/cargos/:id
router.put('/cargos/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('cargos');
        const id = req.params.id;
        const { nombre } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de cargo inválido." });
        }
        if (!nombre) {
            return res.status(400).json({ message: "El nombre del cargo es requerido para la actualización." });
        }

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { nombre: nombre } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Cargo no encontrado para actualizar." });
        }
        
        res.status(200).json({ _id: id, nombre: nombre, message: "Cargo actualizado correctamente." });
    } catch (error) {
        console.error(`Error al actualizar cargo con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al actualizar cargo." });
    }
});

// Ruta para eliminar un cargo por su ID
// DELETE /api/cargos/:id
router.delete('/cargos/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('cargos');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de cargo inválido." });
        }

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Cargo no encontrado para eliminar." });
        }

        res.status(200).json({ message: "Cargo eliminado correctamente." });
    } catch (error) {
        console.error(`Error al eliminar cargo con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al eliminar cargo." });
    }
});

module.exports = {
    router,
    init
};
