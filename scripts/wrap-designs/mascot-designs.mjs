// 44 mascot wrap designs (flat cartoon characters from dist/client/studio/mascots.mjs) for
// /satin/shop/vehicle-wrap-designs/<slug>. Same contract as art.mjs: draw(slug, W, H, {mirror, zone}) → SVG.
import { mascotMarkup, shade } from '../../dist/client/studio/mascots.mjs';
const FONT = "Inter, 'Inter Display', Arial, Helvetica, sans-serif";

// slug, name, industry, colour name, [a, b], mascot, layout, services line, description, background ('light' | 'a' | 'dark')
const RAW = [
  ['pipe-pal-plumbing', 'Pipe Pal Plumbing', 'Plumbing', 'Blue / Yellow', ['#1f7ae0', '#ffc61a'], 'drip', 'wave', 'Plumbing · Drains · Water heaters', 'A friendly water-drop mascot with a wrench riding blue waves — easy to spot in any driveway.'],
  ['drain-hero', 'Drain Hero', 'Plumbing', 'Navy / Teal', ['#16325c', '#1fc8c8'], 'drip', 'diagonal', '24/7 drains · Sewer camera · Repairs', 'Bold navy rear panel and a drop mascot ready for emergency calls.', 'light', '#1fc8c8'],
  ['sparky-electric', 'Sparky Electric', 'Electrical', 'Yellow / Charcoal', ['#ffd400', '#262c36'], 'sparky', 'burst', 'Panels · EV chargers · Lighting', 'A light-bulb electrician on a high-voltage burst — bright, friendly and impossible to miss.', 'dark'],
  ['bright-spark-electrical', 'Bright Spark Electrical', 'Electrical', 'Blue / Yellow', ['#2457d6', '#ffd400'], 'sparky', 'stripes', 'Residential · Commercial · Service calls', 'Speed stripes in royal blue and yellow with the Sparky mascot up front.'],
  ['live-wire-electric', 'Live Wire Electric', 'Electrical', 'Black / Orange', ['#ff7a1a', '#16181d'], 'sparky', 'band', 'Wiring · Upgrades · Inspections', 'A charcoal band with orange accents — a strong, professional look for electrical fleets.'],
  ['cool-breeze-hvac', 'Cool Breeze HVAC', 'HVAC', 'Ice blue / Red', ['#4fb4ff', '#e8314a'], 'chilly', 'split', 'Heating · Cooling · Maintenance', 'Hot-and-cold split with an ice-cube mascot — says HVAC at a glance.'],
  ['comfort-zone-heating', 'Comfort Zone Heating', 'HVAC', 'Orange / Navy', ['#ff6a1a', '#1b2d55'], 'blaze', 'diagonal', 'Furnaces · Boilers · Heat pumps', 'A cheerful flame mascot on a deep-navy panel for heating specialists.'],
  ['roof-buddy', 'Roof Buddy', 'Roofing', 'Red / Charcoal', ['#d62f3d', '#2a2f38'], 'homey', 'chevron', 'Roof repair · Shingles · Eavestrough', 'Rooftop chevrons and a smiling house mascot for roofing crews.'],
  ['reno-ready', 'Reno Ready', 'Renovation', 'Red / Grey', ['#e23140', '#8e99a6'], 'toolie', 'band', 'Renovations · Repairs · Handyman', 'A toolbox mascot on a clean red band — perfect for handyman and reno trucks.'],
  ['max-build-construction', 'Max Build Construction', 'Construction', 'Yellow / Black', ['#ffc21a', '#16181d'], 'hardhat', 'hazard', 'General contracting · Excavation · Concrete', 'Hazard-stripe base and a hard-hat builder mascot for construction fleets.'],
  ['fresh-cut-landscaping', 'Fresh Cut Landscaping', 'Landscaping', 'Green / Lime', ['#2f9e44', '#a8dd5a'], 'sprout', 'wave', 'Lawn care · Gardens · Snow removal', 'Rolling green hills and a sprout mascot for lawn and garden crews.'],
  ['green-thumb-lawn', 'Green Thumb Lawn', 'Landscaping', 'Forest / Yellow', ['#1d6b3a', '#ffd23f'], 'sprout', 'diagonal', 'Mowing · Sod · Interlock', 'Forest-green rear block with a sunny accent stripe and the Sprout mascot.'],
  ['paint-pro-rollo', 'Paint Pro', 'Painting', 'Blue / White', ['#2f5cff', '#ffffff'], 'roller', 'splash', 'Interior · Exterior · Commercial painting', 'Paint splashes and a roller mascot — fun and clearly a painting company.'],
  ['colour-crew-painting', 'Colour Crew Painting', 'Painting', 'Magenta / Yellow', ['#d42d80', '#ffc61a'], 'roller', 'drip', 'Painting · Drywall · Wallpaper', 'Bright paint drips from the roofline with the Rollo mascot.'],
  ['glossy-floors-epoxy', 'Glossy Floors Epoxy', 'Epoxy', 'Purple / Silver', ['#7b4dff', '#c3cad2'], 'glossy', 'drip', 'Epoxy floors · Garages · Basements', 'A glossy pour mascot with liquid drips — made for epoxy floor installers.'],
  ['epoxy-pro-garage', 'Epoxy Pro Garage', 'Epoxy', 'Orange / Charcoal', ['#ff7a1a', '#2a2f38'], 'glossy', 'flake', 'Flake floors · Metallic epoxy · Polyaspartic', 'Charcoal body with flake-floor speckles and an orange pour mascot.', 'dark'],
  ['resin-shine', 'Resin Shine', 'Epoxy', 'Teal / Black', ['#13b5b1', '#16181d'], 'glossy', 'swoosh', 'Metallic floors · Countertops · Commercial', 'Glossy teal swooshes for resin and coating specialists.'],
  ['party-pop-events', 'Party Pop Events', 'Events & Decor', 'Pink / Yellow', ['#ff4f7b', '#ffd23f'], 'balloon', 'confetti', 'Balloons · Backdrops · Party rentals', 'Confetti everywhere and a balloon mascot for party and event companies.', 'a'],
  ['balloon-bliss', 'Balloon Bliss', 'Events & Decor', 'Purple / Gold', ['#7c4dff', '#ffc845'], 'balloon', 'bubbles', 'Balloon arches · Centrepieces · Weddings', 'Floating circles in purple and gold with a cheerful balloon.'],
  ['sweet-celebrations', 'Sweet Celebrations', 'Events & Decor', 'Pink / Blue', ['#ff8fc0', '#3fb0ff'], 'cupcake', 'confetti', 'Event decor · Dessert tables · Kids parties', 'Pastel confetti and a cupcake mascot for event styling and dessert tables.'],
  ['gala-decor', 'Gala Decor', 'Events & Decor', 'Black / Gold', ['#d9a63a', '#121214'], 'balloon', 'stars', 'Weddings · Corporate events · Rentals', 'Elegant black with gold stars — a classy mascot wrap for decor studios.', 'dark'],
  ['hammer-time-carpentry', 'Hammer Time Carpentry', 'Carpentry & Kitchens', 'Wood / Grey', ['#c98a4b', '#5b6470'], 'hammy', 'wood', 'Framing · Decks · Trim', 'Warm wood-grain planks with a hammer mascot for carpenters.'],
  ['sawyer-woodworks', 'Sawyer Woodworks', 'Carpentry & Kitchens', 'Orange / Charcoal', ['#e8a03c', '#2a2f38'], 'saw', 'stripes', 'Custom woodwork · Fences · Stairs', 'Saw-tooth stripes and a saw mascot in workshop orange.'],
  ['kitchen-craft', 'Kitchen Craft', 'Carpentry & Kitchens', 'Teal / Cream', ['#2f6f73', '#e9dcc6'], 'cabby', 'tiles', 'Kitchens · Cabinets · Countertops', 'Backsplash tiles and a cabinet mascot for kitchen installers.'],
  ['cabinet-co', 'Cabinet Co.', 'Carpentry & Kitchens', 'Navy / Oak', ['#1f3556', '#d6b07a'], 'cabby', 'diagonal', 'Custom cabinets · Millwork · Vanities', 'Navy and oak — a refined mascot design for cabinet makers.'],
  ['fine-finish-millwork', 'Fine Finish Millwork', 'Carpentry & Kitchens', 'Black / Gold', ['#d4a24a', '#121214'], 'hammy', 'band', 'Millwork · Built-ins · Finishing', 'Black and gold band with the Hammy mascot for high-end finishing carpenters.'],
  ['burger-buddy-truck', 'Burger Buddy Truck', 'Food & Restaurants', 'Red / Yellow', ['#e8314a', '#ffc61a'], 'burgie', 'checker', 'Burgers · Fries · Shakes', 'A burger mascot on a diner checker band — made for food trucks.', 'a'],
  ['slice-life-pizza', 'Slice of Life Pizza', 'Food & Restaurants', 'Red / Cream', ['#d62f3d', '#ffc845'], 'slice', 'checker', 'Pizza · Wings · Delivery', 'Classic red checker and a pizza-slice mascot for pizzerias and delivery cars.'],
  ['brew-bros-coffee', 'Brew Bros Coffee', 'Food & Restaurants', 'Brown / Cream', ['#7a4a2a', '#f3e2c7'], 'cuppa', 'wave', 'Coffee · Espresso · Catering', 'Coffee-coloured waves and a smiling cup for cafes and coffee trucks.'],
  ['sweet-tooth-bakery', 'Sweet Tooth Bakery', 'Food & Restaurants', 'Pink / Mint', ['#ff7fb0', '#6fd6b8'], 'cupcake', 'bubbles', 'Cakes · Cupcakes · Pastries', 'Pastel bubbles and a cupcake mascot for bakeries and dessert delivery.'],
  ['chef-on-wheels', 'Chef on Wheels', 'Food & Restaurants', 'Red / Black', ['#e8314a', '#1c1d22'], 'chef', 'stripes', 'Catering · Meal prep · Private chef', 'A chef mascot with fast stripes for catering vans.'],
  ['grill-master-bbq', 'Grill Master BBQ', 'Food & Restaurants', 'Orange / Black', ['#ff6a1a', '#16181d'], 'blaze', 'flames', 'BBQ · Smokehouse · Catering', 'Flames along the bottom and a fire mascot for barbecue trucks.', 'dark'],
  ['sparkle-squad-cleaning', 'Sparkle Squad Cleaning', 'Cleaning', 'Teal / Pink', ['#1fb5b5', '#ff5aa5'], 'bubbly', 'bubbles', 'Home cleaning · Deep cleans · Move-outs', 'Soap bubbles and a cleaning mascot with a spray bottle.'],
  ['fresh-n-clean-maids', 'Fresh n Clean Maids', 'Cleaning', 'Pink / Sky blue', ['#ff5aa5', '#39b4ff'], 'sprayer', 'wave', 'Maid service · Offices · Airbnb turnovers', 'Fresh waves and a spray-bottle mascot for maid services.'],
  ['carpet-care-pros', 'Carpet Care Pros', 'Cleaning', 'Purple / Teal', ['#6a3fd4', '#1fc8c8'], 'sprayer', 'diagonal', 'Carpet · Upholstery · Rugs', 'Purple rear block with a teal stripe and the Squirt mascot.'],
  ['bug-guard-pest', 'Bug Guard Pest Control', 'Pest Control', 'Green / Navy', ['#2fb36b', '#1f2a44'], 'shieldy', 'band', 'Pest control · Rodents · Wasps', 'A shield mascot that says “protected” — clean and trustworthy for pest control.'],
  ['box-it-movers', 'Box It Movers', 'Moving & Junk', 'Red / Kraft', ['#e23140', '#d9a066'], 'boxy', 'stripes', 'Moving · Packing · Storage', 'A cardboard-box mascot with motion stripes for moving trucks.'],
  ['junk-gone', 'Junk Gone', 'Moving & Junk', 'Green / Black', ['#3bbf4a', '#16181d'], 'boxy', 'hazard', 'Junk removal · Cleanouts · Demolition', 'Bold green and black for junk-removal trucks, with the Boxy mascot.'],
  ['home-sweet-realty', 'Home Sweet Realty', 'Real Estate', 'Navy / Gold', ['#1f3556', '#d4a24a'], 'homey', 'diagonal', 'Buying · Selling · Leasing', 'A smiling-house mascot on navy and gold for agents and brokerages.'],
  ['paws-and-play', 'Paws & Play', 'Pets', 'Orange / Teal', ['#ff8a3d', '#1fb5b5'], 'pup', 'paws', 'Grooming · Dog walking · Pet supplies', 'Paw prints and a puppy mascot for groomers, walkers and pet shops.'],
  ['flex-fit-gym', 'Flex Fit Gym', 'Fitness', 'Orange / Black', ['#ff5a1f', '#16181d'], 'flexy', 'stripes', 'Personal training · Classes · Bootcamps', 'A strong dumbbell mascot with energetic stripes for gyms and trainers.', 'dark'],
  ['drive-smart-school', 'Drive Smart School', 'Driving School', 'Red / Blue', ['#e8314a', '#2457d6'], 'wheelie', 'road', 'G1 · G2 · G lessons', 'A friendly car mascot on a road stripe — made for driving schools.'],
  ['swift-courier', 'Swift Courier', 'Logistics', 'Yellow / Black', ['#ffc61a', '#16181d'], 'boxy', 'stripes', 'Same-day delivery · Courier · Freight', 'A parcel mascot with speed stripes for courier and delivery vans.'],
  ['auto-spa-detailing', 'Auto Spa Detailing', 'Auto Services', 'Blue / Silver', ['#1f7ae0', '#c3cad2'], 'wheelie', 'bubbles', 'Detailing · Ceramic coating · Mobile wash', 'Foam bubbles and a shiny car mascot for mobile detailers.'],
];
export const MASCOT_DESIGNS = RAW.map(([slug, name, ind, col, c, m, layout, tag, d, bg = 'light', mc]) => ({ slug, name, style: 'Mascot', ind, col, c, m, layout, tag, d, bg, mc }));

const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hash = s => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7) || 1;

// Background graphics per layout (vehicle faces left: x = 0 is the front). Rear = right side.
const LAYOUT = {
  wave: (W, H, a, b) => `<path d="M0 ${H * .74} C${W * .2} ${H * .6} ${W * .4} ${H * .86} ${W * .62} ${H * .7} S${W * .92} ${H * .56} ${W * 1.05} ${H * .62} L${W * 1.05} ${H} L0 ${H} Z" fill="${b}"/>
    <path d="M0 ${H * .82} C${W * .25} ${H * .7} ${W * .45} ${H * .94} ${W * .7} ${H * .78} S${W} ${H * .7} ${W * 1.05} ${H * .74} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>
    <path d="M${W * .7} 0 C${W * .78} ${H * .12} ${W * .92} ${H * .06} ${W * 1.05} ${H * .16} L${W * 1.05} 0 Z" fill="${a}"/>`,
  diagonal: (W, H, a, b) => `<path d="M${W * .4} 0 L${W * 1.05} 0 L${W * 1.05} ${H} L${W * .3} ${H} Z" fill="${a}"/>
    <path d="M${W * .37} 0 L${W * .385} 0 L${W * .285} ${H} L${W * .27} ${H} Z" fill="${b}"/><path d="M${W * .345} 0 L${W * .352} 0 L${W * .252} ${H} L${W * .245} ${H} Z" fill="${b}"/>
    <rect x="0" y="${H * .86}" width="${W * .3}" height="${H * .035}" fill="${a}"/>`,
  burst: (W, H, a, b, o) => { const cx = o.mx, cy = o.my, R = W * 1.2; let s = ''; for (let i = 0; i < 24; i += 2) { const t0 = i / 24 * Math.PI * 2, t1 = (i + 1) / 24 * Math.PI * 2; s += `<path d="M${cx} ${cy} L${cx + R * Math.cos(t0)} ${cy + R * Math.sin(t0)} L${cx + R * Math.cos(t1)} ${cy + R * Math.sin(t1)} Z" fill="${a}" opacity=".22"/>`; }
    return s + `<path d="M0 ${H * .84} L${W * 1.05} ${H * .7} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/><path d="M${W * .55} ${H} L${W * .7} ${H * .62} L${W * .66} ${H * .62} L${W * .78} ${H * .3} L${W * .74} ${H * .66} L${W * .78} ${H * .66} L${W * .62} ${H} Z" fill="${a}" opacity=".9"/>`; },
  stripes: (W, H, a, b) => `<path d="M${W * .34} ${H} L${W * .64} 0 L${W * .76} 0 L${W * .46} ${H} Z" fill="${a}"/>
    <path d="M${W * .49} ${H} L${W * .79} 0 L${W * .84} 0 L${W * .54} ${H} Z" fill="${b}"/>
    <path d="M${W * .58} ${H} L${W * .88} 0 L${W * 1.05} 0 L${W * 1.05} ${H} Z" fill="${a}"/>
    <path d="M0 ${H * .82} L${W * .44} ${H * .82} L${W * .4} ${H * .9} L0 ${H * .9} Z" fill="${b}"/>`,
  band: (W, H, a, b) => `<rect x="0" y="${H * .64}" width="${W * 1.05}" height="${H * .36}" fill="${b}"/><rect x="0" y="${H * .6}" width="${W * 1.05}" height="${H * .035}" fill="${a}"/>
    ${Array.from({ length: 5 }, (_, i) => `<path d="M${W * (.72 + i * .06)} ${H * .64} l${W * .035} ${H * .18} l${-W * .035} ${H * .18} l${W * .025} 0 l${W * .035} ${-H * .18} l${-W * .035} ${-H * .18} Z" fill="${a}"/>`).join('')}
    <path d="M${W * .84} 0 L${W * 1.05} 0 L${W * 1.05} ${H * .6} L${W * .74} ${H * .6} Z" fill="${a}"/>`,
  split: (W, H, a, b) => `<path d="M0 0 L${W * .5} 0 L${W * .4} ${H} L0 ${H} Z" fill="${shade(a, .55)}"/>
    <path d="M${W * .66} 0 L${W * 1.05} 0 L${W * 1.05} ${H} L${W * .56} ${H} Z" fill="${b}"/><path d="M${W * .62} 0 L${W * .66} 0 L${W * .56} ${H} L${W * .52} ${H} Z" fill="${a}"/>
    <rect x="0" y="${H * .84}" width="${W * .4}" height="${H * .16}" fill="${a}"/>`,
  chevron: (W, H, a, b) => `<rect x="0" y="${H * .7}" width="${W * 1.05}" height="${H * .3}" fill="${b}"/>
    ${Array.from({ length: 7 }, (_, i) => `<path d="M${W * (.04 + i * .14)} ${H * .9} L${W * (.1 + i * .14)} ${H * .76} L${W * (.16 + i * .14)} ${H * .9}" fill="none" stroke="${a}" stroke-width="${H * .035}" stroke-linejoin="miter"/>`).join('')}
    <path d="M${W * .7} ${H * .7} L${W * .88} ${H * .2} L${W * 1.05} ${H * .08} L${W * 1.05} ${H * .7} Z" fill="${a}"/>`,
  hazard: (W, H, a, b) => `<rect x="0" y="${H * .72}" width="${W * 1.05}" height="${H * .28}" fill="${b}"/>
    ${Array.from({ length: 22 }, (_, i) => `<path d="M${W * (i * .05)} ${H} L${W * (i * .05 + .06)} ${H * .76} L${W * (i * .05 + .085)} ${H * .76} L${W * (i * .05 + .025)} ${H} Z" fill="${a}"/>`).join('')}
    <rect x="0" y="${H * .72}" width="${W * 1.05}" height="${H * .04}" fill="${a}"/>
    <path d="M${W * .8} 0 L${W * 1.05} 0 L${W * 1.05} ${H * .72} L${W * .66} ${H * .72} Z" fill="${a}"/>`,
  splash: (W, H, a, b) => { const r = rnd(5); let s = ''; for (let i = 0; i < 18; i++) { const x = W * (.52 + r() * .5), y = H * (.08 + r() * .84), rr = H * (.015 + r() * .05); s += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${i % 3 ? a : shade(a, -.25)}"/>`; }
    return `<path d="M${W * .58} ${H * .1} C${W * .7} ${-H * .05} ${W * .76} ${H * .2} ${W * .86} ${H * .12} S${W * 1.05} ${H * .02} ${W * 1.05} ${H * .3} L${W * 1.05} ${H} L${W * .46} ${H} C${W * .5} ${H * .8} ${W * .44} ${H * .64} ${W * .54} ${H * .56} S${W * .5} ${H * .26} ${W * .58} ${H * .1} Z" fill="${a}"/>` + s +
      `<path d="M0 ${H * .86} C${W * .12} ${H * .8} ${W * .22} ${H * .9} ${W * .38} ${H * .84} L${W * .38} ${H} L0 ${H} Z" fill="${a}"/>`; },
  drip: (W, H, a, b) => { let s = `<rect x="0" y="0" width="${W * 1.05}" height="${H * .13}" fill="${a}"/>`; const r = rnd(9); for (let i = 0; i < 26; i++) { const x = W * (i / 25) * 1.04, w = W * (.012 + r() * .018), l = H * (.06 + r() * (i > 12 ? .34 : .16)); s += `<path d="M${x - w} ${H * .12} L${x - w} ${H * .12 + l} A${w} ${w} 0 0 0 ${x + w} ${H * .12 + l} L${x + w} ${H * .12} Z" fill="${a}"/>`; }
    return s + `<rect x="0" y="${H * .88}" width="${W * 1.05}" height="${H * .12}" fill="${b === '#ffffff' ? shade(a, -.3) : b}"/>`; },
  flake: (W, H, a, b) => { const r = rnd(3); let s = `<rect width="${W * 1.05}" height="${H}" fill="${b}"/>`; for (let i = 0; i < 260; i++) s += `<rect x="${W * r() * 1.05}" y="${H * r()}" width="${H * (.006 + r() * .012)}" height="${H * (.004 + r() * .01)}" fill="${['#ffffff', a, '#8e99a6', '#5b6470'][i % 4]}" opacity="${.35 + r() * .5}" transform="rotate(${r() * 180} ${0} ${0})"/>`;
    return s + `<path d="M0 ${H * .8} C${W * .3} ${H * .66} ${W * .62} ${H * .94} ${W * 1.05} ${H * .7} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>`; },
  swoosh: (W, H, a, b) => `<path d="M${W * .2} ${H} C${W * .4} ${H * .5} ${W * .62} ${H * .9} ${W * .76} ${H * .3} S${W * .96} ${-H * .1} ${W * 1.05} ${H * .1} L${W * 1.05} ${H} Z" fill="${a}"/>
    <path d="M${W * .46} ${H} C${W * .62} ${H * .62} ${W * .76} ${H * .96} ${W * .86} ${H * .46} S${W} ${H * .2} ${W * 1.05} ${H * .3} L${W * 1.05} ${H} Z" fill="${b}" opacity=".92"/>
    <path d="M0 ${H * .9} C${W * .2} ${H * .8} ${W * .3} ${H * .94} ${W * .5} ${H * .86}" fill="none" stroke="${a}" stroke-width="${H * .03}" stroke-linecap="round"/>`,
  confetti: (W, H, a, b) => { const r = rnd(11); let s = ''; const cols = [b, '#ffffff', shade(b, -.2), '#3fb0ff', '#7c5cff']; for (let i = 0; i < 70; i++) { const x = W * r() * 1.05, y = H * r(), sz = H * (.012 + r() * .022); s += r() > .5 ? `<rect x="${x}" y="${y}" width="${sz * 2}" height="${sz * .8}" rx="${sz * .3}" fill="${cols[i % 5]}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="${sz * .7}" fill="${cols[i % 5]}"/>`; }
    return s + `<path d="M0 ${H * .82} C${W * .3} ${H * .7} ${W * .6} ${H * .94} ${W * 1.05} ${H * .74} L${W * 1.05} ${H} L0 ${H} Z" fill="${b}"/>`; },
  bubbles: (W, H, a, b) => { const r = rnd(7); let s = ''; for (let i = 0; i < 30; i++) { const x = W * (.45 + r() * .6), y = H * r(), rr = H * (.02 + r() * .07); s += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${i % 2 ? a : b}" opacity="${.35 + r() * .5}"/><circle cx="${x - rr * .35}" cy="${y - rr * .35}" r="${rr * .22}" fill="#fff" opacity=".8"/>`; }
    return `<path d="M0 ${H * .78} C${W * .2} ${H * .68} ${W * .4} ${H * .9} ${W * .6} ${H * .76} S${W * .9} ${H * .64} ${W * 1.05} ${H * .7} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>` + s; },
  stars: (W, H, a, b) => { const r = rnd(13); let s = ''; const star = (x, y, R) => `<path d="M${x} ${y - R} L${x + R * .29} ${y - R * .4} L${x + R * .95} ${y - R * .31} L${x + R * .47} ${y + R * .15} L${x + R * .59} ${y + R * .81} L${x} ${y + R * .5} L${x - R * .59} ${y + R * .81} L${x - R * .47} ${y + R * .15} L${x - R * .95} ${y - R * .31} L${x - R * .29} ${y - R * .4} Z" fill="${a}"/>`;
    for (let i = 0; i < 22; i++) s += star(W * (.45 + r() * .6), H * r(), H * (.012 + r() * .03));
    return `<rect width="${W * 1.05}" height="${H}" fill="${b}"/>` + s + `<rect x="0" y="${H * .84}" width="${W * 1.05}" height="${H * .02}" fill="${a}"/><rect x="0" y="${H * .88}" width="${W * 1.05}" height="${H * .006}" fill="${a}"/>`; },
  wood: (W, H, a, b) => { let s = ''; for (let i = 0; i < 4; i++) { const y = H * (.6 + i * .1); s += `<rect x="0" y="${y}" width="${W * 1.05}" height="${H * .1}" fill="${i % 2 ? a : shade(a, -.12)}"/><path d="M0 ${y + H * .05} C${W * .2} ${y + H * .02} ${W * .4} ${y + H * .08} ${W * .6} ${y + H * .04} S${W * .9} ${y + H * .07} ${W * 1.05} ${y + H * .03}" fill="none" stroke="${shade(a, -.3)}" stroke-width="${H * .006}"/><rect x="0" y="${y}" width="${W * 1.05}" height="${H * .004}" fill="${shade(a, -.4)}"/>`; }
    return s + `<path d="M${W * .78} 0 L${W * 1.05} 0 L${W * 1.05} ${H * .6} L${W * .66} ${H * .6} Z" fill="${b}"/>`; },
  tiles: (W, H, a, b) => { let s = ''; const t = H * .1; for (let r = 0; r < 3; r++) for (let c = 0; c < Math.ceil(W * 1.05 / t); c++) s += `<rect x="${c * t + (r % 2 ? t / 2 : 0) - t / 2}" y="${H * .7 + r * t}" width="${t * .92}" height="${t * .92}" rx="${t * .08}" fill="${(r + c) % 3 ? a : shade(a, .25)}"/>`;
    return `<rect x="0" y="${H * .68}" width="${W * 1.05}" height="${H * .32}" fill="${b}"/>` + s + `<path d="M${W * .8} 0 L${W * 1.05} 0 L${W * 1.05} ${H * .68} L${W * .7} ${H * .68} Z" fill="${a}"/>`; },
  checker: (W, H, a, b) => { let s = ''; const t = H * .085; for (let r = 0; r < 2; r++) for (let c = 0; c < Math.ceil(W * 1.05 / t); c++) if ((r + c) % 2) s += `<rect x="${c * t}" y="${H * .78 + r * t}" width="${t}" height="${t}" fill="${'#ffffff'}"/>`;
    return `<rect x="0" y="${H * .78}" width="${W * 1.05}" height="${t * 2}" fill="${shade(a, -.25)}"/>` + s + `<rect x="0" y="${H * .74}" width="${W * 1.05}" height="${H * .04}" fill="${b}"/><path d="M0 ${H * .97} L${W * 1.05} ${H * .97}" stroke="${b}" stroke-width="${H * .04}"/>`; },
  flames: (W, H, a, b) => { let s = `<path d="M0 ${H}`; const n = 14; for (let i = 0; i <= n; i++) { const x = W * 1.05 * i / n, h = H * (.36 + (i % 3) * .1); s += ` Q${x - W * .03} ${H - h * .5} ${x} ${H - h} Q${x + W * .01} ${H - h * .45} ${x + W * 1.05 / n / 2} ${H - h * .3}`; } s += ` L${W * 1.05} ${H} Z" fill="${a}"/>`;
    let s2 = `<path d="M0 ${H}`; for (let i = 0; i <= n; i++) { const x = W * 1.05 * i / n + W * .02, h = H * (.2 + (i % 2) * .07); s2 += ` Q${x - W * .02} ${H - h * .5} ${x} ${H - h} Q${x + W * .01} ${H - h * .45} ${x + W * 1.05 / n / 2} ${H - h * .3}`; } s2 += ` L${W * 1.05} ${H} Z" fill="#ffd23f"/>`;
    return `<rect width="${W * 1.05}" height="${H}" fill="${b}"/>` + s + s2; },
  paws: (W, H, a, b) => { const r = rnd(17); let s = ''; const paw = (x, y, R, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})" fill="${b}" opacity=".55"><ellipse cx="0" cy="${R * .5}" rx="${R * .7}" ry="${R * .55}"/><circle cx="${-R * .7}" cy="${-R * .2}" r="${R * .26}"/><circle cx="${-R * .25}" cy="${-R * .6}" r="${R * .26}"/><circle cx="${R * .25}" cy="${-R * .6}" r="${R * .26}"/><circle cx="${R * .7}" cy="${-R * .2}" r="${R * .26}"/></g>`;
    for (let i = 0; i < 12; i++) s += paw(W * (.5 + i * .045), H * (.2 + ((i % 2) ? .12 : 0) + r() * .04), H * .045, -70);
    return `<path d="M0 ${H * .76} C${W * .3} ${H * .64} ${W * .6} ${H * .9} ${W * 1.05} ${H * .7} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>` + s; },
  road: (W, H, a, b) => `<rect x="0" y="${H * .72}" width="${W * 1.05}" height="${H * .22}" fill="#2a2f38"/>
    ${Array.from({ length: 12 }, (_, i) => `<rect x="${W * (i * .09 + .02)}" y="${H * .82}" width="${W * .05}" height="${H * .025}" fill="#ffd23f"/>`).join('')}
    <rect x="0" y="${H * .69}" width="${W * 1.05}" height="${H * .03}" fill="${a}"/><rect x="0" y="${H * .94}" width="${W * 1.05}" height="${H * .06}" fill="${b}"/>
    <path d="M${W * .8} 0 L${W * 1.05} 0 L${W * 1.05} ${H * .69} L${W * .68} ${H * .69} Z" fill="${b}"/>`,
};

function card(W, H, z, mirror, d, dark) {
  const w = (z.u1 - z.u0) * W, h = (z.v1 - z.v0) * H, y0 = z.v0 * H, bx = mirror ? W - z.u1 * W : z.u0 * W;
  const fs = Math.min(h * .19, w * .075), pad = fs * .55, iw = w - pad * 2, top = y0 + pad;
  const ink = dark ? '#ffffff' : '#141414', accent = dark ? (lum(d.c[0]) > .35 ? d.c[0] : d.c[1]) : (lum(d.c[0]) > .72 ? d.c[1] : d.c[0]);
  const bar = lum(d.c[0]) > .72 ? d.c[1] : d.c[0];
  return `<g id="text-placeholders" font-family="${FONT}" fill="${ink}">
  <rect x="${bx}" y="${y0}" width="${w}" height="${h * 1.22}" rx="${fs * .45}" fill="${dark ? '#0d0f12' : '#ffffff'}" opacity="${dark ? .82 : .94}"/>
  <rect x="${bx + pad}" y="${top}" width="${iw * .6}" height="${h * .36}" rx="${fs * .25}" fill="none" stroke="${ink}" stroke-width="${Math.max(2, fs * .06)}" stroke-dasharray="${fs * .22} ${fs * .16}" opacity=".85"/>
  <text x="${bx + pad + iw * .3}" y="${top + h * .18 + fs * .36}" font-size="${fs}" font-weight="800" text-anchor="middle" letter-spacing="${fs * .04}">YOUR LOGO</text>
  <text x="${bx + pad}" y="${top + h * .36 + fs * .95}" font-size="${fs * .5}" font-weight="600" opacity=".9">Your tagline here</text>
  <text x="${bx + pad}" y="${y0 + h - pad * .9}" font-size="${fs * .86}" font-weight="900" fill="${accent}">905-000-0000</text>
  <text x="${bx + w - pad}" y="${y0 + h - pad * .9}" font-size="${fs * .58}" font-weight="700" text-anchor="end">yourbrand.ca</text>
  <rect x="${bx + pad}" y="${y0 + h + fs * .05}" width="${iw}" height="${h * .2 - fs * .1}" rx="${fs * .2}" fill="${bar}"/>
  <text x="${bx + w / 2}" y="${y0 + h + h * .1 + fs * .16}" font-size="${fs * .46}" font-weight="800" fill="${lum(bar) > .6 ? '#141414' : '#ffffff'}" text-anchor="middle">${d.tag.toUpperCase().replace(/&/g, '&amp;')}</text>
</g>`;
}

export function mascotArt(d, W, H, o = {}) {
  const z = o.zone || { u0: .44, u1: .94, v0: .16, v1: .52 };
  const [a, b] = d.c, dark = d.bg === 'dark' || (d.bg === 'a' && lum(a) < .55);
  const base = d.bg === 'a' ? a : d.bg === 'dark' ? (lum(b) < .3 ? b : '#16181d') : '#f7f7f5';
  // Mascot: on a soft round badge on a flat panel of each body (below the card on vans, the bed on pickups).
  let m = z.m || { side: .64 }, Z = z;
  if (m.side) { // narrower info card + the mascot beside it on the rear panel
    const u1 = z.u0 + (z.u1 - z.u0) * m.side; Z = { ...z, u1 };
    const free = (z.u1 - u1) * W, top = z.v0 * H, bot = (z.v0 + (z.v1 - z.v0) * 1.22) * H;
    m = { u: (u1 * W + free / 2 + free * .04) / W, v: ((top + bot) / 2 + H * .02) / H, s: Math.min(free * 1.0, H * .5) / H };
  }
  const s = H * m.s, mx = W * m.u, my = H * m.v;
  const L = LAYOUT[d.layout] || LAYOUT.wave;
  const badge = `<circle cx="${mx}" cy="${my}" r="${s * .56}" fill="${dark ? shade(a, -.1) : '#ffffff'}" opacity="${dark ? .28 : .9}"/><circle cx="${mx}" cy="${my}" r="${s * .56}" fill="none" stroke="${lum(a) > .85 ? b : a}" stroke-width="${s * .025}"/>`;
  const main = lum(a) > .85 ? b : a;
  // Characters with "natural" colours (food, wood, kraft, skin) keep their own body colour and take the brand colour as accent.
  const NAT = { burgie: [null, null], slice: [null, main], chef: [null, main], pup: [null, main], boxy: [null, main], hammy: [null, null], saw: [null, null], cuppa: ['#ffffff', main], glossy: [main, null] };
  const [mc, mb] = d.mc || d.mb ? [d.mc, d.mb] : NAT[d.m] || [main, null];
  const mascot = `<g id="mascot" transform="translate(${mx - s / 2} ${my - s / 2}) scale(${s / 100})">${mascotMarkup(d.m, mc, mb)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${d.name.replace(/&/g, '&amp;')} — vehicle wrap design (${o.mirror ? 'passenger' : 'driver'} side)</title>
<g id="background"><rect width="${W}" height="${H}" fill="${base}"/></g>
<g id="graphics"${o.mirror ? ` transform="matrix(-1 0 0 1 ${W} 0)"` : ''}>${L(W, H, a, b, { mx, my })}${badge}${mascot}</g>
${card(W, H, Z, !!o.mirror, d, dark)}
</svg>`;
}
