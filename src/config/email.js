// Configuración de Nodemailer para PAYSAT
import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,     // tu-email@gmail.com
    pass: process.env.EMAIL_PASSWORD  // contraseña de aplicación
  }
});

// Verificar la conexión al inicializar
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en configuración de email:', error);
  } else {
    console.log('✅ Servidor de email configurado correctamente');
  }
});

// Configuración general de emails
export const emailConfig = {
  from: process.env.EMAIL_USER || 'noreply@paysat.com',
  company: 'PAYSAT',
  supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
};