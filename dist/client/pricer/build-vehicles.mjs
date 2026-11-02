// Builds pricer/vehicles.json from the Design Studio vehicle bodies (studio/model.mjs) and the popular-model list below.
// Run: node pricer/build-vehicles.mjs   (from the site root)
import {PRODUCTS} from '../studio/model.mjs';
import fs from 'fs';
const TYPES = [];
for (const p of PRODUCTS.filter(p => p.bodies?.length)) TYPES.push({ id: p.id, name: p.name, ruleId: p.ruleId, bodies: p.bodies.map(b => ({ id: b.id, name: b.name, price: b.price || {}, img: '/studio/mockups/' + b.art + '-driver-side.webp', thumb: '/studio/mockups/' + b.art + '-thumb.webp' })) });
TYPES.push({ id: 'vehicle-bus', name: 'Bus', ruleId: 'wrap-bus', bodies: [] });
// Popular models → the closest Design Studio body (and a size override where the body list has no exact match).
const M = (names, body, set) => names.split(',').map(n => ({ name: n.trim(), body, ...(set ? { set } : {}) }));
const MODELS = [
  ...M('Honda Civic,Toyota Corolla,Mazda3,Nissan Sentra,Volkswagen Jetta,Kia Forte,Kia K4,Subaru Impreza,Nissan Versa,Volkswagen Golf,Hyundai Elantra,Mini Cooper,Toyota Prius,Hyundai Accent,Chevrolet Cruze,Honda Fit,Toyota GR86,Subaru BRZ,Mazda MX-5', 'sedan-corolla'),
  ...M('Toyota Camry,Honda Accord,Hyundai Sonata,Nissan Altima,Kia K5,Mazda6,Volkswagen Passat,Subaru Legacy,Chevrolet Malibu,Acura TLX,Lexus IS,Lexus ES,Audi A4,Audi A3,Mercedes-Benz C-Class,Mercedes-Benz CLA,Infiniti Q50,Genesis G70,Volvo S60,Cadillac CT4,Ford Mustang,Chevrolet Camaro,Polestar 2,Hyundai Ioniq 6', 'sedan-camry'),
  ...M('Tesla Model 3', 'sedan-model3'),
  ...M('BMW 3 Series,BMW 4 Series,BMW 2 Series', 'sedan-bmw3'),
  ...M('Dodge Charger,Chrysler 300,Tesla Model S,BMW 5 Series,BMW 7 Series,Mercedes-Benz E-Class,Mercedes-Benz S-Class,Audi A6,Audi A7,Audi A8,Genesis G80,Genesis G90,Lexus LS,Porsche Panamera,Cadillac CT5,Kia Stinger,Nissan Maxima,Toyota Avalon', 'sedan-accord', { vehicle_0: 'Full-size' }),
  ...M('Hyundai Kona,Hyundai Venue,Chevrolet Trax,Chevrolet Trailblazer,Nissan Kicks,Mazda CX-30,Honda HR-V,Subaru Crosstrek,Nissan Qashqai,Toyota Corolla Cross,Kia Seltos,Kia Soul,Jeep Compass,Jeep Renegade,Buick Encore,Volkswagen Taos,Ford Bronco Sport,Mitsubishi RVR,BMW X1,Mercedes-Benz GLA,Audi Q3,Lexus UX,Volvo XC40,Hyundai Kona Electric,Kia Niro,Chevrolet Bolt EUV', 'suv-midsize-compact'),
  ...M('Toyota RAV4,Honda CR-V,Nissan Rogue,Ford Escape,Hyundai Tucson,Kia Sportage,Mazda CX-5,Subaru Forester,Chevrolet Equinox,Volkswagen Tiguan,Jeep Cherokee,Tesla Model Y,Mitsubishi Outlander,GMC Terrain,Buick Envision,Lexus NX,Acura RDX,Audi Q5,BMW X3,Mercedes-Benz GLC,Volvo XC60,Genesis GV70,Lincoln Corsair,Cadillac XT4,Hyundai Ioniq 5,Kia EV6,Ford Mustang Mach-E,Volkswagen ID.4,Honda Prologue,Chevrolet Blazer,Ford Edge,Nissan Murano,Mazda CX-50,Subaru Outback,Toyota Venza,Porsche Macan', 'suv-rav4'),
  ...M('Hyundai Santa Fe,Kia Sorento,Mazda CX-70,Jeep Grand Cherokee,Lexus RX,Acura MDX,Cadillac XT5,Lincoln Nautilus,Genesis GV80,Porsche Cayenne,Audi Q7,Volvo XC90,BMW X5,Mercedes-Benz GLE', 'suv-fullsize-3row'),
  ...M('Ford Explorer,Toyota Highlander,Toyota Grand Highlander,Honda Pilot,Nissan Pathfinder,Volkswagen Atlas,Kia Telluride,Hyundai Palisade,Chevrolet Traverse,GMC Acadia,Buick Enclave,Mazda CX-90,Dodge Durango,Subaru Ascent,Jeep Grand Cherokee L,Kia EV9,Tesla Model X,Lincoln Aviator,Cadillac XT6', 'suv-explorer'),
  ...M('Infiniti QX60,Infiniti QX50,Acura ZDX,Lexus TX', 'suv-midsize-crossover'),
  ...M('Chevrolet Tahoe,Chevrolet Suburban,GMC Yukon,GMC Yukon XL,Ford Expedition,Toyota Sequoia,Nissan Armada,Cadillac Escalade,Lincoln Navigator,Jeep Wagoneer,Jeep Grand Wagoneer,Infiniti QX80,Lexus LX,Mercedes-Benz GLS,BMW X7', 'suv-tahoe'),
  ...M('Jeep Wrangler,Ford Bronco,Toyota 4Runner,Toyota Land Cruiser,Land Rover Defender,Mercedes-Benz G-Class,Lexus GX,Ineos Grenadier,Rivian R1S', 'suv-fullsize-offroad'),
  ...M('Ford F-150,Toyota Tundra,GMC Sierra 1500,Nissan Titan,Ford F-150 Lightning,Rivian R1T,Tesla Cybertruck', 'pickup-crew-med'),
  ...M('Chevrolet Silverado 1500', 'pickup-double-long'),
  ...M('Ram 1500,Ram 1500 Classic', 'pickup-ram-crew'),
  ...M('Ford F-150 Raptor,Ram 1500 TRX,Ram 1500 RHO,Chevrolet Silverado ZR2', 'pickup-crew-short'),
  ...M('Toyota Tacoma,Chevrolet Colorado,GMC Canyon,Ford Ranger,Nissan Frontier,Honda Ridgeline,Jeep Gladiator,Ford Maverick,Hyundai Santa Cruz', 'pickup-tacoma-double'),
  ...M('Ford F-250,Ford F-350,Chevrolet Silverado 2500HD,Chevrolet Silverado 3500HD,GMC Sierra 2500HD,GMC Sierra 3500HD,Ram 2500,Ram 3500', 'pickup-hd-crew'),
  ...M('Dodge Grand Caravan,Chrysler Grand Caravan,Chrysler Pacifica,Chrysler Voyager,Kia Carnival,Kia Sedona', 'minivan-passenger'),
  ...M('Toyota Sienna', 'minivan-sienna'),
  ...M('Honda Odyssey (2014–2017)', 'minivan-odyssey-2015'),
  ...M('Honda Odyssey,Honda Odyssey (2018+)', 'minivan-odyssey-2022'),
  ...M('Ford Transit Connect,Ram ProMaster City,Nissan NV200,Chevrolet City Express', 'minivan-compact-cargo'),
  ...M('Mercedes-Benz Metris', 'minivan-midsize-cargo'),
  ...M('Ford Transit,Ford Transit 130 Low Roof,Ford E-Transit', 'transit-130-low'),
  ...M('Ford Transit 148 Medium Roof', 'transit-148-medium'),
  ...M('Ford Transit 148 High Roof', 'transit-148-high'),
  ...M('Ford Transit 148 Extended High Roof', 'transit-148el-high'),
  ...M('Mercedes-Benz Sprinter,Mercedes-Benz Sprinter 144 Standard Roof,Freightliner Sprinter', 'sprinter-144-std'),
  ...M('Mercedes-Benz Sprinter 144 High Roof', 'sprinter-144-high'),
  ...M('Mercedes-Benz Sprinter 170 High Roof,Mercedes-Benz eSprinter', 'sprinter-170-high'),
  ...M('Ram ProMaster,Ram ProMaster 136 High Roof', 'promaster-136-high'),
  ...M('Ram ProMaster 159 High Roof', 'promaster-159-high'),
  ...M('Chevrolet Express,GMC Savana', 'express-135'),
  ...M('Chevrolet Express Extended,GMC Savana Extended', 'express-155'),
  ...M('Nissan NV,Nissan NV Standard Roof', 'nv-std'),
  ...M('Nissan NV High Roof', 'nv-high'),
  ...M('Ford E-450 Cutaway,Chevrolet Express Cutaway,Cube Van', 'cube-12'),
  ...M('Isuzu NPR,Hino 155,Box Truck 16 ft', 'box-16'),
  ...M('Isuzu NRR,Hino 195,Freightliner M2 106,International MV,Box Truck 20 ft', 'box-20'),
  ...M('Hino 268,Box Truck 26 ft,Straight Truck', 'box-26'),
  ...M('Step Van,Freightliner MT45,Ford P-Series', 'step-van-14'),
];
const bodyIds = new Set(TYPES.flatMap(t => t.bodies.map(b => b.id)));
for (const m of MODELS) if (!bodyIds.has(m.body)) throw new Error('Unknown body ' + m.body);
fs.writeFileSync(new URL('./vehicles.json', import.meta.url), JSON.stringify({ v: 1, types: TYPES, models: MODELS }));
console.log(TYPES.length, 'types,', bodyIds.size, 'bodies,', MODELS.length, 'models');
