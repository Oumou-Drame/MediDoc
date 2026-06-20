const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

/**
 * Protect a PDF file with a password using pdf-lib
 * @param {string} inputPath - Path to the original PDF
 * @param {string} outputPath - Path to save the protected PDF
 * @param {string} password - Password to protect the PDF
 */
async function protectPdf(inputPath, outputPath, password) {
  try {
    // Read the original PDF
    const pdfBytes = fs.readFileSync(inputPath);
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Save the PDF with encryption
    const protectedBytes = await pdfDoc.save({
      userPassword: password,
      ownerPassword: password,
      permissions: {
        printing: 'highResolution',
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false,
      }
    });
    
    // Write the protected PDF
    fs.writeFileSync(outputPath, protectedBytes);
    
    console.log(`✅ PDF protégé avec succès: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la protection du PDF:', error);
    throw error;
  }
}

/**
 * Create a simple test PDF for testing purposes
 * @param {string} outputPath - Path to save the test PDF
 * @param {string} content - Text content for the PDF
 */
async function createTestPdf(outputPath, content = 'Résultats médicaux - Test MediDoc') {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    // Add text content
    page.drawText(content, {
      x: 50,
      y: 750,
      size: 24,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    page.drawText('Nom du patient: Test Patient', {
      x: 50,
      y: 700,
      size: 14,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    page.drawText('Date: ' + new Date().toLocaleDateString('fr-FR'), {
      x: 50,
      y: 670,
      size: 14,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    page.drawText('Résultats: Négatif', {
      x: 50,
      y: 640,
      size: 14,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    page.drawText('Laboratoire: MediDoc Lab', {
      x: 50,
      y: 610,
      size: 14,
      color: { red: 0, green: 0, blue: 0 },
    });
    
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    
    console.log(`✅ PDF de test créé: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création du PDF de test:', error);
    throw error;
  }
}

module.exports = { protectPdf, createTestPdf };