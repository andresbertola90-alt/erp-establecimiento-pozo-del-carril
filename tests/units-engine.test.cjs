const test = require('node:test');
const assert = require('node:assert/strict');
const Units = require('../units-engine.js');

test('Units Engine: Conversión matemática de kilogramos a toneladas y viceversa', () => {
  // 1 t = 1.000 kg
  assert.equal(Units.kgToTonnes(1000), 1);
  assert.equal(Units.kgToTonnes(382500), 382.5);
  assert.equal(Units.kgToTonnes(0), 0);
  assert.equal(Units.tonnesToKg(1), 1000);
  assert.equal(Units.tonnesToKg(382.5), 382500);
  assert.equal(Units.tonnesToKg(0.25), 250);
});

test('Units Engine: Cálculo y conversión de rendimientos agrícolas (kg/ha, t/ha, qq/ha)', () => {
  // 45 ha con 382.500 kg (382,5 t) => 8.500 kg/ha = 8,5 t/ha = 85 qq/ha
  const y1 = Units.calcYield({ hectares: 45, productionKg: 382500 });
  assert.equal(y1.kgHa, 8500);
  assert.equal(y1.tonHa, 8.5);
  assert.equal(y1.qqHa, 85);

  // Mismo cálculo usando toneladas de producción
  const y2 = Units.calcYield({ hectares: 45, productionTons: 382.5 });
  assert.equal(y2.kgHa, 8500);
  assert.equal(y2.tonHa, 8.5);
  assert.equal(y2.qqHa, 85);

  // Conversiones directas entre unidades de rendimiento
  assert.equal(Units.yieldKgHaToTonHa(8500), 8.5);
  assert.equal(Units.yieldTonHaToKgHa(8.5), 8500);
  assert.equal(Units.yieldKgHaToQqHa(8500), 85);
  assert.equal(Units.yieldQqHaToKgHa(85), 8500);

  // Caso borde: 0 hectáreas no causa división por cero
  assert.equal(Units.calcYield({ hectares: 0, productionKg: 1000 }).kgHa, 0);
});

test('Units Engine: Conversión de líquidos y fitosanitarios (L <-> mL)', () => {
  assert.equal(Units.litersToMl(1), 1000);
  assert.equal(Units.litersToMl(2.5), 2500);
  assert.equal(Units.mlToLiters(2500), 2.5);
  assert.equal(Units.mlToLiters(350), 0.35);
});

test('Units Engine: Ganancia diaria de peso zootécnica (kg/día <-> g/día)', () => {
  assert.equal(Units.kgPerDayToGPerDay(0.88), 880);
  assert.equal(Units.gPerDayToKgPerDay(880), 0.88);

  // Cálculo de GDP entre pesajes: de 30 kg a 85 kg en 62 días
  const gdp = Units.calcDailyGain({ initialWeight: 30, finalWeight: 85, days: 62 });
  assert.equal(gdp.gainKg, 55);
  assert.ok(Math.abs(gdp.kgPerDay - 0.8871) < 0.001);
  assert.ok(Math.abs(gdp.gPerDay - 887.1) < 0.2);

  // Días cero o negativos retorna null
  assert.equal(Units.calcDailyGain({ initialWeight: 30, finalWeight: 85, days: 0 }), null);
});

test('Units Engine: Cálculo de peso total y peso promedio por cabeza', () => {
  // 120 cabezas a 105 kg/cab => 12.600 kg totales
  assert.equal(Units.calcTotalWeight({ heads: 120, avgWeightKg: 105 }), 12600);
  assert.equal(Units.calcAvgWeight({ totalWeightKg: 12600, heads: 120 }), 105);
  assert.equal(Units.calcAvgWeight({ totalWeightKg: 12600, heads: 0 }), 0);
});

test('Units Engine: Conversión de bolsas con factor kgPerBag', () => {
  assert.equal(Units.bagsToKg(10, 25), 250);
  assert.equal(Units.kgToBags(250, 25), 10);
  assert.equal(Units.bagsToKg(10, 0), 10); // Sin factor retorna bolsas
});

test('Units Engine: Conversión de precios ($/kg <-> $/t y liquidación ganadera)', () => {
  assert.equal(Units.priceKgToPriceTonne(2250), 2250000);
  assert.equal(Units.priceTonneToPriceKg(2250000), 2250);

  // Liquidación ganadera: 50 novillos de 400 kg a $ 2.100/kg
  const sale = Units.calcLivestockSaleValues({
    heads: 50,
    avgWeightKg: 400,
    pricePerKg: 2100
  });
  assert.equal(sale.totalWeightKg, 20000);
  assert.equal(sale.pricePerHead, 840000); // $ 2.100 * 400 kg
  assert.equal(sale.grossAmount, 42000000); // 20.000 kg * $ 2.100
});

test('Units Engine: Cálculo de conversión alimenticia (ICA) y mortandad', () => {
  // 300 kg alimento / 100 kg ganados = 3,00 kg/kg
  assert.equal(Units.calcICA({ feedConsumedKg: 300, weightGainedKg: 100 }), 3);
  assert.equal(Units.calcICA({ feedConsumedKg: 300, weightGainedKg: 0 }), null);

  // Mortandad: 4 muertes de 180 expuestos = 2,22 %
  const mort = Units.calcMortality({ deaths: 4, totalExposed: 180 });
  assert.equal(mort.deaths, 4);
  assert.equal(mort.ratePercent, 2.22);
});

test('Units Engine: Normalización de cadenas de unidades', () => {
  assert.equal(Units.normalizeUnit('kg'), 'kg');
  assert.equal(Units.normalizeUnit('kilos'), 'kg');
  assert.equal(Units.normalizeUnit('kilogramos'), 'kg');
  assert.equal(Units.normalizeUnit('t'), 't');
  assert.equal(Units.normalizeUnit('toneladas'), 't');
  assert.equal(Units.normalizeUnit('ha'), 'ha');
  assert.equal(Units.normalizeUnit('hectareas'), 'ha');
  assert.equal(Units.normalizeUnit('litros'), 'L');
  assert.equal(Units.normalizeUnit('ml'), 'mL');
  assert.equal(Units.normalizeUnit('cabezas'), 'cab');
  assert.equal(Units.normalizeUnit('bolsas'), 'bolsa');
});

test('Units Engine: Formateadores de doble lectura argentina', () => {
  assert.equal(Units.formatGrainWeight(120000, true), '120.000 kg (120,00 t)');
  assert.equal(Units.formatGrainWeight(120500), '120.500 kg (120,5 t)');
  assert.equal(Units.formatYieldDual(8500, true), '8.500 kg/ha (8,50 t/ha · 85,0 qq/ha)');
  assert.equal(Units.formatYieldDual(8500), '8.500 kg/ha (8,5 t/ha · 85 qq/ha)');
  assert.equal(Units.formatDailyGainDual(0.88, true), '0,880 kg/día (880 g/día)');
  assert.equal(Units.formatDailyGainDual(0.88), '0,88 kg/día (880 g/día)');
  assert.equal(Units.formatLiquidDual(2.5, true), '2,50 L (2.500 mL)');
  assert.equal(Units.formatLiquidDual(2.5), '2,5 L (2.500 mL)');
  assert.equal(Units.formatLivestockBatch({ heads: 100, avgWeightKg: 105 }, true), '100 cab · 105,0 kg/cab (10.500 kg en pie)');
  assert.equal(Units.formatLivestockBatch({ heads: 100, avgWeightKg: 105 }), '100 cab · 105 kg/cab (10.500 kg en pie)');
});

test('Units Engine: Validaciones y advertencias agronómicas/zootécnicas', () => {
  assert.equal(Units.validateCropYield('Maíz', 8500).ok, true);
  assert.equal(Units.validateCropYield('Maíz', 25000).warning, true);
  assert.equal(Units.validateSlaughterWeight('porcino', 105).ok, true);
  assert.equal(Units.validateSlaughterWeight('porcino', 40).warning, true);
  assert.equal(Units.validateSlaughterWeight('bovino', 410).ok, true);
  assert.equal(Units.validateSlaughterWeight('ovino', 35).ok, true);
});
