import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Invoice from '@/database/models/invoice.model';
import { InvoiceService } from '@/lib/services/invoice.service';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/invoices/[id]/pdf
 * Download invoice as PDF (returns HTML with print styles)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }
    
    // Generate HTML for PDF/print
    const html = await InvoiceService.generateInvoiceHTML(invoice);
    
    // Wrap HTML with print-friendly styles and auto-print script
    const printableHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: white;
      margin: 0;
      padding: 20px;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #3B82F6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      z-index: 1000;
    }
    .print-btn:hover {
      background: #2563EB;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  ${html}
  <script>
    // Auto-trigger print dialog after a short delay
    setTimeout(() => {
      // Only auto-print if user explicitly requested PDF
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auto') === 'print') {
        window.print();
      }
    }, 500);
  </script>
</body>
</html>
    `;
    
    return new NextResponse(printableHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    return new NextResponse('Failed to generate invoice', { status: 500 });
  }
}

