export function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Live service prices are stored in integer paise. */
export function formatMoneyFromPaise(amountPaise: number, currency = 'INR') {
  const amount = amountPaise / 100
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-IN')}`
  }
}

export function paiseToMajorUnits(amountPaise: number) {
  return amountPaise / 100
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
