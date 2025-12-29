import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Invoice from '@/database/models/invoice.model';
import { InvoiceService } from '@/lib/services/invoice.service';
import { requireAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/invoices/[id]/view
 * View invoice in browser (returns formatted HTML page)
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
      return new NextResponse(`
<!DOCTYPE html>
<html>
<head>
  <title>Invoice Not Found</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #111827;
      color: #F3F4F6;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    h1 { color: #EF4444; }
    a {
      color: #3B82F6;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Invoice Not Found</h1>
    <p>The invoice you're looking for doesn't exist or has been deleted.</p>
    <p><a href="javascript:window.close()">Close this window</a></p>
  </div>
</body>
</html>
      `, { 
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // Generate HTML for viewing
    const invoiceHtml = await InvoiceService.generateInvoiceHTML(invoice);
    
    // Wrap in a nice viewing page
    const viewableHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice ${invoice.invoiceNumber} - ${invoice.customerName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1F2937 0%, #111827 100%);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
    }
    .header {
      max-width: 800px;
      margin: 0 auto 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
    }
    .header h1 {
      color: #F3F4F6;
      font-size: 18px;
      margin: 0;
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #3B82F6;
      color: white;
    }
    .btn-primary:hover {
      background: #2563EB;
    }
    .btn-secondary {
      background: #374151;
      color: #F3F4F6;
    }
    .btn-secondary:hover {
      background: #4B5563;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    .invoice-content {
      padding: 40px;
    }
    .meta {
      max-width: 800px;
      margin: 20px auto 0;
      padding: 0 20px;
      color: #9CA3AF;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: white; padding: 0; }
      .header, .meta { display: none; }
      .invoice-container { 
        box-shadow: none; 
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Invoice ${invoice.invoiceNumber}</h1>
    <div class="actions">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Print
      </button>
      <a href="/api/invoices/${invoice._id}/pdf" class="btn btn-secondary" target="_blank">
        📥 Download
      </a>
      <button class="btn btn-secondary" onclick="window.close()">
        ✕ Close
      </button>
    </div>
  </div>
  
  <div class="invoice-container">
    <div class="invoice-content">
      ${invoiceHtml}
    </div>
  </div>
  
  <div class="meta">
    <span>Invoice ID: ${invoice._id}</span>
    <span>Generated: ${new Date().toLocaleString()}</span>
  </div>
</body>
</html>
    `;
    
    return new NextResponse(viewableHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error viewing invoice:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new NextResponse(`
<!DOCTYPE html>
<html>
<head>
  <title>Unauthorized</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #111827;
      color: #F3F4F6;
    }
    .container { text-align: center; padding: 40px; }
    h1 { color: #EF4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unauthorized</h1>
    <p>You must be logged in as an admin to view invoices.</p>
  </div>
</body>
</html>
      `, { 
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    return new NextResponse('Failed to load invoice', { status: 500 });
  }
}

