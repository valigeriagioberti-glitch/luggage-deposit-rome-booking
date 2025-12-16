import { BagSize, BookingDetails, BagQuantities } from '../types';
import { PRICES } from '../constants';

export const calculateBillableDays = (start: string, end: string): number => {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (endDate < startDate) return 0;

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
};

export const calculateDailySubtotal = (bagQuantities: BagQuantities): number => {
  let daily = 0;
  daily += bagQuantities[BagSize.Small] * PRICES[BagSize.Small].pricePerDay;
  daily += bagQuantities[BagSize.Medium] * PRICES[BagSize.Medium].pricePerDay;
  daily += bagQuantities[BagSize.Large] * PRICES[BagSize.Large].pricePerDay;
  return daily;
};

export const calculateTotal = (bagQuantities: BagQuantities, days: number): number => {
  const dailyTotal = calculateDailySubtotal(bagQuantities);
  return dailyTotal * days;
};

export const generateBookingId = (): string => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `LDR-${yyyy}${mm}${dd}-${random}`;
};

export const saveBooking = (booking: BookingDetails): void => {
  console.log("Saving booking to DB:", booking);

  const existing: BookingDetails[] = JSON.parse(localStorage.getItem('bookings') || '[]');
  existing.push(booking);
  localStorage.setItem('bookings', JSON.stringify(existing));

  localStorage.setItem('latestBooking', JSON.stringify(booking));
};

export const startStripeCheckout = async (params: {
  bookingId: string;
  dropOffDate: string;
  pickUpDate: string;
  billableDays: number;
  bagQuantities: BagQuantities;
}): Promise<void> => {
  const { bookingId, dropOffDate, pickUpDate, billableDays, bagQuantities } = params;

  if (!billableDays || billableDays < 1) {
    throw new Error("Invalid billable days");
  }

  const totalQty =
    bagQuantities[BagSize.Small] +
    bagQuantities[BagSize.Medium] +
    bagQuantities[BagSize.Large];

  if (totalQty < 1) {
    throw new Error("Please select at least 1 bag");
  }

  const items = [
    { label: "Small", qty: bagQuantities[BagSize.Small], unitAmount: Math.round(PRICES[BagSize.Small].pricePerDay * 100) },
    { label: "Medium", qty: bagQuantities[BagSize.Medium], unitAmount: Math.round(PRICES[BagSize.Medium].pricePerDay * 100) },
    { label: "Large", qty: bagQuantities[BagSize.Large], unitAmount: Math.round(PRICES[BagSize.Large].pricePerDay * 100) },
  ];

  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId,
      dropOffDate,
      pickUpDate,
      billableDays,
      items,
    }),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Stripe checkout failed (HTTP ${res.status})`);
  }

  window.location.href = data.url;
};
