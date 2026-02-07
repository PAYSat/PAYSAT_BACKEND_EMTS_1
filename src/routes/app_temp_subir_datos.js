import { Router } from 'express';
import AppTempSubirDatosController from '../controllers/app_temp_subir_datos_controller.js';

const router = Router();
    
const appTempSubirDatos = new AppTempSubirDatosController();

router.post('/subir-datos', appTempSubirDatos.subirDatos);
router.get('/codigos-uuid', appTempSubirDatos.codigosUuid);


export default router;