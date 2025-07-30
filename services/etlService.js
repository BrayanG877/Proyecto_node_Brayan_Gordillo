const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { ObjectId } = require('mongodb');

// Ruta base donde se encuentran los archivos CSV
const RAW_DATA_PATH = path.join(__dirname, '..', 'data'); // Asegúrate de que esto coincida con tu carpeta 'data'

function loadCsv(filePath) {
    console.log(`[DEBUG - loadCsv] Intentando leer CSV desde: ${filePath}`);
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .on('error', (err) => {
                console.error(`[DEBUG - loadCsv] Error al crear stream de lectura para ${filePath}:`, err);
                reject(err);
            })
            .pipe(csv())
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', () => {
                console.log(`[DEBUG - loadCsv] Lectura de CSV finalizada. Filas encontradas: ${results.length}`);
                resolve(results);
            })
            .on('error', (error) => {
                console.error(`[DEBUG - loadCsv] Error durante el parseo de CSV para ${filePath}:`, error);
                reject(error);
            });
    });
}

async function loadAreas(client) {
    const db = client.db('acme_db');
    const collection = db.collection('areas');
    const filePath = path.join(RAW_DATA_PATH, 'areas.csv');
    console.log(`[ETL] Cargando áreas desde: ${filePath}`);

    try {
        const areasData = await loadCsv(filePath);
        console.log(`[DEBUG - loadAreas] Datos de áreas cargados del CSV: ${areasData.length} filas.`);
        if (areasData.length === 0) {
            console.warn("[DEBUG - loadAreas] No se encontraron datos en areas.csv. Saltando inserción.");
            return {};
        }
        
        const areaMap = {};
        for (const area of areasData) {
            const result = await collection.updateOne(
                { nombre: area.nombre },
                { $set: { nombre: area.nombre } },
                { upsert: true }
            );
            // console.log(`[DEBUG - loadAreas] Resultado updateOne para ${area.nombre}:`, result.upsertedCount, result.modifiedCount);
        }
        console.log(`[ETL] Áreas cargadas.`);

        const existingAreas = await collection.find({}).toArray();
        console.log(`[DEBUG - loadAreas] Áreas existentes en DB después de carga: ${existingAreas.length}`);
        for (const area of existingAreas) {
            areaMap[area.nombre] = area._id;
        }
        console.log("[DEBUG - loadAreas] areaMap final:", areaMap);
        return areaMap;

    } catch (error) {
        console.error("[ETL] Error al cargar áreas:", error);
        throw error;
    }
}

async function loadCargos(client) {
    const db = client.db('acme_db');
    const collection = db.collection('cargos');
    const filePath = path.join(RAW_DATA_PATH, 'cargos.csv');
    console.log(`[ETL] Cargando cargos desde: ${filePath}`);

    try {
        const cargosData = await loadCsv(filePath);
        console.log(`[DEBUG - loadCargos] Datos de cargos cargados del CSV: ${cargosData.length} filas.`);
        if (cargosData.length === 0) {
            console.warn("[DEBUG - loadCargos] No se encontraron datos en cargos.csv. Saltando inserción.");
            return {};
        }

        const cargoMap = {};
        for (const cargo of cargosData) {
            const result = await collection.updateOne(
                { nombre: cargo.nombre },
                { $set: { nombre: cargo.nombre } },
                { upsert: true }
            );
            // console.log(`[DEBUG - loadCargos] Resultado updateOne para ${cargo.nombre}:`, result.upsertedCount, result.modifiedCount);
        }
        console.log(`[ETL] Cargos cargados.`);

        const existingCargos = await collection.find({}).toArray();
        console.log(`[DEBUG - loadCargos] Cargos existentes en DB después de carga: ${existingCargos.length}`);
        for (const cargo of existingCargos) {
            cargoMap[cargo.nombre] = cargo._id;
        }
        console.log("[DEBUG - loadCargos] cargoMap final:", cargoMap);
        return cargoMap;

    } catch (error) {
        console.error("[ETL] Error al cargar cargos:", error);
        throw error;
    }
}

async function loadEmpleados(client, areaMap, cargoMap) {
    const db = client.db('acme_db');
    const collection = db.collection('empleados');
    const filePath = path.join(RAW_DATA_PATH, 'empleados.csv');
    console.log(`[ETL] Cargando empleados desde: ${filePath}`);

    try {
        const empleadosData = await loadCsv(filePath);
        console.log(`[DEBUG - loadEmpleados] Datos de empleados cargados del CSV: ${empleadosData.length} filas.`);
        if (empleadosData.length === 0) {
            console.warn("[DEBUG - loadEmpleados] No se encontraron datos en empleados.csv. Saltando inserción.");
            return;
        }

        // --- INICIO: CAMBIOS PARA QUITAR TRANSACCIONES ---
        for (const empleado of empleadosData) {
            const areaId = areaMap[empleado.area];
            const cargoId = cargoMap[empleado.cargo];

            if (!areaId) {
                console.warn(`[ETL] Área no encontrada para empleado ${empleado.documento}: ${empleado.area}. Saltando empleado.`);
                continue;
            }
            if (!cargoId) {
                console.warn(`[ETL] Cargo no encontrado para empleado ${empleado.documento}: ${empleado.cargo}. Saltando empleado.`);
                continue;
            }

            const newEmpleado = {
                documento: empleado.documento,
                nombre: empleado.nombre,
                apellido: empleado.apellido,
                email: empleado.email,
                edad: parseInt(empleado.edad),
                direccion: {
                    ciudad: empleado.ciudad,
                    barrio: empleado.barrio
                },
                roles: empleado.roles ? empleado.roles.split(',').map(r => r.trim()) : [],
                salarioBase: parseFloat(empleado.salarioBase),
                areaId: areaId,
                cargoId: cargoId,
                fechaContratacion: new Date(empleado.fechaContratacion)
            };

            const result = await collection.updateOne(
                { documento: newEmpleado.documento },
                { $set: newEmpleado },
                { upsert: true } // Quitar 'session' de aquí
            );
            // console.log(`[DEBUG - loadEmpleados] Resultado updateOne para ${newEmpleado.documento}:`, result.upsertedCount, result.modifiedCount);
        }
        console.log("[ETL] Empleados cargados exitosamente."); // Mensaje sin referencia a transacción
        // --- FIN: CAMBIOS PARA QUITAR TRANSACCIONES ---

    } catch (error) {
        console.error("[ETL] Error al cargar empleados:", error); // Mensaje de error general
        throw error;
    } finally {
        // Quitar 'session.endSession()' ya que no hay sesión
    }
}

async function loadNominas(client) {
    const db = client.db('acme_db');
    const nominasCollection = db.collection('nominas');
    const empleadosCollection = db.collection('empleados');
    const filePath = path.join(RAW_DATA_PATH, 'nominas.csv');
    console.log(`[ETL] Cargando nóminas desde: ${filePath}`);

    try {
        const nominasData = await loadCsv(filePath);
        console.log(`[DEBUG - loadNominas] Datos de nóminas cargados del CSV: ${nominasData.length} filas.`);
        if (nominasData.length === 0) {
            console.warn("[DEBUG - loadNominas] No se encontraron datos en nominas.csv. Saltando inserción.");
            return;
        }

        // --- INICIO: CAMBIOS PARA QUITAR TRANSACCIONES ---
        for (const nomina of nominasData) {
            const empleado = await empleadosCollection.findOne(
                { documento: nomina.documentoEmpleado } // Quitar '{ session }' de aquí
            );

            if (!empleado) {
                console.warn(`[ETL] Empleado no encontrado para nómina: ${nomina.documentoEmpleado}. Saltando nómina.`);
                continue;
            }

            const devengos = [];
            if (nomina.devengosConcepto1 && nomina.devengosValor1) {
                devengos.push({
                    _id: new ObjectId(),
                    concepto: nomina.devengosConcepto1,
                    valor: parseFloat(nomina.devengosValor1)
                });
            }
            if (nomina.devengosConcepto2 && nomina.devengosValor2) {
                devengos.push({
                    _id: new ObjectId(),
                    concepto: nomina.devengosConcepto2,
                    valor: parseFloat(nomina.devengosValor2)
                });
            }

            const deducciones = [];
            if (nomina.deduccionesConcepto1 && nomina.deduccionesValor1) {
                deducciones.push({
                    _id: new ObjectId(),
                    concepto: nomina.deduccionesConcepto1,
                    valor: parseFloat(nomina.deduccionesValor1)
                });
            }
            if (nomina.deduccionesConcepto2 && nomina.deduccionesValor2) {
                deducciones.push({
                    _id: new ObjectId(),
                    concepto: nomina.deduccionesConcepto2,
                    valor: parseFloat(nomina.deduccionesValor2)
                });
            }

            let totalDevengos = 0;
            for (const devengo of devengos) {
                totalDevengos += devengo.valor;
            }

            let totalDeducciones = 0;
            for (const deduccion of deducciones) {
                totalDeducciones += deduccion.valor;
            }
            
            const salarioBase = empleado.salarioBase;
            const salarioNeto = salarioBase + totalDevengos - totalDeducciones;

            const newNomina = {
                empleadoId: empleado._id,
                periodo: nomina.periodo,
                fechaEmision: new Date(nomina.fechaEmision),
                salarioBruto: salarioBase,
                devengos: devengos,
                deducciones: deducciones,
                totalDevengos: totalDevengos,
                totalDeducciones: totalDeducciones,
                salarioNeto: salarioNeto
            };

            const result = await nominasCollection.updateOne(
                { empleadoId: newNomina.empleadoId, periodo: newNomina.periodo },
                { $set: newNomina },
                { upsert: true } // Quitar 'session' de aquí
            );
            // console.log(`[DEBUG - loadNominas] Resultado updateOne para empleado ${nomina.documentoEmpleado}, periodo ${nomina.periodo}:`, result.upsertedCount, result.modifiedCount);
        }
        console.log("[ETL] Nóminas cargadas exitosamente."); // Mensaje sin referencia a transacción
        // --- FIN: CAMBIOS PARA QUITAR TRANSACCIONES ---

    } catch (error) {
        console.error("[ETL] Error al cargar nóminas:", error); // Mensaje de error general
        throw error;
    } finally {
        // Quitar 'session.endSession()' ya que no hay sesión
    }
}

module.exports = {
    loadAreas,
    loadCargos,
    loadEmpleados,
    loadNominas
};
