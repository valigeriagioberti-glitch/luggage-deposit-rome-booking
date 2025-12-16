import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.SITE_URL;

    if (!stripeKey) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
    if (!siteUrl) return res.status(500).json({ error: "Missing SITE_URL" });

    const stripe = new Stripe(stripeKey);

    const { items, billableDays, bookingId, dropOffDate, pickUpDate } = req.body || {};
    const days = Number(billableDays);

    if (!days || days < 1) return res.status(400).json({ error: "Invalid billableDays" });

    const line_items = (items || [])
      .filter((i) => Number(i.qty) > 0)
      .map((i) => ({
        price_data: {
          currency: "eur",
          product_data: { name: `${i.label} bag` },
          unit_amount: Number(i.unitAmount) * days // cents for all days
        },
        quantity: Number(i.qty)
      }));

    if (!line_items.length) return res.status(400).json({ error: "No items selected" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${siteUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/booking?canceled=1`,
      client_reference_id: bookingId || undefined,
      metadata: {
        dropOffDate: String(dropOffDate || ""),
        pickUpDate: String(pickUpDate || ""),
        billableDays: String(days)
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

// inside your create session handler:
const { booking } = req.body; // booking contains bookingRef, days, bags, total, etc.

const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items,
  success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/?canceled=1`,

  // ✅ attach identifiers
  metadata: {
    bookingRef: booking.bookingRef,      // e.g. "LDR-2025-000123"
    bookingId: booking.id,               // your uuid
    dropoff: booking.dropoffDate,
    pickup: booking.pickupDate,
  },

  // optional (helpful for receipts/invoices)
  customer_email: booking.email || undefined,
});

