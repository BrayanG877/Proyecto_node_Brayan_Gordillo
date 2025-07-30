const express = require('express');
const { ObjectId } = require('mongodb');

const router = express.Router();

let mongoClient;

function init(client) {
    mongoClient = client;
}

// Ruta para obtener todos los empleados
// GET /api/empleados
router.get('/empleados', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('empleados');
        
        const empleados = await collection.aggregate([
            {
                $lookup: {
                    from: 'areas',
                    localField: 'areaId',
                    foreignField: '_id',
                    as: 'area'
                }
            },
            {
                $unwind: { path: '$area', preserveNullAndEmptyArrays: true }
            },
            {
                $lookup: {
                    from: 'cargos',
                    localField: 'cargoId',
                    foreignField: '_id',
                    as: 'cargo'
                }
            },
            {
                $unwind: { path: '$cargo', preserveNullAndEmptyArrays: true }
            }
        ]).toArray();

        res.json(empleados);
    } catch (error) {
        console.error("Error al obtener empleados:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener empleados." });
    }
});

// Ruta para obtener un empleado por su ID
// GET /api/empleados/:id
router.get('/empleados/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('empleados');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de empleado inválido." });
        }

        const empleado = await collection.aggregate([
            { $match: { _id: new ObjectId(id) } },
            {
                $lookup: {
                    from: 'areas',
                    localField: 'areaId',
                    foreignField: '_id',
                    as: 'area'
                }
            },
            {
                $unwind: { path: '$area', preserveNullAndEmptyArrays: true }
            },
            {
                $lookup: {
                    from: 'cargos',
                    localField: 'cargoId',
                    foreignField: '_id',
                    as: 'cargo'
                }
            },
            {
                $unwind: { path: '$cargo', preserveNullAndEmptyArrays: true }
            }
        ]).toArray();

        if (empleado.length === 0) {
            return res.status(404).json({ message: "Empleado no encontrado." });
        }

        res.json(empleado[0]);
    } catch (error) {
        console.error(`Error al obtener empleado con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al obtener empleado." });
    }
});

// Ruta para crear un nuevo empleado
// POST /api/empleados
router.post('/empleados', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('empleados');
        const { documento, nombre, apellido, email, edad, ciudad, barrio, roles, salarioBase, areaId, cargoId, fechaContratacion } = req.body;

        // Validaciones básicas
        if (!documento || !nombre || !apellido || !email || !salarioBase || !areaId || !cargoId || !fechaContratacion) {
            return res.status(400).json({ message: "Faltan campos obligatorios para crear el empleado." });
        }
        if (!ObjectId.isValid(areaId) || !ObjectId.isValid(cargoId)) {
            return res.status(400).json({ message: "ID de área o cargo inválido." });
        }

        // Verificar si el documento ya existe
        const existingEmpleado = await collection.findOne({ documento: documento });
        if (existingEmpleado) {
            return res.status(409).json({ message: "Ya existe un empleado con este documento." });
        }

        const newEmpleado = {
            documento,
            nombre,
            apellido,
            email,
            edad: parseInt(edad),
            direccion: { ciudad, barrio },
            roles: Array.isArray(roles) ? roles : (roles ? roles.split(',').map(r => r.trim()) : []),
            salarioBase: parseFloat(salarioBase),
            areaId: new ObjectId(areaId), // Convertir a ObjectId
            cargoId: new ObjectId(cargoId), // Convertir a ObjectId
            fechaContratacion: new Date(fechaContratacion)
        };

        const result = await collection.insertOne(newEmpleado);
        res.status(201).json({ _id: result.insertedId, ...newEmpleado });
    } catch (error) {
        console.error("Error al crear empleado:", error);
        res.status(500).json({ message: "Error interno del servidor al crear empleado." });
    }
});

// Ruta para actualizar un empleado por su ID
// PUT /api/empleados/:id
router.put('/empleados/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('empleados');
        const id = req.params.id;
        const { documento, nombre, apellido, email, edad, ciudad, barrio, roles, salarioBase, areaId, cargoId, fechaContratacion } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de empleado inválido." });
        }
        // Validaciones básicas para actualización (puedes hacerlas más estrictas si es necesario)
        if (!documento || !nombre || !apellido || !email || !salarioBase || !areaId || !cargoId || !fechaContratacion) {
            return res.status(400).json({ message: "Faltan campos obligatorios para actualizar el empleado." });
        }
        if (!ObjectId.isValid(areaId) || !ObjectId.isValid(cargoId)) {
            return res.status(400).json({ message: "ID de área o cargo inválido para actualización." });
        }

        const updatedEmpleado = {
            documento,
            nombre,
            apellido,
            email,
            edad: parseInt(edad),
            direccion: { ciudad, barrio },
            roles: Array.isArray(roles) ? roles : (roles ? roles.split(',').map(r => r.trim()) : []),
            salarioBase: parseFloat(salarioBase),
            areaId: new ObjectId(areaId), // Convertir a ObjectId
            cargoId: new ObjectId(cargoId), // Convertir a ObjectId
            fechaContratacion: new Date(fechaContratacion)
        };

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedEmpleado }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Empleado no encontrado para actualizar." });
        }
        
        res.status(200).json({ _id: id, ...updatedEmpleado, message: "Empleado actualizado correctamente." });
    } catch (error) {
        console.error(`Error al actualizar empleado con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al actualizar empleado." });
    }
});

// Ruta para eliminar un empleado por su ID
// DELETE /api/empleados/:id
router.delete('/empleados/:id', async (req, res) => {
    try {
        const db = mongoClient.db('acme_db');
        const collection = db.collection('empleados');
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de empleado inválido." });
        }

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Empleado no encontrado para eliminar." });
        }

        res.status(200).json({ message: "Empleado eliminado correctamente." });
    } catch (error) {
        console.error(`Error al eliminar empleado con ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al eliminar empleado." });
    }
});

module.exports = {
    router,
    init
};