export class CurrencyConversionRequiredError extends Error {
  constructor(unconverted) {
    const first = unconverted[0];
    const currencies = [...new Set(unconverted.map(q=>q.originalCurrency))].join(', ');
    super(`Duffel returned flight prices in ${currencies}, not CNY. Currency conversion is required before Timing can score them.${first ? ` Lowest preserved amount: ${first.originalCurrency} ${first.originalPrice}.` : ''}`);
    this.name = 'CurrencyConversionRequiredError';
    this.code = 'CURRENCY_CONVERSION_REQUIRED';
    this.status = 422;
    this.unconverted = unconverted;
  }
}

export function partitionByCny(quotes) {
  const scorable = [], unconverted = [];
  for (const quote of quotes) {
    if (quote.originalCurrency === 'CNY') scorable.push({...quote,price:quote.originalPrice,currency:'CNY',currencyConversionRequired:false});
    else unconverted.push({...quote,price:null,currency:null,currencyConversionRequired:true});
  }
  return {scorable,unconverted};
}
