// Configuración de Nodemailer para PAYSAT
import nodemailer from 'nodemailer';

// export const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,     // tu-email@gmail.com
//     pass: process.env.EMAIL_PASSWORD  // contraseña de aplicación
//   }
// });

export const transporter = nodemailer.createTransport({
  host: 'mail.paysatmoney.com',
  port: 465, // Usa 465 para SSL, o 587 para TLS
  secure: true, // true para 465, false para 587
  auth: {
    user: process.env.EMAIL_USER,     // tu-email@tudominio.com
    pass: process.env.EMAIL_PASSWORD  // contraseña de la cuenta
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
  from: process.env.EMAIL_USER || 'noreply@paysatmoney.com',
  company: process.env.COMPANY_NAME || 'PAYSAT MONEY LTD',
  supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
};