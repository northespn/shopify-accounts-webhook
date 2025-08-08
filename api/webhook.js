import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export default async function handler(req, res) {
  // Alleen POST requests accepteren
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const order = req.body;
    
    // Controleer of het een geldige order is
    if (!order || !order.line_items || order.line_items.length === 0) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    // Check of order betaald is
    if (order.financial_status !== 'paid') {
      return res.status(200).json({ message: 'Order not paid yet, skipping' });
    }

    const quantity = order.line_items[0].quantity;
    const productSku = order.line_items[0].sku;
    const customerEmail = order.email || order.customer?.email;
    const orderNumber = order.order_number || order.name;

    // Check of het het juiste product is
    if (productSku !== "GAMING-ACCOUNT") {
      return res.status(200).json({ message: "Not a gaming account order, skipping" });
    }

    if (!customerEmail) {
      return res.status(400).json({ error: 'No customer email found' });
    }

    // Lees CSV bestand
    const csvData = readFileSync('./accounts.csv', 'utf-8');
    const allAccounts = parse(csvData, { columns: true });

    // Vind beschikbare accounts
    const availableAccounts = allAccounts.filter(acc => acc.status === 'beschikbaar');
    
    if (availableAccounts.length < quantity) {
      return res.status(400).json({ error: 'Not enough accounts available' });
    }

    // Selecteer benodigde accounts
    const selectedAccounts = availableAccounts.slice(0, quantity);

    // Markeer geselecteerde accounts als verkocht
    selectedAccounts.forEach(account => {
      account.status = 'verkocht';
    });

    // Schrijf bijgewerkte CSV terug
    const updatedCsv = stringify(allAccounts, { header: true });
    writeFileSync('./accounts.csv', updatedCsv);

    // Maak TXT content
    const txtContent = selectedAccounts.map(acc => 
      `${acc.username}:${acc.password}`
    ).join('\n');

    // Verstuur email
    await sendEmail(customerEmail, txtContent, orderNumber);

    res.status(200).json({ 
      success: true, 
      message: `Delivered ${quantity} accounts to ${customerEmail}`,
      accounts: selectedAccounts.length
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function sendEmail(email, content, orderNumber) {
  // Voor nu gewoon log naar console
  console.log(`Sending email to: ${email}`);
  console.log(`Order: ${orderNumber}`);
  console.log(`Content:\n${content}`);
  
  // Later implementeren met nodemailer
  return true;
}

// Export de handler function voor Vercel
module.exports = handler;
