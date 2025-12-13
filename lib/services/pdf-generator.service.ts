import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface InvoiceData {
  // Invoice Details
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  
  // Company Info
  companyName: string;
  companyAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  companyEmail?: string;
  companyVatNumber?: string;
  
  // Customer Info
  customerName: string;
  customerEmail: string;
  customerAddress?: {
    line1?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Line Items
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  
  // Totals
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  
  // Settings
  primaryColor?: string;
  showBankDetails?: boolean;
  bankName?: string;
  bankIban?: string;
  bankSwift?: string;
  paymentTerms?: string;
  thankYouMessage?: string;
  legalDisclaimer?: string;
  showLegalDisclaimer?: boolean;
}

/**
 * Format currency value
 */
function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Convert hex color to RGB (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 0.99, g: 0.83, b: 0.35 }; // Default yellow #FDD458
}

/**
 * Generate a professional invoice PDF using pdf-lib
 * No browser required - works on all platforms!
 */
export async function generateInvoicePDF(invoice: InvoiceData): Promise<{ buffer: Buffer; filename: string }> {
  console.log('🖨️ [PDF] Generating invoice PDF with pdf-lib...');
  
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed standard fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add a page
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    const { width, height } = page.getSize();
    
    // Colors
    const primaryColor = hexToRgb(invoice.primaryColor || '#FDD458');
    const darkGray = rgb(0.2, 0.2, 0.2);
    const mediumGray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.6, 0.6, 0.6);
    const accentColor = rgb(primaryColor.r, primaryColor.g, primaryColor.b);
    
    // Margins
    const margin = 50;
    const contentWidth = width - (margin * 2);
    let y = height - margin;
    
    // ==================== HEADER ====================
    // Company Name
    page.drawText(invoice.companyName, {
      x: margin,
      y: y,
      size: 20,
      font: helveticaBold,
      color: accentColor,
    });
    
    // Invoice Title (right side)
    const invoiceTitle = 'INVOICE';
    const titleWidth = helveticaBold.widthOfTextAtSize(invoiceTitle, 24);
    page.drawText(invoiceTitle, {
      x: width - margin - titleWidth,
      y: y,
      size: 24,
      font: helveticaBold,
      color: darkGray,
    });
    
    y -= 25;
    
    // Invoice number and date (right side)
    const invoiceNumWidth = helvetica.widthOfTextAtSize(invoice.invoiceNumber, 10);
    page.drawText(invoice.invoiceNumber, {
      x: width - margin - invoiceNumWidth,
      y: y,
      size: 10,
      font: helvetica,
      color: mediumGray,
    });
    
    y -= 14;
    
    const dateStr = formatDate(invoice.invoiceDate);
    const dateWidth = helvetica.widthOfTextAtSize(dateStr, 10);
    page.drawText(dateStr, {
      x: width - margin - dateWidth,
      y: y,
      size: 10,
      font: helvetica,
      color: mediumGray,
    });
    
    y -= 20;
    
    // Status badge
    const statusText = invoice.status.toUpperCase();
    const statusWidth = helveticaBold.widthOfTextAtSize(statusText, 8) + 16;
    const statusX = width - margin - statusWidth;
    const statusColor = invoice.status === 'paid' ? rgb(0.06, 0.73, 0.51) : 
                        invoice.status === 'sent' ? rgb(0.23, 0.51, 0.96) : rgb(0.96, 0.62, 0.04);
    
    // Status background
    page.drawRectangle({
      x: statusX,
      y: y - 4,
      width: statusWidth,
      height: 16,
      color: statusColor,
    });
    
    page.drawText(statusText, {
      x: statusX + 8,
      y: y,
      size: 8,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    
    // ==================== ADDRESSES ====================
    y -= 50;
    
    // FROM label
    page.drawText('FROM', {
      x: margin,
      y: y,
      size: 8,
      font: helveticaBold,
      color: lightGray,
    });
    
    // BILL TO label
    page.drawText('BILL TO', {
      x: width / 2 + 20,
      y: y,
      size: 8,
      font: helveticaBold,
      color: lightGray,
    });
    
    y -= 15;
    
    // Company name
    page.drawText(invoice.companyName, {
      x: margin,
      y: y,
      size: 11,
      font: helveticaBold,
      color: darkGray,
    });
    
    // Customer name
    page.drawText(invoice.customerName, {
      x: width / 2 + 20,
      y: y,
      size: 11,
      font: helveticaBold,
      color: darkGray,
    });
    
    y -= 14;
    
    // Company address
    if (invoice.companyAddress) {
      if (invoice.companyAddress.line1) {
        page.drawText(invoice.companyAddress.line1, {
          x: margin,
          y: y,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        y -= 12;
      }
      const cityPostal = `${invoice.companyAddress.city || ''} ${invoice.companyAddress.postalCode || ''}`.trim();
      if (cityPostal) {
        page.drawText(cityPostal, {
          x: margin,
          y: y,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        y -= 12;
      }
      if (invoice.companyAddress.country) {
        page.drawText(invoice.companyAddress.country, {
          x: margin,
          y: y,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        y -= 12;
      }
    }
    
    if (invoice.companyEmail) {
      page.drawText(invoice.companyEmail, {
        x: margin,
        y: y,
        size: 9,
        font: helvetica,
        color: mediumGray,
      });
      y -= 12;
    }
    
    if (invoice.companyVatNumber) {
      page.drawText(`VAT: ${invoice.companyVatNumber}`, {
        x: margin,
        y: y,
        size: 9,
        font: helvetica,
        color: mediumGray,
      });
    }
    
    // Customer email (at the same level as company details started)
    let customerY = height - margin - 25 - 14 - 20 - 50 - 15 - 14;
    page.drawText(invoice.customerEmail, {
      x: width / 2 + 20,
      y: customerY,
      size: 9,
      font: helvetica,
      color: mediumGray,
    });
    
    customerY -= 12;
    
    // Customer address
    if (invoice.customerAddress) {
      if (invoice.customerAddress.line1) {
        page.drawText(invoice.customerAddress.line1, {
          x: width / 2 + 20,
          y: customerY,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        customerY -= 12;
      }
      const customerCityPostal = `${invoice.customerAddress.city || ''} ${invoice.customerAddress.postalCode || ''}`.trim();
      if (customerCityPostal) {
        page.drawText(customerCityPostal, {
          x: width / 2 + 20,
          y: customerY,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        customerY -= 12;
      }
      if (invoice.customerAddress.country) {
        page.drawText(invoice.customerAddress.country, {
          x: width / 2 + 20,
          y: customerY,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
      }
    }
    
    // ==================== LINE ITEMS TABLE ====================
    y -= 60;
    const tableY = y;
    
    // Table header background
    page.drawRectangle({
      x: margin,
      y: y - 5,
      width: contentWidth,
      height: 25,
      color: rgb(0.95, 0.95, 0.97),
    });
    
    // Table headers
    page.drawText('DESCRIPTION', {
      x: margin + 10,
      y: y + 3,
      size: 8,
      font: helveticaBold,
      color: mediumGray,
    });
    
    page.drawText('QTY', {
      x: margin + contentWidth * 0.55,
      y: y + 3,
      size: 8,
      font: helveticaBold,
      color: mediumGray,
    });
    
    page.drawText('PRICE', {
      x: margin + contentWidth * 0.7,
      y: y + 3,
      size: 8,
      font: helveticaBold,
      color: mediumGray,
    });
    
    const totalHeader = 'TOTAL';
    const totalHeaderWidth = helveticaBold.widthOfTextAtSize(totalHeader, 8);
    page.drawText(totalHeader, {
      x: width - margin - totalHeaderWidth - 10,
      y: y + 3,
      size: 8,
      font: helveticaBold,
      color: mediumGray,
    });
    
    y -= 30;
    
    // Line items
    for (const item of invoice.lineItems) {
      page.drawText(item.description, {
        x: margin + 10,
        y: y,
        size: 10,
        font: helvetica,
        color: darkGray,
      });
      
      page.drawText(item.quantity.toString(), {
        x: margin + contentWidth * 0.55,
        y: y,
        size: 10,
        font: helvetica,
        color: mediumGray,
      });
      
      page.drawText(formatCurrency(item.unitPrice, invoice.currency), {
        x: margin + contentWidth * 0.7,
        y: y,
        size: 10,
        font: helvetica,
        color: mediumGray,
      });
      
      const itemTotal = formatCurrency(item.total, invoice.currency);
      const itemTotalWidth = helvetica.widthOfTextAtSize(itemTotal, 10);
      page.drawText(itemTotal, {
        x: width - margin - itemTotalWidth - 10,
        y: y,
        size: 10,
        font: helvetica,
        color: darkGray,
      });
      
      y -= 25;
    }
    
    // Table bottom line
    page.drawLine({
      start: { x: margin, y: y + 10 },
      end: { x: width - margin, y: y + 10 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });
    
    // ==================== TOTALS ====================
    y -= 20;
    const totalsX = width - margin - 180;
    
    // Subtotal
    page.drawText('Subtotal', {
      x: totalsX,
      y: y,
      size: 10,
      font: helvetica,
      color: mediumGray,
    });
    
    const subtotalStr = formatCurrency(invoice.subtotal, invoice.currency);
    const subtotalWidth = helvetica.widthOfTextAtSize(subtotalStr, 10);
    page.drawText(subtotalStr, {
      x: width - margin - subtotalWidth - 10,
      y: y,
      size: 10,
      font: helvetica,
      color: darkGray,
    });
    
    y -= 18;
    
    // VAT
    if (invoice.vatAmount > 0) {
      page.drawText(`VAT (${invoice.vatRate}%)`, {
        x: totalsX,
        y: y,
        size: 10,
        font: helvetica,
        color: mediumGray,
      });
      
      const vatStr = formatCurrency(invoice.vatAmount, invoice.currency);
      const vatWidth = helvetica.widthOfTextAtSize(vatStr, 10);
      page.drawText(vatStr, {
        x: width - margin - vatWidth - 10,
        y: y,
        size: 10,
        font: helvetica,
        color: mediumGray,
      });
      
      y -= 18;
    }
    
    // Total line
    page.drawLine({
      start: { x: totalsX, y: y + 8 },
      end: { x: width - margin, y: y + 8 },
      thickness: 2,
      color: accentColor,
    });
    
    y -= 8;
    
    // Total
    page.drawText('Total', {
      x: totalsX,
      y: y,
      size: 14,
      font: helveticaBold,
      color: darkGray,
    });
    
    const totalStr = formatCurrency(invoice.total, invoice.currency);
    const totalWidth = helveticaBold.widthOfTextAtSize(totalStr, 14);
    page.drawText(totalStr, {
      x: width - margin - totalWidth - 10,
      y: y,
      size: 14,
      font: helveticaBold,
      color: accentColor,
    });
    
    // ==================== FOOTER ====================
    y -= 50;
    
    // Payment terms
    if (invoice.paymentTerms) {
      page.drawText('PAYMENT INFORMATION', {
        x: margin,
        y: y,
        size: 8,
        font: helveticaBold,
        color: lightGray,
      });
      
      y -= 14;
      
      page.drawText(invoice.paymentTerms, {
        x: margin,
        y: y,
        size: 9,
        font: helvetica,
        color: mediumGray,
      });
      
      y -= 25;
    }
    
    // Bank details
    if (invoice.showBankDetails && invoice.bankName) {
      page.drawText('BANK DETAILS', {
        x: margin,
        y: y,
        size: 8,
        font: helveticaBold,
        color: lightGray,
      });
      
      y -= 14;
      
      if (invoice.bankName) {
        page.drawText(`Bank: ${invoice.bankName}`, {
          x: margin,
          y: y,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        y -= 12;
      }
      
      if (invoice.bankIban) {
        page.drawText(`IBAN: ${invoice.bankIban}`, {
          x: margin,
          y: y,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        y -= 12;
      }
      
      if (invoice.bankSwift) {
        page.drawText(`SWIFT: ${invoice.bankSwift}`, {
          x: margin,
          y: y,
          size: 9,
          font: helvetica,
          color: mediumGray,
        });
        y -= 12;
      }
      
      y -= 15;
    }
    
    // Thank you message
    if (invoice.thankYouMessage) {
      const thankYouWidth = helveticaBold.widthOfTextAtSize(invoice.thankYouMessage, 11);
      page.drawText(invoice.thankYouMessage, {
        x: (width - thankYouWidth) / 2,
        y: y,
        size: 11,
        font: helveticaBold,
        color: accentColor,
      });
      
      y -= 25;
    }
    
    // ==================== LEGAL DISCLAIMER ====================
    if (invoice.showLegalDisclaimer && invoice.legalDisclaimer) {
      // Check if we need a new page
      if (y < 150) {
        const newPage = pdfDoc.addPage([595, 842]);
        y = 842 - margin;
        
        // Draw on new page
        drawDisclaimer(newPage, margin, y, contentWidth, invoice, helvetica, helveticaBold, lightGray);
      } else {
        drawDisclaimer(page, margin, y, contentWidth, invoice, helvetica, helveticaBold, lightGray);
      }
    }
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    
    console.log(`🖨️ [PDF] PDF generated: ${buffer.length} bytes`);
    
    return {
      buffer,
      filename: `Invoice-${invoice.invoiceNumber}.pdf`,
    };
    
  } catch (error) {
    console.error('❌ [PDF] Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Draw legal disclaimer section
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawDisclaimer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  margin: number,
  y: number,
  contentWidth: number,
  invoice: InvoiceData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helvetica: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helveticaBold: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lightGray: any
) {
  // Divider line
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: margin + contentWidth, y: y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });
  
  y -= 15;
  
  // Title
  page.drawText('IMPORTANT LEGAL INFORMATION', {
    x: margin,
    y: y,
    size: 8,
    font: helveticaBold,
    color: lightGray,
  });
  
  y -= 15;
  
  // Clean and truncate disclaimer
  let disclaimer = invoice.legalDisclaimer || '';
  disclaimer = disclaimer
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\{\{companyName\}\}/g, invoice.companyName)
    .replace(/\{\{companyEmail\}\}/g, invoice.companyEmail || '')
    .replace(/\{\{vatNumber\}\}/g, invoice.companyVatNumber || '');
  
  // Split into lines (simple word wrap)
  const words = disclaimer.split(/\s+/);
  const maxWidth = contentWidth - 10;
  let currentLine = '';
  const lines: string[] = [];
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = helvetica.widthOfTextAtSize(testLine, 7);
    
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Draw lines (limit to avoid overflow)
  const maxLines = 25;
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    page.drawText(lines[i], {
      x: margin,
      y: y,
      size: 7,
      font: helvetica,
      color: rgb(0.55, 0.55, 0.55),
    });
    y -= 10;
  }
  
  if (lines.length > maxLines) {
    page.drawText('...', {
      x: margin,
      y: y,
      size: 7,
      font: helvetica,
      color: rgb(0.55, 0.55, 0.55),
    });
  }
}

/**
 * Generate PDF from raw HTML (fallback - simplified version)
 */
export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  console.log('🖨️ [PDF] Generating simple PDF from HTML...');
  
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Strip HTML tags
    const textContent = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000); // Limit text length
    
    // Simple text wrapping
    const words = textContent.split(' ');
    let y = 800;
    let line = '';
    
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (helvetica.widthOfTextAtSize(testLine, 10) > 500) {
        page.drawText(line, { x: 50, y, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
        line = word;
        y -= 14;
        if (y < 50) break;
      } else {
        line = testLine;
      }
    }
    if (line && y >= 50) {
      page.drawText(line, { x: 50, y, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    }
    
    const pdfBytes = await pdfDoc.save();
    console.log(`🖨️ [PDF] PDF generated: ${pdfBytes.length} bytes`);
    
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('❌ [PDF] Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
