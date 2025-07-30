const express = require('express');
const { ObjectId } = require('mongodb');

const router = express.Router();

let mongoClient;

function init(client) {
    mongoClient = client;
}

// Ruta para obtener todas las áreas
// GET /api/areas
router.get('/areas', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('areas');
        const areas = await collection.find({}).toArray();
        res.json(areas);
    } catch (error) {
        console.error("Error al obtener áreas:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener áreas." });
    }
});

// Ruta para obtener un área por su ID
// GET /api/areas/:id
router.get('/areas/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('areas');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de área inválido." });
        }

        const area = await collection.findOne({ _id: new ObjectId(id) });

        if (!area) {
            return res.status(404).json({ message: "Área no encontrada." });
        }

        res.json(area);
    } catch (error) {
        console.error(`Error al obtener área con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al obtener área." });
    }
});

// Ruta para crear una nueva área
// POST /api/areas
router.post('/areas', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('areas');
        const { nombre } = req.body; // Obtiene el nombre del cuerpo de la solicitud

        if (!nombre) {
            return res.status(400).json({ message: "El nombre del área es requerido." });
        }

        // Opcional: Verificar si el área ya existe para evitar duplicados exactos
        const existingArea = await collection.findOne({ nombre: nombre });
        if (existingArea) {
            return res.status(409).json({ message: "El área con este nombre ya existe." });
        }

        const result = await collection.insertOne({ nombre: nombre });
        // MongoDB 5.0+ insertOne devuelve insertedId directamente
        // Para versiones anteriores, podría ser result.ops[0]._id
        const newArea = { _id: result.insertedId, nombre: nombre };
        
        res.status(201).json(newArea); // 201 Created
    } catch (error) {
        console.error("Error al crear área:", error);
        res.status(500).json({ message: "Error interno del servidor al crear área." });
    }
});

// Ruta para actualizar un área por su ID
// PUT /api/areas/:id
router.put('/areas/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('areas');
        const id = req.params.id;
        const { nombre } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de área inválido." });
        }
        if (!nombre) {
            return res.status(400).json({ message: "El nombre del área es requerido para la actualización." });
        }

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { nombre: nombre } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Área no encontrada para actualizar." });
        }
        
        // Devolver el área actualizada (o al menos lo que se intentó actualizar)
        res.status(200).json({ _id: id, nombre: nombre, message: "Área actualizada correctamente." });
    } catch (error) {
        console.error(`Error al actualizar área con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al actualizar área." });
    }
});

// Ruta para eliminar un área por su ID
// DELETE /api/areas/:id
router.delete('/areas/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('areas');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de área inválido." });
        }

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Área no encontrada para eliminar." });
        }

        res.status(200).json({ message: "Área eliminada correctamente." });
    } catch (error) {
        console.error(`Error al eliminar área con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al eliminar área." });
    }
});

module.exports = {
    router,
    init
};
